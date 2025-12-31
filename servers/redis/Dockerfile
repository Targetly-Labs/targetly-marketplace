FROM mcp/redis:latest
WORKDIR /app
RUN pip install "fastapi[standard]" uvicorn sse-starlette
COPY adapters/targetly-adapter.py /app/targetly-adapter.py
ENV PORT=8080
ENV TARGETLY_MCP_CMD="uv run python src/main.py"
EXPOSE 8080
ENTRYPOINT []
CMD ["python", "targetly-adapter.py"]
