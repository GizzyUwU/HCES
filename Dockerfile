FROM oven/bun:debian
WORKDIR /usr/src/app
RUN apt-get update && apt-get install -y --no-install-recommends curl wget gosu jq git \
    && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 https://github.com/gizzyuwu/hces.git /usr/src/app
RUN bun install
RUN chown bun:bun /usr/src/app
RUN chmod +x /usr/src/app/entrypoint.sh
EXPOSE 8000/tcp
EXPOSE 3000/tcp
ENTRYPOINT ["/usr/src/app/entrypoint.sh"]