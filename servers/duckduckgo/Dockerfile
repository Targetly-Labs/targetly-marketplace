FROM mcp/duckduckgo:latest

WORKDIR /app

# 1. Install Adapter Dependencies
RUN pip install "fastapi[standard]" uvicorn sse-starlette

# 2. Copy Targetly Adapter from build context
COPY adapters/targetly-adapter.py /app/targetly-adapter.py

# 3. Configure
ENV PORT=8080
ENV TARGETLY_MCP_CMD="python -m duckduckgo_mcp_server.server"
EXPOSE 8080
CMD ["python", "targetly-adapter.py"]
