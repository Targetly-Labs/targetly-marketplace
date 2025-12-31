/**
 * Targetly MCP SSE Adapter (Node.js)
 * ----------------------------------
 * This adapter wraps a stdio-based MCP server (running via command line)
 * and exposes it over SSE (Server-Sent Events) for the Targetly platform.
 * It handles bridging HTTP POST requests to stdin and stdout to SSE events.
 */

const { SSEServerTransport } = require("@modelcontextprotocol/sdk/server/sse.js");
const express = require("express");
const { spawn } = require("child_process");
const fs = require('fs');

// Configuration
const PORT = process.env.PORT || 8080;
let SERVER_SCRIPT = process.env.TARGETLY_MCP_SERVER_SCRIPT || process.argv[2]; // Path to the original server script

// SMART DETECTION: Try to find entrypoint from package.json if not provided
if (!SERVER_SCRIPT || !fs.existsSync(SERVER_SCRIPT)) {
    try {
        const packageJson = require('./package.json');

        // 1. Check 'bin' field (Standard for CLI tools)
        if (packageJson.bin) {
            if (typeof packageJson.bin === 'string') {
                SERVER_SCRIPT = packageJson.bin;
            } else if (typeof packageJson.bin === 'object') {
                const keys = Object.keys(packageJson.bin);
                if (keys.length > 0) {
                    SERVER_SCRIPT = packageJson.bin[keys[0]];
                }
            }
        }

        // 2. Check 'main' field (Standard for libraries/apps)
        if ((!SERVER_SCRIPT || !fs.existsSync(SERVER_SCRIPT)) && packageJson.main) {
            SERVER_SCRIPT = packageJson.main;
        }

    } catch (e) {
        // Ignore errors, unnecessary to log in production
    }
}

// Fallback: Common entrypoint paths
const POSSIBLE_PATHS = [
    "./build/index.js",
    "./dist/index.js",
    "./src/index.js",
    "./index.js"
];

if (!SERVER_SCRIPT || !fs.existsSync(SERVER_SCRIPT)) {
    const found = POSSIBLE_PATHS.find(p => fs.existsSync(p));
    if (found) {
        SERVER_SCRIPT = found;
    } else {
        console.error("Targetly Adapter Error: Could not find MCP server entrypoint.");
        process.exit(1);
    }
}

console.log(`Targetly Adapter: Starting server for: ${SERVER_SCRIPT}`);

const app = express();

/** 
 * Transport Handling
 * ------------------
 * We instantiate the SSEServerTransport per connection because the SDK
 * design ties the transport lifecycle to the response object.
 */
let transport = null;

// Determine args:
// If SERVER_SCRIPT came from ENV, we use all args from argv[2] onwards.
// If SERVER_SCRIPT came from argv[2], we use args from argv[3] onwards.
let args = [];
if (process.env.TARGETLY_MCP_SERVER_SCRIPT) {
    args = process.argv.slice(2);
} else {
    args = process.argv.slice(3);
}

// Spawn the child process
const child = spawn("node", [SERVER_SCRIPT, ...args], {
    stdio: ["pipe", "pipe", "inherit"], // Write to 0, read from 1, pass stderr through
});

child.on("error", (err) => {
    console.error("Targetly Adapter: Failed to spawn child process:", err);
});

child.on("exit", (code) => {
    console.error(`Targetly Adapter: Child process exited with code ${code}`);
    process.exit(code || 1);
});

// SSE Endpoint
app.get("/sse", async (req, res) => {
    transport = new SSEServerTransport("/messages", res);

    // Bridge: Stdio -> Web (SSE)
    // We attach this listener anew for each connection/transport
    transport.onmessage = (message) => {
        const jsonLine = JSON.stringify(message) + "\n";
        child.stdin.write(jsonLine);
    };

    await transport.start();

    // CRITICAL: Send the endpoint event immediately so the client knows where to POST
    res.write("event: endpoint\n");
    res.write("data: /messages\n\n");
});

// POST Endpoint
app.post("/messages", async (req, res) => {
    if (transport) {
        await transport.handlePostMessage(req, res);
    } else {
        res.status(404).json({ error: "No active connection" });
    }
});

// Bridge: Web -> Stdio (Stdin) goes via transport.onmessage above.

// Bridge: Stdio -> Web (SSE)
// We listen to the child's stdout continuously and forward to the *current* transport.
let buffer = "";
child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop(); // Keep partial line

    for (const line of lines) {
        if (line.trim()) {
            try {
                const message = JSON.parse(line);
                if (transport) {
                    transport.send(message);
                }
            } catch (err) {
                console.error("Targetly Adapter: Invalid JSON from child:", line);
            }
        }
    }
});

app.listen(PORT, () => {
    console.log(`Targetly Adapter listening on port ${PORT}`);
});
