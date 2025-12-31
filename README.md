# Official Targetly MCP Server Images

This repository contains the build configurations for official Docker images of Model Context Protocol (MCP) servers, optimized for the Targetly Marketplace.

Each server image encapsulates:
1.  **Build Context**: The original source code from the author (e.g., `modelcontextprotocol/servers`).
2.  **Targetly Adapter**: An HTTP/SSE adapter (`targetly-adapter.js` or `targetly-adapter.py`) that makes the server web-accessible.

## Structure

- `adapters/`: Contains the bridge scripts that run inside the container.
- `servers/`: Contains the Dockerfile for each official image.

## Building an Image

From the root of this repository:

```bash
# Build Memory Server (Node.js)
docker build -f servers/memory/Dockerfile -t targetly/mcp-memory:latest .

# Build Time Server (Python)
docker build -f servers/time/Dockerfile -t targetly/mcp-time:latest .
```

## Adding a New Server

1.  Create a folder in `servers/`.
2.  Create a `Dockerfile`.
3.  Copy the pattern from `memory` (for Node) or `time` (for Python).
4.  Ensure it copies the correct adapter from the `adapters/` context.
