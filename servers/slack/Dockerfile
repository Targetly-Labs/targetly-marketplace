# Official Targetly Image for MCP Slack Server
# Usage: docker run -p 8080:8080 -e SLACK_BOT_TOKEN=... -e SLACK_TEAM_ID=... targetly/mcp-slack

# --------------------------------------------------------
# Build & Runtime
# --------------------------------------------------------
FROM mcp/slack:latest

WORKDIR /app

# 1. Install Adapter Dependencies
# Check if we need root for this, usually default user in mcp images might be restricted
# trying standard npm install.
USER root
RUN npm install express @modelcontextprotocol/sdk --legacy-peer-deps

# 2. Copy Targetly Adapter from build context
# Rename to .cjs to force CommonJS execution
COPY adapters/targetly-adapter.js /app/targetly-adapter.cjs

# 3. Configure
ENV PORT=8080
ENV TARGETLY_MCP_SERVER_SCRIPT=dist/index.js
EXPOSE 8080

# 4. Run
ENTRYPOINT ["node", "targetly-adapter.cjs"]
