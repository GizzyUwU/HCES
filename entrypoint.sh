#!/bin/sh
set -e
export GIT_COMMIT_SHA="$(git --git-dir=/usr/src/app/.git rev-parse HEAD 2>/dev/null || echo unknown)"
su-exec bun bun run prod:backend
