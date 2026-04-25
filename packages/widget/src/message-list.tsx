/** @jsxImportSource preact */
import type { JSX } from "preact";
import { turns, thinking } from "./state.js";
import { renderMarkdown } from "./markdown.js";
import type { WidgetConfig } from "./config.js";
import type { Citation } from "@atw/scripts/dist/lib/types.js";

export interface AssistantTurnPayload {
  citations?: Citation[];
}

const turnCitations = new WeakMap<object, Citation[]>();

/**
 * Attach citation metadata to the next assistant turn. Used by the panel
 * after a successful backend reply.
 */
export function attachCitationsToLastAssistantTurn(citations: Citation[]): void {
  const list = turns.value;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].role === "assistant") {
      turnCitations.set(list[i] as unknown as object, citations);
      return;
    }
  }
}

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
        // FR-027: citations are not rendered as clickable pills until a
        // proper client-routing integration exists. The data still flows
        // (turnCitations WeakMap is populated by the panel) so a future
        // routing feature can re-introduce a non-pill UI without touching
        // the data path.
        const html = renderMarkdown(t.content);
        return (
          <div class="atw-turn atw-turn--assistant" key={idx}>
            <div class="atw-bubble" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        );
      })}
      {thinking.value ? (
        <div
          class="atw-turn atw-turn--assistant atw-thinking"
          role="status"
          aria-live="polite"
        >
          <div class="atw-bubble atw-thinking__bubble">
            <span class="atw-thinking__dot" aria-hidden="true">•</span>
            <span class="atw-thinking__dot" aria-hidden="true">•</span>
            <span class="atw-thinking__dot" aria-hidden="true">•</span>
            <span class="atw-visually-hidden">Assistant is thinking…</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
