# syntax=docker/dockerfile:1.6
#
# T062 / US4 — Aurelia demo storefront.
# Contract: specs/003-runtime/contracts/compose.md §1.4, §3 (Option A).
#
# Static HTML served by nginx. The Medusa publishable key is a RUNTIME env
# (not a build arg): entrypoint substitutes it into index.html on container
# start, so rotating the key only requires a restart — no rebuild, no cache
# of a stale PK in the bundle.
#
# Widget assets (widget.js, widget.css) are copied in at build time from
# demo/medusa/storefront/public/ (staged by `make stage-widget`).

FROM nginx:1.27-alpine

# Drop the default nginx welcome page.
RUN rm -f /usr/share/nginx/html/*

# Static HTML template with ${MEDUSA_PUBLISHABLE_KEY} and ${MEDUSA_BACKEND_URL}
# placeholders. envsubst resolves them at container start.
COPY index.html.template /etc/aurelia/index.html.template

# Widget bundle, served at /widget.js and /widget.css. `make stage-widget`
# either copies the real build from dist/ or writes a stub here.
COPY public/widget.js /usr/share/nginx/html/widget.js
COPY public/widget.css /usr/share/nginx/html/widget.css

# Feature 006 — declarative action catalog served at /action-executors.json.
# Same-origin with the widget bundle so the widget's loader validates the
# URL and fetches it with `credentials: "omit"`. `make stage-widget` copies
# it from demo/atw-aurelia/.atw/artifacts/action-executors.json, or writes
# a `{"version":1,"credentialMode":"same-origin-cookies","actions":[]}`
# stub so the widget boots chat-only when the Builder hasn't run yet.
COPY public/action-executors.json /usr/share/nginx/html/action-executors.json

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000

# Nginx listens on 80 by default; the entrypoint generates a minimal
# server block on :8000 so the compose port mapping is a straight pass-through.
CMD ["/entrypoint.sh"]
