FROM mcp/paper-search:latest
WORKDIR /app
RUN pip install "fastapi[standard]" uvicorn sse-starlette
COPY adapters/targetly-adapter.py /app/targetly-adapter.py
ENV PORT=8080
ENV TARGETLY_MCP_CMD="python -m paper_search_mcp.server"
EXPOSE 8080
ENTRYPOINT []
CMD ["python", "targetly-adapter.py"]
