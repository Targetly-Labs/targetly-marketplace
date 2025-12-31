import os
import sys
import json
import asyncio
import subprocess
import uvicorn
from fastapi import FastAPI, Request
from sse_starlette.sse import EventSourceResponse

"""
Targetly MCP SSE Adapter (Python)
---------------------------------
This adapter wraps a stdio-based MCP server (running via command line)
and exposes it over SSE (Server-Sent Events) for the Targetly platform.
It handles bridging HTTP POST requests to stdin and stdout to SSE events.
"""

# Configuration
PORT = int(os.environ.get("PORT", 8080))
SERVER_SCRIPT = os.environ.get("TARGETLY_MCP_SERVER_SCRIPT") or (sys.argv[1] if len(sys.argv) > 1 else None)

# Smart Detection of Entrypoint
if not SERVER_SCRIPT or not os.path.exists(SERVER_SCRIPT):
    # Try to detect if running in a project with pyproject.toml
    try:
        if os.path.exists("pyproject.toml"):
            import tomllib
            with open("pyproject.toml", "rb") as f:
                # Just checks, logic below determines cmd
                _ = tomllib.load(f)
    except Exception:
        pass

# Determine Command to Run
CMD = []
# 1. Explicit full command override
if os.environ.get("TARGETLY_MCP_CMD"):
    import shlex
    CMD = shlex.split(os.environ.get("TARGETLY_MCP_CMD"))
# 2. Script-based execution
elif SERVER_SCRIPT and os.path.exists(SERVER_SCRIPT):
    CMD = ["python", SERVER_SCRIPT]
elif os.path.exists("pyproject.toml"):
    # Attempt to detect project name or default to 'uv run'
    try:
        import tomllib
        with open("pyproject.toml", "rb") as f:
            data = tomllib.load(f)
            project_name = data.get("project", {}).get("name")
            if project_name:
                CMD = ["uv", "run", project_name]
    except:
        pass

if not CMD:
    # Fallback default
    CMD = ["python", "main.py"]

print(f"Targetly Adapter: Starting server with command: {CMD}")

# Append any additional arguments passed to the adapter
# If TARGETLY_MCP_CMD is used, we append args from sys.argv[1:]
# If SERVER_SCRIPT (via env or argv) is used, we append appropriately.
extra_args = []
if os.environ.get("TARGETLY_MCP_CMD"):
     extra_args = sys.argv[1:]
elif os.environ.get("TARGETLY_MCP_SERVER_SCRIPT"):
   extra_args = sys.argv[1:]
elif len(sys.argv) > 1:
   extra_args = sys.argv[2:]

CMD.extend(extra_args)

# Spawn the child process
process = subprocess.Popen(
    CMD,
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=sys.stderr, # Pass stderr through to logs
    text=True,
    bufsize=1  # Line buffered to ensure immediate message delivery
)

app = FastAPI()

@app.get("/sse")
async def sse(request: Request):
    """
    SSE Endpoint for MCP Clients.
    Streams stdout from the child process as JSON-RPC messages.
    """
    async def event_generator():
        # CRITICAL: Send endpoint event first so client knows where to POST
        yield {"event": "endpoint", "data": "/messages"}

        loop = asyncio.get_event_loop()
        while True:
            if await request.is_disconnected():
                break
            
            # Non-blocking read from stdout
            line = await loop.run_in_executor(None, process.stdout.readline)
            if not line:
                break
            
            try:
                # Validate it's JSON-RPC (optional, but good for cleanliness)
                json.loads(line)
                yield {"data": line.strip()}
            except:
                print(f"Targetly Adapter: Ignored invalid JSON from process: {line.strip()}")

    return EventSourceResponse(event_generator())

@app.post("/messages")
async def handle_message(request: Request):
    """
    HTTP POST Endpoint for MCP Clients.
    forwards JSON-RPC messages to the child process stdin.
    """
    body = await request.json()
    
    # Write to process stdin
    json_line = json.dumps(body) + "\n"
    process.stdin.write(json_line)
    process.stdin.flush()
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
