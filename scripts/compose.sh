#!/usr/bin/env sh
# Runs Docker Compose with whichever command this machine has ("docker compose" or the older "docker-compose").
if docker compose version >/dev/null 2>&1; then exec docker compose "$@"; fi
if command -v docker-compose >/dev/null 2>&1; then exec docker-compose "$@"; fi
echo "Docker Compose is not installed." >&2; exit 1
