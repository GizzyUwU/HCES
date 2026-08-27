#!/bin/sh
set -e
export GIT_COMMIT_SHA="$(git --git-dir=/usr/src/app/.git rev-parse HEAD 2>/dev/null || echo unknown)"
if [ "$WORKER" = "true" ] && [ -n "$ORCHESTRATOR_URL" ]; then
    exec su-exec bun bun run worker
else
    exec su-exec bun bun run dev
fi