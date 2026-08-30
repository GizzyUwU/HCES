FROM oven/bun:alpine
WORKDIR /usr/src/app
RUN apk add curl wget su-exec jq git --no-cache
RUN git clone --depth 1 https://github.com/gizzyuwu/hces.git /usr/src/app
RUN set -eux; \
    echo "=== RUNNING BUN INSTALL ==="; \
    bun install --frozen-lockfile --production > /tmp/bun-install.log 2>&1 || { \
        status=$?; \
        echo "=== BUN INSTALL FAILED: exit code $status ==="; \
        cat /tmp/bun-install.log; \
        exit "$status"; \
    }; \
    cat /tmp/bun-install.log
RUN chown bun:bun /usr/src/app
RUN chmod +x /usr/src/app/entrypoint.sh
EXPOSE 8000/tcp
EXPOSE 3000/tcp
ENTRYPOINT ["/usr/src/app/entrypoint.sh"]