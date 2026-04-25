/** @jsxImportSource preact */
import type { JSX } from "preact";
import { turns } from "./state.js";
import { renderMarkdown } from "./markdown.js";
import type { WidgetConfig } from "./config.js";

export function MessageList(props: {
  config: WidgetConfig;
  intro?: string;
}): JSX.Element {
  const list = turns.value;
  if (list.length === 0 && props.intro) {
    return (
      <div class="atw-empty" role="status">
        {props.intro}
      </div>
    );
  }
  return (
    <div class="atw-messages" role="log" aria-live="polite">
      {list.map((t, idx) => {
        if (t.role === "user") {
          return (
            <div class="atw-turn atw-turn--user" key={idx}>
              <div class="atw-bubble">{t.content}</div>
            </div>
          );
        }
        const html = renderMarkdown(t.content);
        return (
          <div class="atw-turn atw-turn--assistant" key={idx}>
            <div class="atw-bubble" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        );
      })}
    </div>
  );
}
