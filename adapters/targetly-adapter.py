import os
import sys
import json
import asyncio
import subprocess
from uuid import uuid4
import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

"""
Targetly MCP SSE Adapter (Python)
---------------------------------
This adapter wraps a stdio-based MCP server (running via command line)
and exposes it over SSE (Server-Sent Events) for the Targetly platform.

Key protocol details (from MCP SDK):
1. GET /sse -> SSE stream. First event is `endpoint` with `data: /messages?session_id=<uuid>`.
2. SSE messages use `event: message` with JSON-RPC in `data:`.
3. POST /messages?session_id=<uuid> -> Forward to stdin. Returns 202 Accepted.
"""

# Configuration
PORT = int(os.environ.get("PORT", 8080))
DEBUG = os.environ.get("TARGETLY_DEBUG", "").lower() in ("true", "1", "yes")

# --- Command Detection ---
def get_server_command():
    """Detect the MCP server command to run."""
    # 1. Explicit full command override
    if os.environ.get("TARGETLY_MCP_CMD"):
        import shlex
        return shlex.split(os.environ.get("TARGETLY_MCP_CMD"))
    
    # 2. Script-based execution
    server_script = os.environ.get("TARGETLY_MCP_SERVER_SCRIPT") or (sys.argv[1] if len(sys.argv) > 1 else None)
    if server_script and os.path.exists(server_script):
        return ["python", server_script]
    
    # 3. Detect from pyproject.toml
    if os.path.exists("pyproject.toml"):
        try:
            import tomllib
            with open("pyproject.toml", "rb") as f:
                data = tomllib.load(f)
                project_name = data.get("project", {}).get("name")
                if project_name:
                    return ["uv", "run", project_name]
        except Exception:
            pass
    
    # 4. Fallback
    return ["python", "main.py"]

CMD = get_server_command()
print(f"Targetly Adapter: Starting server with command: {CMD}")

# Spawn the child process
process = subprocess.Popen(
    CMD,
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=sys.stderr,
    text=True,
    bufsize=1
)

# --- FastAPI App ---
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Session management: map session_id -> response queue
sessions = {}

@app.get("/sse")
async def sse(request: Request):
    """SSE Endpoint for MCP Clients."""
    session_id = uuid4()
    response_queue = asyncio.Queue()
    sessions[session_id.hex] = response_queue
    
    if DEBUG:
        print(f"Targetly Adapter: New SSE session: {session_id.hex}")
    
    async def event_generator():
        # First event: tell client where to POST
        yield {"event": "endpoint", "data": f"/messages?session_id={session_id.hex}"}
        if DEBUG:
            print(f"Targetly Adapter: Sent endpoint event for session {session_id.hex}")
        
        try:
            while True:
                if await request.is_disconnected():
                    break
                
                try:
                    # Wait for message from queue with timeout for keep-alive
                    message = await asyncio.wait_for(response_queue.get(), timeout=15.0)
                    yield {"event": "message", "data": message}
                    if DEBUG:
                        print(f"Targetly Adapter: OUTGOING: {message}")
                except asyncio.TimeoutError:
                    # Send ping to keep connection alive
                    yield {"comment": "ping"}
        finally:
            # Cleanup session
            sessions.pop(session_id.hex, None)
            if DEBUG:
                print(f"Targetly Adapter: Session {session_id.hex} closed")
    
    return EventSourceResponse(event_generator())

@app.post("/messages")
async def handle_message(request: Request):
    """HTTP POST Endpoint for MCP Clients."""
    session_id = request.query_params.get("session_id")
    
    if not session_id or session_id not in sessions:
        if DEBUG:
            print(f"Targetly Adapter: Invalid session_id: {session_id}")
        return Response("Invalid or missing session_id", status_code=400)
    
    body = await request.body()
    json_line = body.decode() + "\n"
    
    if DEBUG:
        print(f"Targetly Adapter: INCOMING: {body.decode()}")
    
    # Write to process stdin
    process.stdin.write(json_line)
    process.stdin.flush()
    
    return Response("Accepted", status_code=202)

# Background task to read stdout and dispatch to sessions
async def stdout_reader():
    """Read from child process stdout and dispatch to active sessions."""
    loop = asyncio.get_event_loop()
    
    while True:
        try:
            line = await loop.run_in_executor(None, process.stdout.readline)
            if not line:
                print("Targetly Adapter: Child process stdout closed")
                break
            
            line = line.strip()
            if not line:
                continue
            
            try:
                # Validate JSON
                json.loads(line)
                
                # Dispatch to ALL active sessions (MCP doesn't use session-specific routing for responses)
                for session_id, queue in list(sessions.items()):
                    await queue.put(line)
                    if DEBUG:
                        print(f"Targetly Adapter: Dispatched to session {session_id}")
            except json.JSONDecodeError:
                print(f"Targetly Adapter: Ignored non-JSON from process: {line}")
        except Exception as e:
            print(f"Targetly Adapter: stdout_reader error: {e}")
            break

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(stdout_reader())

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
