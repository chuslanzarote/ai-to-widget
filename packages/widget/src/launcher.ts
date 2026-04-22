import type { WidgetConfig } from "./config.js";
import { open } from "./state.js";

/**
 * Inject the floating launcher button. Toggles the chat panel's open
 * signal. Contract: specs/003-runtime/contracts/widget-config.md §2.
 */
export function mountLauncher(config: WidgetConfig, container: HTMLElement): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "atw-launcher";
  btn.setAttribute("aria-label", "Open chat");
  btn.setAttribute("data-position", config.launcherPosition);
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">' +
    '<path d="M4 4h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8l-6 4V6a2 2 0 0 1 2-2Z" ' +
    'fill="currentColor"/></svg>';
  btn.addEventListener("click", () => {
    open.value = !open.value;
  });
  container.appendChild(btn);
  return btn;
}
