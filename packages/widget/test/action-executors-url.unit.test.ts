/**
 * T051 — Unit test for URL / query / body template substitution.
 *
 * Covers contracts/widget-executor-engine.md §3 `buildRequestFromEntry`.
 *
 * The interpreter reduces each catalog entry + ActionIntent into a
 * plain {url, init} pair — no eval, no dynamic dispatch, just regex
 * substitution on a fixed placeholder syntax.  FR-015 says a missing
 * required argument MUST surface as a structured validationError,
 * not as a malformed HTTP request.
 */
import { describe, it, expect } from "vitest";
import { buildRequestFromEntry } from "../src/action-executors.js";
import type { WidgetConfig } from "../src/config.js";
import type { ActionIntent } from "@atw/scripts/dist/lib/types.js";
import type { ActionExecutorEntry } from "@atw/scripts/dist/lib/action-executors-types.js";

function cfg(overrides: Partial<WidgetConfig> = {}): WidgetConfig {
  return {
    backendUrl: "https://backend.example.com",
    apiBaseUrl: "https://shop.example.com",
    theme: "default",
    launcherPosition: "bottom-right",
    authMode: "cookie",
    locale: "en-US",
    allowedTools: ["add_to_cart", "list_carts", "delete_cart"],
    ...overrides,
  };
}

function intent(
  tool: string,
  args: Record<string, unknown> = {},
): ActionIntent {
  return {
    id: "act-1",
    tool,
    arguments: args,
    description: "",
    confirmation_required: true,
    http: { method: "POST", path: "/noop" },
    summary: {},
  };
}

const ADD_TO_CART_ENTRY: ActionExecutorEntry = {
  tool: "add_to_cart",
  method: "POST",
  pathTemplate: "/store/carts/{cart_id}/line-items",
  substitution: {
    path: { cart_id: "arguments.cart_id" },
    body: {
      variant_id: "arguments.variant_id",
      quantity: "arguments.quantity",
    },
    query: {},
  },
  headers: { "content-type": "application/json" },
  responseHandling: {
    successStatuses: [200, 201, 204],
    summaryTemplate: "Added {quantity} × {variant_id}.",
    summaryFields: [],
  },
};

const LIST_CARTS_ENTRY: ActionExecutorEntry = {
  tool: "list_carts",
  method: "GET",
  pathTemplate: "/store/carts",
  substitution: {
    path: {},
    body: {},
    query: { limit: "arguments.limit", status: "arguments.status" },
  },
  headers: {},
  responseHandling: {
    successStatuses: [200],
    summaryTemplate: "Found {count} carts.",
    summaryFields: [],
  },
};

const DELETE_CART_ENTRY: ActionExecutorEntry = {
  tool: "delete_cart",
  method: "DELETE",
  pathTemplate: "/store/carts/{cart_id}",
  substitution: {
    path: { cart_id: "arguments.cart_id" },
    body: {},
    query: {},
  },
  headers: {},
  responseHandling: {
    successStatuses: [200, 204],
    summaryTemplate: "Deleted cart {cart_id}.",
    summaryFields: [],
  },
};

describe("buildRequestFromEntry — path substitution (T051)", () => {
  it("substitutes {cart_id} from arguments.cart_id", () => {
    const r = buildRequestFromEntry(
      ADD_TO_CART_ENTRY,
      intent("add_to_cart", {
        cart_id: "cart_01ABC",
        variant_id: "var_X",
        quantity: 2,
      }),
      cfg(),
    );
    expect(r.validationError).toBeUndefined();
    expect(r.url).toBe(
      "https://shop.example.com/store/carts/cart_01ABC/line-items",
    );
    expect(r.init.method).toBe("POST");
  });

  it("URL-encodes path values containing reserved characters", () => {
    const r = buildRequestFromEntry(
      DELETE_CART_ENTRY,
      intent("delete_cart", { cart_id: "cart with/slash?bang" }),
      cfg(),
    );
    expect(r.validationError).toBeUndefined();
    expect(r.url).toContain(encodeURIComponent("cart with/slash?bang"));
    expect(r.url).not.toContain(" ");
    expect(r.url).not.toContain("?bang");
  });

  it("missing required path argument → structured validationError (FR-015)", () => {
    const r = buildRequestFromEntry(
      ADD_TO_CART_ENTRY,
      intent("add_to_cart", {
        // no cart_id
        variant_id: "var_X",
        quantity: 2,
      }),
      cfg(),
    );
    expect(r.validationError).toBeTruthy();
    expect(r.validationError).toMatch(/cart_id/);
  });

  it("strips trailing slash from apiBaseUrl before joining", () => {
    const r = buildRequestFromEntry(
      ADD_TO_CART_ENTRY,
      intent("add_to_cart", {
        cart_id: "c1",
        variant_id: "v1",
        quantity: 1,
      }),
      cfg({ apiBaseUrl: "https://shop.example.com/" }),
    );
    expect(r.url).toBe("https://shop.example.com/store/carts/c1/line-items");
  });
});

