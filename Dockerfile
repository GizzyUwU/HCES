FROM oven/bun:alpine
WORKDIR /usr/src/app
RUN apk add curl wget su-exec jq git --no-cache
RUN git clone --depth 1 https://github.com/gizzyuwu/hces.git /usr/src/app
RUN bun install --production
RUN chown bun:bun /usr/src/app
RUN chmod +x /usr/src/app/entrypoint.sh
EXPOSE 8000/tcp
EXPOSE 3000/tcp
ENTRYPOINT ["/usr/src/app/entrypoint.sh"]