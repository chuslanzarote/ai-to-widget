/** @jsxImportSource preact */
import type { JSX } from "preact";
import { turns } from "./state.js";
import { renderMarkdown } from "./markdown.js";
import type { WidgetConfig } from "./config.js";
import { resolveCitationHref } from "./config.js";
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
        const citations = turnCitations.get(t as unknown as object) ?? [];
        const html = renderMarkdown(t.content);
        return (
          <div class="atw-turn atw-turn--assistant" key={idx}>
            <div class="atw-bubble" dangerouslySetInnerHTML={{ __html: html }} />
            {citations.length > 0 ? (
              <div class="atw-citations">
                {citations.map((c) => {
                  const href = resolveCitationHref(c, props.config);
                  return (
                    <a
                      key={c.entity_type + "/" + c.entity_id}
                      class="atw-citation"
                      href={href ?? "#"}
                      target="_self"
                      rel="noopener"
                    >
                      {c.title ?? `${c.entity_type}/${c.entity_id}`}
                    </a>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