describe("buildRequestFromEntry — query substitution (T051)", () => {
  it("GET with limit and status → query string built, no body", () => {
    const r = buildRequestFromEntry(
      LIST_CARTS_ENTRY,
      intent("list_carts", { limit: 10, status: "open" }),
      cfg(),
    );
    expect(r.validationError).toBeUndefined();
    expect(r.init.method).toBe("GET");
    expect(r.init.body).toBeUndefined();
    // Query params may be in any URL-safe order; assert presence of both.
    expect(r.url).toContain("limit=10");
    expect(r.url).toContain("status=open");
    expect(r.url.startsWith("https://shop.example.com/store/carts?")).toBe(
      true,
    );
  });

  it("GET with only one query param present → other is omitted", () => {
    const r = buildRequestFromEntry(
      LIST_CARTS_ENTRY,
      intent("list_carts", { limit: 5 }),
      cfg(),
    );
    expect(r.validationError).toBeUndefined();
    expect(r.url).toContain("limit=5");
    expect(r.url).not.toContain("status=");
  });

  it("GET with no query params present → URL has no trailing '?'", () => {
    const r = buildRequestFromEntry(
      LIST_CARTS_ENTRY,
      intent("list_carts", {}),
      cfg(),
    );
    expect(r.validationError).toBeUndefined();
    expect(r.url).toBe("https://shop.example.com/store/carts");
  });
});

describe("buildRequestFromEntry — body substitution (T051)", () => {
  it("POST body is JSON-serialised from arguments by field mapping", () => {
    const r = buildRequestFromEntry(
      ADD_TO_CART_ENTRY,
      intent("add_to_cart", {
        cart_id: "c1",
        variant_id: "var_X",
        quantity: 2,
      }),
      cfg(),
    );
    expect(r.validationError).toBeUndefined();
    expect(typeof r.init.body).toBe("string");
    const body = JSON.parse(r.init.body as string) as Record<string, unknown>;
    expect(body).toEqual({ variant_id: "var_X", quantity: 2 });
    // cart_id went to the PATH, not the body.
    expect(body.cart_id).toBeUndefined();
  });

  it("POST omits body fields whose resolved value is undefined", () => {
    const r = buildRequestFromEntry(
      ADD_TO_CART_ENTRY,
      intent("add_to_cart", { cart_id: "c1", variant_id: "var_X" }),
      cfg(),
    );
    // quantity missing but optional for this test — required enforcement
    // is separately covered by a catalog `required` annotation test
    // (deferred to full contract impl); here we assert body omits the
    // undefined field.
    expect(r.validationError).toBeUndefined();
    const body = JSON.parse(r.init.body as string) as Record<string, unknown>;
    expect(body).toEqual({ variant_id: "var_X" });
  });

  it("GET/HEAD → body is undefined regardless of substitution.body", () => {
    // Synthetic: a GET whose catalog accidentally declares body fields.
    // The interpreter must NOT send a body on GET.
    const weird: ActionExecutorEntry = {
      ...LIST_CARTS_ENTRY,
      substitution: {
        ...LIST_CARTS_ENTRY.substitution,
        body: { should_not_appear: "arguments.limit" },
      },
    };
    const r = buildRequestFromEntry(
      weird,
      intent("list_carts", { limit: 5 }),
      cfg(),
    );
    expect(r.init.body).toBeUndefined();
  });
});

describe("buildRequestFromEntry — headers (T051)", () => {
  it("POST with content-type in catalog → header preserved", () => {
    const r = buildRequestFromEntry(
      ADD_TO_CART_ENTRY,
      intent("add_to_cart", {
        cart_id: "c1",
        variant_id: "v1",
        quantity: 1,
      }),
      cfg(),
    );
    const h = r.init.headers as Record<string, string>;
    expect(h["content-type"] ?? h["Content-Type"]).toBe("application/json");
  });

  it("cookie authMode → credentials: 'include' on init", () => {
    const r = buildRequestFromEntry(
      ADD_TO_CART_ENTRY,
      intent("add_to_cart", {
        cart_id: "c1",
        variant_id: "v1",
        quantity: 1,
      }),
      cfg({ authMode: "cookie" }),
    );
    expect(r.init.credentials).toBe("include");
  });

  it("GET catalog entry with no headers → headers object is empty-ish (no credential keys)", () => {
    const r = buildRequestFromEntry(
      LIST_CARTS_ENTRY,
      intent("list_carts", { limit: 5 }),
      cfg(),
    );
    const h = (r.init.headers ?? {}) as Record<string, string>;
    expect(h["Authorization"]).toBeUndefined();
    expect(h["authorization"]).toBeUndefined();
    expect(h["Cookie"]).toBeUndefined();
    expect(h["cookie"]).toBeUndefined();
  });
});
