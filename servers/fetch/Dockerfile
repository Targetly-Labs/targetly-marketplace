# Official Targetly Image for MCP Fetch Server
# Usage: docker run -p 8080:8080 targetly/mcp-fetch

# --------------------------------------------------------
# Stage 1: Fetch Source
# --------------------------------------------------------
FROM alpine/git AS source
WORKDIR /src
RUN git clone https://github.com/modelcontextprotocol/servers.git .

# --------------------------------------------------------
# Stage 2: Build & Runtime
# --------------------------------------------------------
FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

# 1. Install Adapter Dependencies
RUN pip install "fastapi[standard]" uvicorn sse-starlette

# 2. Copy Targetly Adapter from build context
COPY adapters/targetly-adapter.py /app/targetly-adapter.py

# 3. Copy Source Code from Stage 1 (Only the fetch server)
COPY --from=source /src/src/fetch /app

# 4. Install Project Dependencies
RUN if [ -f uv.lock ]; then \
    uv sync --frozen --no-install-project; \
    elif [ -f pyproject.toml ]; then \
    uv venv && uv pip install -r pyproject.toml || uv sync; \
    elif [ -f requirements.txt ]; then \
    pip install -r requirements.txt; \
    fi

# 5. Configure
ENV PORT=8080
EXPOSE 8080

# 6. Run
CMD ["python", "targetly-adapter.py"]
