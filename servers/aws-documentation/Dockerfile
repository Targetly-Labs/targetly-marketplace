FROM mcp/aws-documentation:latest
USER root
# Install pip (Alpine)
RUN apk add --no-cache py3-pip
WORKDIR /app
# Try installing into venv or fallback to global
RUN /app/.venv/bin/python -m ensurepip || true
RUN /app/.venv/bin/python -m pip install "fastapi[standard]" uvicorn sse-starlette --break-system-packages || \
    pip install "fastapi[standard]" uvicorn sse-starlette --break-system-packages
COPY adapters/targetly-adapter.py /app/targetly-adapter.py
ENV PORT=8080
ENV TARGETLY_MCP_CMD="awslabs.aws-documentation-mcp-server"
EXPOSE 8080
ENTRYPOINT []
CMD ["python", "targetly-adapter.py"]
