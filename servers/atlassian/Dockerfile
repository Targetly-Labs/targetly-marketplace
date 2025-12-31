FROM mcp/atlassian:latest
USER root
# Install pip (Alpine)
RUN apk add --no-cache py3-pip
WORKDIR /app
# Install deps into the existing venv (using global pip which targets global site-packages, 
# but we can try targeting venv or just rely on global availability if venv uses system-site-packages? 
# Actually, the venv python symlinks to global python. Let's trying installing to venv site-packages using --python?)
# Simpler: Just install packages globally/user level and run adapter with global python? 
# No, we want to run the original app which uses venv.
# Let's install packages into the venv using `uv` if possible, or just `pip`.
# If `python` points to global python, `pip` installs to global.
# The `atlassian` app runs `mcp-atlassian` from venv.
# Our adapter uses `fastapi`.
# We launch adapter with `python targetly-adapter.py`.
# If we use venv python, it sees venv packages.
# Let's install adapter deps into the venv.
# Since we installed `py3-pip`, we have `pip`.
# `python -m pip install` using the venv python?
# But `python` in venv is symlink to global.
# Let's try: `RUN /app/.venv/bin/python -m ensurepip` (if available) or just `RUN pip install ...` after apk add.
# If we run `pip install`, it installs to global.
# We can add global site-packages to PYTHONPATH?
# Or just install to venv if we can.
# Let's try `RUN apk add --no-cache py3-pip && pip install "fastapi[standard]" uvicorn sse-starlette --break-system-packages`
# And ensure adapter runs with `python` (which might default to global). 
# If `mcp-atlassian` needs venv, we set `PATH=/app/.venv/bin:$PATH`.
# The base image already sets PATH.
# So `python` IS `/app/.venv/bin/python` (which is symlink to global).
# But if we install global pip, `pip` is in `/usr/bin/pip`.
# `pip install` will install to `/usr/lib/python...`.
# Will `/app/.venv/bin/python` see it? Only if venv was created with system-site-packages (unlikely).
# Solution: Install dependencies via `pip` but force target?
# Or: `apk add --no-cache py3-pip` then `/app/.venv/bin/python -m pip install ...`? 
# Wait, `python -m pip` invokes pip module. If pip is installed globally, can venv python find it? 
# Yes if system-site-packages. If not, no.
# Let's assume we can install into venv by activating it?
# RUN source /app/.venv/bin/activate && pip install ...
# But we need pip first.
# Let's try installing `pip` into the venv using `ensurepip`.
RUN /app/.venv/bin/python -m ensurepip || apk add --no-cache py3-pip
RUN /app/.venv/bin/python -m pip install "fastapi[standard]" uvicorn sse-starlette --break-system-packages || \
    pip install "fastapi[standard]" uvicorn sse-starlette --break-system-packages
COPY adapters/targetly-adapter.py /app/targetly-adapter.py
ENV PORT=8080
ENV TARGETLY_MCP_CMD="mcp-atlassian"
EXPOSE 8080
ENTRYPOINT []
CMD ["python", "targetly-adapter.py"]
