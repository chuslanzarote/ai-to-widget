import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../src/markdown.js";

/**
 * T041 — widget markdown sanitiser contract (research §9, widget-config §7).
 */
describe("renderMarkdown (T041)", () => {
  it("renders basic markdown", () => {
    const html = renderMarkdown("**hello** _world_");
    expect(html).toMatch(/<strong>hello<\/strong>/);
    expect(html).toMatch(/<em>world<\/em>/);
  });

  it("strips <script> tags", () => {
    const html = renderMarkdown("before<script>alert(1)</script>after");
    expect(html).not.toMatch(/<script/);
    expect(html).not.toMatch(/alert\(1\)/);
    expect(html).toMatch(/before/);
    expect(html).toMatch(/after/);
  });

  it("refuses javascript: URIs", () => {
    const html = renderMarkdown("[x](javascript:alert(1))");
    expect(html).not.toMatch(/javascript:/i);
  });

  it("refuses inline event handlers via raw HTML", () => {
    const html = renderMarkdown('<a href="#" onclick="alert(1)">x</a>');
    expect(html).not.toMatch(/onclick/);
    expect(html).not.toMatch(/alert\(1\)/);
  });

  it("allows http and mailto anchors", () => {
    const http = renderMarkdown("[ok](https://example.com)");
    expect(http).toMatch(/href="https:\/\/example\.com"/);
    const mailto = renderMarkdown("[ok](mailto:a@b.com)");
    expect(mailto).toMatch(/href="mailto:a@b\.com"/);
  });

  it("does not allow images", () => {
    const html = renderMarkdown("![alt](https://example.com/x.png)");
    expect(html).not.toMatch(/<img/);
  });
});
