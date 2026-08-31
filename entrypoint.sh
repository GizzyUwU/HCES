#!/bin/sh
set -e
export GIT_COMMIT_SHA="$(git --git-dir=/usr/src/app/.git rev-parse HEAD 2>/dev/null || echo unknown)"
if [ "$WORKER" = "true" ] && [ -n "$ORCHESTRATOR_URL" ]; then
    exec gosu bun bun run prod:worker
elif [ "$SERVICE" = "frontend" ]; then
    exec gosu bun bun run prod:frontend
else
    exec gosu bun bun run prod:backend
fi