FROM mcp/aws-core-mcp-server:latest
WORKDIR /app
RUN pip install "fastapi[standard]" uvicorn sse-starlette
COPY adapters/targetly-adapter.py /app/targetly-adapter.py
ENV PORT=8080
ENV TARGETLY_MCP_CMD="awslabs.core-mcp-server"
EXPOSE 8080
ENTRYPOINT []
CMD ["python", "targetly-adapter.py"]
