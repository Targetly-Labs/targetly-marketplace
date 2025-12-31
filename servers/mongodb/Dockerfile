FROM mcp/mongodb:latest
USER root
# Install adapter deps in /app where the adapter lives
WORKDIR /app
RUN npm install express @modelcontextprotocol/sdk --legacy-peer-deps
COPY adapters/targetly-adapter.js /app/targetly-adapter.cjs
ENV PORT=8080
# Override command using ENV support in JS adapter
# Updated JS Adapter supports TARGETLY_MCP_CMD
ENV TARGETLY_MCP_CMD="mongodb-mcp-server"
EXPOSE 8080
ENTRYPOINT ["node", "/app/targetly-adapter.cjs"]
