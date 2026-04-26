// Demo-only shim (2026-04-25). Sits in front of atw_backend on port 3100,
// serves GET /tools from the static catalog below, proxies everything else
// to atw_backend on port 3101. Workaround for the broken IMAGE phase of
// /atw.build (see project_atw_post_009_friction.md item 5). Delete once the
// orchestrator scaffolds + vendors a self-contained build context.

import http from "node:http";

const TOOLS = {
  tools: [
    { name: "list_products",     requires_confirmation: false, summary_template: 'Searching catalog for "{q}"' },
    { name: "get_product",       requires_confirmation: false, summary_template: "Looking up product {id}" },
    { name: "get_cart",          requires_confirmation: false, summary_template: "Loading your cart" },
    { name: "add_cart_item",     requires_confirmation: true,  summary_template: "Adding {quantity} × product {product_id} to cart" },
    { name: "update_cart_item",  requires_confirmation: true,  summary_template: "Updating cart line {id} to quantity {quantity}" },
    { name: "remove_cart_item",  requires_confirmation: true,  summary_template: "Removing cart line {id}" },
    { name: "list_my_orders",    requires_confirmation: false, summary_template: "Loading your past orders" },
  ],
};

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "http://localhost:8080";
const UPSTREAM_HOST = "127.0.0.1";
const UPSTREAM_PORT = 3101;
const LISTEN_PORT = 3100;

function setCors(res, req) {
  const origin = req.headers.origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : "";
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-ATW-Session-Id");
  res.setHeader("Access-Control-Max-Age", "600");
}

const server = http.createServer((req, res) => {
  setCors(res, req);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, "http://localhost");
  if (req.method === "GET" && url.pathname === "/tools") {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.writeHead(200);
    res.end(JSON.stringify(TOOLS));
    return;
  }

  // Proxy everything else to atw_backend on UPSTREAM_PORT.
  const proxyReq = http.request(
    {
      host: UPSTREAM_HOST,
      port: UPSTREAM_PORT,
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: `${UPSTREAM_HOST}:${UPSTREAM_PORT}` },
    },
    (proxyRes) => {
      // Strip upstream CORS headers so ours win.
      const headers = { ...proxyRes.headers };
      delete headers["access-control-allow-origin"];
      delete headers["access-control-allow-methods"];
      delete headers["access-control-allow-headers"];
      delete headers["vary"];
      res.writeHead(proxyRes.statusCode ?? 502, headers);
      // Re-apply ours.
      setCors(res, req);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on("error", (err) => {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "upstream_unreachable", detail: err.message }));
  });
  req.pipe(proxyReq);
});

server.listen(LISTEN_PORT, () => {
  console.log(`[tools-shim] listening on :${LISTEN_PORT}, proxying → :${UPSTREAM_PORT} (origin allowed: ${ALLOWED_ORIGIN})`);
});
