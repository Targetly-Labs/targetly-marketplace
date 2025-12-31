/**
 * Targetly MCP SSE Adapter (Node.js)
 * ----------------------------------
 * This adapter wraps a stdio-based MCP server (running via command line)
 * and exposes it over SSE (Server-Sent Events) for the Targetly platform.
 * It handles bridging HTTP POST requests to stdin and stdout to SSE events.
 */

// Core node modules
const { spawn } = require("child_process");
const fs = require('fs');

// External dependencies
const express = require("express");

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
    // Only search fallback if TARGETLY_MCP_CMD is NOT set. 
    // If TARGETLY_MCP_CMD is set, we don't necessarily need a script file.
    if (!process.env.TARGETLY_MCP_CMD) {
        const found = POSSIBLE_PATHS.find(p => fs.existsSync(p));
        if (found) {
            SERVER_SCRIPT = found;
        } else {
            // We only error out later if we actually try to use SERVER_SCRIPT
        }
    }
}


// Wrap execution in async to support dynamic import
(async () => {
    let SSEServerTransport;
    try {
        // Dynamic import to handle ESM/CJS compatibility for the SDK
        const sdk = await import("@modelcontextprotocol/sdk/server/sse.js");
        SSEServerTransport = sdk.SSEServerTransport;
    } catch (e) {
        console.error("Targetly Adapter: Failed to load @modelcontextprotocol/sdk. Ensure it is installed.", e);
        process.exit(1);
    }

    if (process.env.TARGETLY_MCP_CMD) {
        console.log(`Targetly Adapter: Starting server via CMD: ${process.env.TARGETLY_MCP_CMD}`);
    } else {
        console.log(`Targetly Adapter: Starting server for: ${SERVER_SCRIPT}`);
    }

    const app = express();

    /** 
     * Transport Handling
     * ------------------
     * We instantiate the SSEServerTransport per connection because the SDK
     * design ties the transport lifecycle to the response object.
     */
    let transport = null;

    // Determine Command and Args
    let command = "node"; // Default to node
    let args = [];

    if (process.env.TARGETLY_MCP_CMD) {
        // Split command string into command and args
        const parts = process.env.TARGETLY_MCP_CMD.split(" ");
        command = parts[0];
        args = parts.slice(1);
        // Append any extra args passed to the adapter
        args = args.concat(process.argv.slice(2));
    } else if (SERVER_SCRIPT) { // Use SERVER_SCRIPT if resolved
        // Script provided via ENV or resolved
        args = [SERVER_SCRIPT];
        args = args.concat(process.argv.slice(3)); // Note: argv indices depend on how we are called. 
        // If typically called as `node adapter.js`, args start at 2.
        // Wait, line 16 uses process.argv[2] as possible script.
        // If script came from argv[2], extra args are at 3+.
        // If script came from ENV, extra args are at 2+.
        // Let's refine logical consistency:
        if (process.env.TARGETLY_MCP_SERVER_SCRIPT) {
            // extra args start at 2
            args = [SERVER_SCRIPT].concat(process.argv.slice(2));
        } else {
            // extra args start at 3 (2 was the script)
            args = [SERVER_SCRIPT].concat(process.argv.slice(3));
        }
    } else {
        console.error("Targetly Adapter Error: No server script specified via TARGETLY_MCP_SERVER_SCRIPT, TARGETLY_MCP_CMD or command line.");
        process.exit(1);
    }

    console.log(`Targetly Adapter: Spawning ${command} with args: ${JSON.stringify(args)}`);

    // Spawn the child process
    const child = spawn(command, args, {
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

    const server = app.listen(PORT, () => {
        console.log(`Targetly Adapter listening on port ${PORT}`);
    });

})();
