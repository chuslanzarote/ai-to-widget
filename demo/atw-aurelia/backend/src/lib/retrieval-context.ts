import type { RetrievalHit } from "./retrieval.js";

/**
 * Format retrieved entities as an XML-tagged context block for the model.
 * Source: specs/003-runtime/contracts/chat-endpoint.md §4 bottom.
 */
export function formatRetrievalContext(hits: RetrievalHit[]): string {
  if (hits.length === 0) {
    return "<context>\n  <empty/>\n</context>";
  }
  const entities = hits.map((hit) => {
    const facts = hit.facts
      .map(
        (f) =>
          `      <fact source="${escapeAttr(f.source)}">${escapeText(f.claim)}</fact>`,
      )
      .join("\n");
    const categories = Object.entries(hit.categories)
      .flatMap(([axis, labels]) =>
        labels.map(
          (label) =>
            `      <category axis="${escapeAttr(axis)}">${escapeText(label)}</category>`,
        ),
      )
      .join("\n");
    return (
      `  <entity type="${escapeAttr(hit.entity_type)}" id="${escapeAttr(
        hit.entity_id,
      )}" similarity="${hit.similarity.toFixed(3)}">\n` +
      `    <document>${escapeText(hit.document)}</document>\n` +
      `    <facts>\n${facts}\n    </facts>\n` +
      `    <categories>\n${categories}\n    </categories>\n` +
      `  </entity>`
    );
  });
  return `<context>\n${entities.join("\n")}\n</context>`;
}

function escapeAttr(v: string): string {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeText(v: string): string {
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
