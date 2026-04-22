#!/bin/sh
# Aurelia demo storefront entrypoint.
#
# Renders the index.html template with runtime env vars, writes a minimal
# nginx server block on :8000, and execs nginx in the foreground.
#
# Publishable-key resolution order:
#   1. MEDUSA_PUBLISHABLE_KEY env (explicit override, e.g. `make fresh`)
#   2. /runtime/publishable-key.txt (written by the backend seed — shared
#      volume with medusa_backend, so `make demo` works without pre-setting
#      the env var)
set -e

PK_FILE=/runtime/publishable-key.txt
if [ -z "$MEDUSA_PUBLISHABLE_KEY" ] && [ -s "$PK_FILE" ]; then
  MEDUSA_PUBLISHABLE_KEY="$(tr -d '[:space:]' < "$PK_FILE")"
fi

if [ -z "$MEDUSA_PUBLISHABLE_KEY" ]; then
  echo "ERROR: MEDUSA_PUBLISHABLE_KEY is unset and $PK_FILE is missing/empty."
  echo "       Run 'make fresh' (or 'make demo') so the backend seed mints one."
  exit 1
fi

: "${MEDUSA_BACKEND_URL:=http://localhost:9000}"
: "${ATW_BACKEND_URL:=http://localhost:3100}"

export MEDUSA_PUBLISHABLE_KEY MEDUSA_BACKEND_URL ATW_BACKEND_URL

envsubst '${MEDUSA_PUBLISHABLE_KEY} ${MEDUSA_BACKEND_URL} ${ATW_BACKEND_URL}' \
  < /etc/aurelia/index.html.template \
  > /usr/share/nginx/html/index.html

cat > /etc/nginx/conf.d/default.conf <<'EOF'
server {
  listen 8000;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  # Widget assets — no cache so redeploys of dist/ land immediately.
  location ~ ^/widget\.(js|css)$ {
    add_header Cache-Control "no-store" always;
  }
}
EOF

exec nginx -g 'daemon off;'
