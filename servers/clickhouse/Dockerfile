FROM mcp/clickhouse:latest
USER root
RUN apt-get update && apt-get install -y python3-pip && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Install deps into the existing venv (using global pip or ensuring pip into venv)
# Using 'pip' from apt-get (global) with --break-system-packages or install into venv
# Since PATH favors venv, 'python' is venv python.
# If venv python doesn't have pip, we can try using global pip module via /usr/bin/python3 -m pip?
# OR: try `ensurepip` again now that we have python3-pip (which brings wheels)?
# Safest: Use global pip to install packages, and hope venv can see them / adapter runs with global python?
# But we want to run adapter with `python` (venv).
# Let's try explicit install into venv site-packages using `pip install --target ...`? 
# OR just `python -m ensurepip` (should work if we have wheels).
RUN python -m ensurepip --upgrade || true
RUN python -m pip install "fastapi[standard]" uvicorn sse-starlette || \
    /usr/bin/python3 -m pip install "fastapi[standard]" uvicorn sse-starlette --break-system-packages
COPY adapters/targetly-adapter.py /app/targetly-adapter.py
ENV PORT=8080
ENV TARGETLY_MCP_CMD="python -m mcp_clickhouse.main"
EXPOSE 8080
ENTRYPOINT []
CMD ["python", "targetly-adapter.py"]
