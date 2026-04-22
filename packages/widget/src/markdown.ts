import { marked } from "marked";
import DOMPurify from "dompurify";

/**
 * Sanitised markdown renderer.
 * Contract: specs/003-runtime/contracts/widget-config.md §7;
 * research §9.
 *
 * The allowlist is tight by design — no images, no raw HTML, no inline
 * event handlers. Citations are rendered by our own code and do NOT rely
 * on markdown `<a>` parsing.
 */
marked.setOptions({ gfm: true, breaks: false });

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "code",
  "pre",
  "ul",
  "ol",
  "li",
  "a",
  "blockquote",
];

const ALLOWED_ATTR = ["href", "title", "class"];

const ALLOWED_URI_SCHEMES = /^(?:https?|mailto):/i;

export function renderMarkdown(source: string): string {
  const html = marked.parse(source, { async: false }) as string;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: ALLOWED_URI_SCHEMES,
    FORBID_ATTR: ["style", "onerror", "onclick"],
    KEEP_CONTENT: true,
    RETURN_TRUSTED_TYPE: false,
  });
}
