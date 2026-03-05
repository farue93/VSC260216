FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner

RUN apk add --no-cache nginx

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV LEAD_APP_DB_PATH=/var/lib/lead-app/lead-app.db

COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
RUN cp -r /app/public/. /app/dist/client/

COPY nginx.conf /etc/nginx/nginx.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

RUN mkdir -p /var/lib/lead-app
VOLUME ["/var/lib/lead-app"]

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/ >/dev/null || exit 1

CMD ["/docker-entrypoint.sh"]
