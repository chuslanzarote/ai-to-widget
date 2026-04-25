import { render, h } from "preact";
import { readConfigFromAttributes } from "./config.js";
import { loadExecutorsCatalog } from "./action-executors.js";
import { mountLauncher } from "./launcher.js";
import { ChatPanel } from "./panel.js";
import "./styles.css";

/**
 * Widget entry point. Source:
 * specs/003-runtime/contracts/widget-config.md §1.
 *
 * Fails loud and stays silent network-wise when required `data-*` attrs
 * are missing — the Builder sees a console error instead of a launcher
 * that silently breaks.
 */
async function fetchToolCatalog(backendUrl: string): Promise<string[]> {
  // FR-015: the widget fetches its tool allowlist from the backend at
  // boot. If `/tools` is missing or unreachable the widget warns once
  // and falls back to the empty allowlist (the spec edge case).
  try {
    const res = await fetch(backendUrl.replace(/\/$/, "") + "/tools", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[atw] /tools returned HTTP ${res.status}; allowlist empty.`);
      return [];
    }
    const body = (await res.json()) as { tools?: Array<{ name?: string }> };
    return Array.isArray(body.tools)
      ? body.tools
          .map((t) => (typeof t?.name === "string" ? t.name : ""))
          .filter((s) => s.length > 0)
      : [];
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[atw] /tools fetch failed; allowlist empty:", err);
    return [];
  }
}

async function init(): Promise<void> {
  const script =
    (document.currentScript as HTMLScriptElement | null) ??
    document.querySelector("script[data-backend-url]");
  if (!script) {
    // eslint-disable-next-line no-console
    console.error("[atw] widget script tag not found");
    return;
  }
  const backendUrl = script.getAttribute("data-backend-url") ?? "";
  const allowedTools = await fetchToolCatalog(backendUrl);
  const result = readConfigFromAttributes(script.dataset, {
    apiBaseUrl: window.location.origin,
    locale: navigator.language,
    allowedTools,
  });
  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.error(
      "[atw] widget configuration invalid — launcher disabled:",
      result.issues,
    );
    const stub = document.createElement("button");
    stub.type = "button";
    stub.className = "atw-launcher";
    stub.disabled = true;
    stub.setAttribute("aria-label", "Chat unavailable — see console for details.");
    stub.title = result.issues.map((i) => i.message).join("\n");
    document.body.appendChild(stub);
    return;
  }

  const config = result.config;

  // Fire-and-forget catalog load so action execution is ready by the
  // time the shopper confirms a card. The loader never throws — it
  // falls back to chat-only on any error (see action-executors.ts).
  // T076: belt-and-braces .catch() hardens against a future refactor
  // that drops the internal try/catch; a rejection here must never
  // abort the bootstrap.
  loadExecutorsCatalog(config).catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.warn("[atw] catalog load rejected unexpectedly", err);
  });

  // Root container for the Preact panel.
  const root = document.createElement("div");
  root.className = "atw-root";
  root.setAttribute("data-atw-root", "");
  document.body.appendChild(root);

  mountLauncher(config, document.body);

  render(h(ChatPanel, { config }), root);

  (window as unknown as { AtwWidget?: { version: string } }).AtwWidget = {
    version: "0.3.0",
  };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void init();
  });
} else {
  void init();
}
