/**
 * Tool descriptors rendered at build time from
 * `.atw/artifacts/action-manifest.md`.
 *
 * Feature 007 collapses the safe-read / action split: every tool is
 * executed by the widget over the shop API with the shopper's bearer
 * token. `is_action` is kept only to decide whether the emitted
 * `ActionIntent` carries `confirmation_required: true` (writes) or
 * `false` (reads).
 *
 * Source: specs/007-widget-tool-loop/contracts/chat-endpoint-v2.md.
 */
import type Anthropic from "@anthropic-ai/sdk";

export interface RuntimeToolDescriptor {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  http: { method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; path: string };
  /** True for writes (POST/PUT/PATCH/DELETE) — drives confirmation UI. */
  is_action: boolean;
  /** Human-readable template for the confirmation-card description. */
  description_template?: string;
  summary_fields?: string[];
}

export const RUNTIME_TOOLS: RuntimeToolDescriptor[] = [
  {
    "name": "add_cart_item",
    "description": "Add a product to the cart (merge-by-product).",
    "input_schema": {
      "properties": {},
      "required": [],
      "type": "object"
    },
    "http": {
      "method": "POST",
      "path": "/cart/items"
    },
    "is_action": true
  },
  {
    "name": "get_cart",
    "description": "Get the shopper's active cart (lazy-created).",
    "input_schema": {
      "properties": {},
      "required": [],
      "type": "object"
    },
    "http": {
      "method": "GET",
      "path": "/cart"
    },
    "is_action": false
  },
  {
    "name": "remove_cart_item",
    "description": "Remove a line item from the cart.",
    "input_schema": {
      "properties": {
        "id": {
          "format": "uuid",
          "type": "string"
        }
      },
      "required": [
        "id"
      ],
      "type": "object"
    },
    "http": {
      "method": "DELETE",
      "path": "/cart/items/{id}"
    },
    "is_action": true
  },
  {
    "name": "update_cart_item",
    "description": "Set the quantity of a cart line item. Quantity 0 removes the line.",
    "input_schema": {
      "properties": {
        "id": {
          "format": "uuid",
          "type": "string"
        }
      },
      "required": [
        "id"
      ],
      "type": "object"
    },
    "http": {
      "method": "PATCH",
      "path": "/cart/items/{id}"
    },
    "is_action": true
  },
  {
    "name": "get_my_profile",
    "description": "Return the authenticated shopper's profile.",
    "input_schema": {
      "properties": {},
      "required": [],
      "type": "object"
    },
    "http": {
      "method": "GET",
      "path": "/customers/me"
    },
    "is_action": false
  },
  {
    "name": "list_my_orders",
    "description": "List the shopper's past orders, newest first.",
    "input_schema": {
      "properties": {},
      "required": [],
      "type": "object"
    },
    "http": {
      "method": "GET",
      "path": "/orders"
    },
    "is_action": false
  },
  {
    "name": "get_product",
    "description": "Get one product by its UUID.",
    "input_schema": {
      "properties": {
        "id": {
          "format": "uuid",
          "type": "string"
        }
      },
      "required": [
        "id"
      ],
      "type": "object"
    },
    "http": {
      "method": "GET",
      "path": "/products/{id}"
    },
    "is_action": false
  },
  {
    "name": "list_products",
    "description": "List all products, optionally filtered by q substring.",
    "input_schema": {
      "properties": {
        "q": {
          "type": "string"
        }
      },
      "required": [],
      "type": "object"
    },
    "http": {
      "method": "GET",
      "path": "/products"
    },
    "is_action": false
  }
];

/** Every declared tool — Feature 007 executes them all in the widget. */
export const ACTION_TOOLS: string[] = RUNTIME_TOOLS.map((t) => t.name);

export function toolsForAnthropic(): Anthropic.Messages.Tool[] {
  return RUNTIME_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Messages.Tool["input_schema"],
  }));
}

export function findTool(name: string): RuntimeToolDescriptor | undefined {
  return RUNTIME_TOOLS.find((t) => t.name === name);
}
