---
framework: plain-html
backend_url: http://localhost:3100
auth_mode: bearer
bearer_storage_key: shop_auth_token
api_base_url: http://localhost:3200
login_url: http://localhost:8080/login
locale: en-US
---

# Embed answers

Captured on 2026-04-24.

The reference shop SPA (Vite + React, served by nginx from `demo/shop`) ships as
a plain HTML bundle, so the widget is loaded with a raw `<script>` + `<link>`
pair in `index.html`. Auth is bearer-JWT per FR-006 — the widget reads the
shopper's token from `localStorage['shop_auth_token']`, the single ownership
point defined at `demo/shop/frontend/src/auth/token.ts`.

Re-run `/atw.embed` to regenerate `embed-guide.md` after changing any of the
values above.
