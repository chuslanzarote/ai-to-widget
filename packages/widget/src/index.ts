import { render, h } from "preact";
import { readConfigFromAttributes } from "./config.js";
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
function init(): void {
  const script =
    (document.currentScript as HTMLScriptElement | null) ??
    document.querySelector("script[data-backend-url]");
  if (!script) {
    // eslint-disable-next-line no-console
    console.error("[atw] widget script tag not found");
    return;
  }
  const allowedToolsAttr = script.getAttribute("data-allowed-tools") ?? "";
  const allowedTools = allowedToolsAttr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
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
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
