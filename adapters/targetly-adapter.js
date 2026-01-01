/**
 * Targetly MCP SSE Adapter (Node.js)
 * ----------------------------------
 * This adapter wraps a stdio-based MCP server (running via command line)
 * and exposes it over SSE (Server-Sent Events) for the Targetly platform.
 *
 * Key protocol details (from MCP SDK):
 * 1. GET /sse -> SSE stream. First event is `endpoint` with `data: /messages?session_id=<uuid>`.
 * 2. SSE messages use `event: message` with JSON-RPC in `data:`.
 * 3. POST /messages?session_id=<uuid> -> Forward to stdin. Returns 202 Accepted.
 */

const { spawn } = require("child_process");
const fs = require('fs');
const crypto = require('crypto');
const express = require("express");

// Configuration
const PORT = process.env.PORT || 8080;
const DEBUG = process.env.TARGETLY_DEBUG === "true" || process.env.TARGETLY_DEBUG === "1";

// --- Command Detection ---
function getServerCommand() {
    // 1. Explicit full command override
    if (process.env.TARGETLY_MCP_CMD) {
        const parts = process.env.TARGETLY_MCP_CMD.split(" ");
        return { command: parts[0], args: parts.slice(1) };
    }

    // 2. Script-based execution
    let serverScript = process.env.TARGETLY_MCP_SERVER_SCRIPT || process.argv[2];

    if (!serverScript || !fs.existsSync(serverScript)) {
        try {
            const packageJson = require('./package.json');
            if (packageJson.bin) {
                if (typeof packageJson.bin === 'string') {
                    serverScript = packageJson.bin;
                } else if (typeof packageJson.bin === 'object') {
                    const keys = Object.keys(packageJson.bin);
                    if (keys.length > 0) serverScript = packageJson.bin[keys[0]];
                }
            }
            if ((!serverScript || !fs.existsSync(serverScript)) && packageJson.main) {
                serverScript = packageJson.main;
            }
        } catch (e) { }
    }

    // 3. Fallback paths
    if (!serverScript || !fs.existsSync(serverScript)) {
        const fallbacks = ["./dist/index.js", "./build/index.js", "./src/index.js", "./index.js"];
        serverScript = fallbacks.find(p => fs.existsSync(p));
    }

    if (!serverScript) {
        console.error("Targetly Adapter Error: No server script found.");
        process.exit(1);
    }

    return { command: "node", args: [serverScript] };
}

const { command, args } = getServerCommand();
console.log(`Targetly Adapter: Starting server with command: ${command} ${args.join(" ")}`);

// Spawn the child process
const child = spawn(command, args, {
    stdio: ["pipe", "pipe", "inherit"],
});

child.on("error", (err) => {
    console.error("Targetly Adapter: Failed to spawn child process:", err);
});

child.on("exit", (code) => {
    console.error(`Targetly Adapter: Child process exited with code ${code}`);
    process.exit(code || 1);
});

// Session management
const sessions = new Map();

// Read stdout and dispatch to all sessions
let buffer = "";
child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
        if (!line.trim()) continue;

        try {
            JSON.parse(line); // Validate JSON
            if (DEBUG) console.log("Targetly Adapter: OUTGOING:", line);

            // Dispatch to all active sessions
            for (const [sessionId, res] of sessions) {
                res.write(`event: message\n`);
                res.write(`data: ${line}\n\n`);
                if (DEBUG) console.log(`Targetly Adapter: Dispatched to session ${sessionId}`);
            }
        } catch (err) {
            console.error("Targetly Adapter: Invalid JSON from child:", line);
        }
    }
});

// Express app
const app = express();

// CORS
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "*");
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.use(express.json());
app.use(express.text({ type: "*/*" }));

// SSE Endpoint
app.get("/sse", (req, res) => {
    const sessionId = crypto.randomUUID();

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    sessions.set(sessionId, res);
    if (DEBUG) console.log(`Targetly Adapter: New SSE session: ${sessionId}`);

    // Send endpoint event
    res.write(`event: endpoint\n`);
    res.write(`data: /messages?session_id=${sessionId}\n\n`);

    // Keep-alive ping
    const pingInterval = setInterval(() => {
        res.write(`: ping\n\n`);
    }, 15000);

    req.on("close", () => {
        clearInterval(pingInterval);
        sessions.delete(sessionId);
        if (DEBUG) console.log(`Targetly Adapter: Session ${sessionId} closed`);
    });
});

// POST Endpoint
app.post("/messages", (req, res) => {
    const sessionId = req.query.session_id;

    if (!sessionId || !sessions.has(sessionId)) {
        if (DEBUG) console.log(`Targetly Adapter: Invalid session_id: ${sessionId}`);
        return res.status(400).send("Invalid or missing session_id");
    }

    let body = req.body;
    if (typeof body === "object") {
        body = JSON.stringify(body);
    }

    if (DEBUG) console.log(`Targetly Adapter: INCOMING: ${body}`);

    child.stdin.write(body + "\n");
    res.status(202).send("Accepted");
});

app.listen(PORT, () => {
    console.log(`Targetly Adapter listening on port ${PORT}`);
});
