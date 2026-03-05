#!/bin/sh
set -e
cd /app

# TanStack Start's server bundle exports a fetch handler.
# srvx turns it into a running HTTP server on $PORT.
./node_modules/.bin/srvx dist/server/server.js --port "${PORT:-3000}" &
APP_PID=$!
sleep 1

if ! kill -0 "$APP_PID" 2>/dev/null; then
  echo "Application server failed to start" >&2
  exit 1
fi

exec nginx -g 'daemon off;'
