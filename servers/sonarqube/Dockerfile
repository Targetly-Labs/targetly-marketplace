FROM mcp/sonarqube:latest
USER root
# Install Python for the adapter (Alpine based)
RUN apk add --no-cache python3 py3-pip
WORKDIR /app
# Install adapter deps (using --break-system-packages if needed on newer variants, or venv)
# Alpine handles python packages via pip nicely usually, or requires --break-system-packages
RUN python3 -m pip install "fastapi[standard]" uvicorn sse-starlette --break-system-packages || \
    python3 -m pip install "fastapi[standard]" uvicorn sse-starlette
COPY adapters/targetly-adapter.py /app/targetly-adapter.py
ENV PORT=8080
# The original entrypoint was: /bin/sh -c /usr/local/bin/install-certificates && exec java -jar /app/sonarqube-mcp-server.jar
# We need to wrap THIS command.
ENV TARGETLY_MCP_CMD="/bin/sh -c '/usr/local/bin/install-certificates && exec java -jar /app/sonarqube-mcp-server.jar'"
EXPOSE 8080
ENTRYPOINT []
CMD ["python3", "targetly-adapter.py"]
