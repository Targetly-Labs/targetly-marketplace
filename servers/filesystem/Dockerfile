# Official Targetly Image for MCP Filesystem Server
# Usage: docker run -p 8080:8080 -v /path/to/data:/data targetly/mcp-filesystem /data

# --------------------------------------------------------
# Stage 1: Fetch Source
# --------------------------------------------------------
FROM alpine/git AS source
WORKDIR /src
RUN git clone https://github.com/modelcontextprotocol/servers.git .

# --------------------------------------------------------
# Stage 2: Build & Runtime
# --------------------------------------------------------
FROM node:18-alpine

WORKDIR /app

# 1. Install Adapter Dependencies (layer cache optimized)
RUN npm install express @modelcontextprotocol/sdk --legacy-peer-deps

# 2. Copy Targetly Adapter from build context (the repo root)
# Rename to .cjs to force CommonJS execution
COPY adapters/targetly-adapter.js /app/targetly-adapter.cjs

# 3. Copy Source Code from Stage 1 (Only the filesystem server)
COPY --from=source /src/src/filesystem /app

# 4. Install Project Dependencies
# Robust install logic for monorepo extraction
RUN if [ -f yarn.lock ]; then yarn install --ignore-scripts; \
    elif [ -f pnpm-lock.yaml ]; then npm install -g pnpm && pnpm install --ignore-scripts; \
    else npm install --legacy-peer-deps --ignore-scripts; \
    fi

# 5. Fix TSConfig for isolated build (if needed)
RUN mkdir -p dist build && \
    mv tsconfig.json tsconfig.orig.json 2>/dev/null || true && \
    echo '{"compilerOptions":{"target":"es2022","module":"nodenext","moduleResolution":"nodenext","esModuleInterop":true,"skipLibCheck":true,"strict":false,"outDir":"dist","resolveJsonModule":true}}' > tsconfig.json

# 6. Build
RUN if grep -q '"build":' package.json; then npm run build; fi

# 7. Configure
ENV PORT=8080
ENV TARGETLY_MCP_SERVER_SCRIPT=dist/index.js
EXPOSE 8080

# 8. Run
# The adapter will use the ENV var to find the script
ENTRYPOINT ["node", "targetly-adapter.cjs"]
