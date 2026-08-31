FROM oven/bun:alpine AS builder
WORKDIR /usr/src/app
COPY . .
RUN bun install --lockfile-only
RUN bun install --production
RUN bun run build:frontend

FROM nginx:latest AS runner
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000/tcp
CMD ["nginx", "-g", "daemon off;"]