FROM mcp/brave-search:latest
USER root
WORKDIR /app
RUN npm install express @modelcontextprotocol/sdk --legacy-peer-deps
COPY adapters/targetly-adapter.js /app/targetly-adapter.cjs
ENV PORT=8080
ENV TARGETLY_MCP_SERVER_SCRIPT=dist/index.js
EXPOSE 8080
ENTRYPOINT ["node", "/app/targetly-adapter.cjs"]
