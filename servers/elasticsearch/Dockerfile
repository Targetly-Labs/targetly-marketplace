FROM mcp/elasticsearch:latest
USER root
# Wolfi/Chainguard images use apk (usually)
RUN apk add --no-cache python3 py3-pip || (apt-get update && apt-get install -y python3 python3-pip)
WORKDIR /app
RUN python3 -m pip install "fastapi[standard]" uvicorn sse-starlette --break-system-packages || \
    pip install "fastapi[standard]" uvicorn sse-starlette
COPY adapters/targetly-adapter.py /app/targetly-adapter.py
ENV PORT=8080
ENV TARGETLY_MCP_CMD="/usr/local/bin/elasticsearch-core-mcp-server stdio"
EXPOSE 8080
ENTRYPOINT []
CMD ["python3", "targetly-adapter.py"]
