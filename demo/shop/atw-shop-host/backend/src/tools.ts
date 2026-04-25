/**
 * Tool descriptors rendered at build time from
 * `.atw/artifacts/action-manifest.md` (Feature 009 schema). Keep the split
 * between safe-read and action tools strict — the runtime uses it to
 * decide whether to execute server-side or to emit an action intent for
 * the widget. The split is now driven by `requires_confirmation` (writes
 * that mutate state) rather than a hand-maintained `is_action` flag.
 *
 * Source: specs/009-demo-guide-hardening/contracts/action-manifest.schema.json.
 */
import type Anthropic from "@anthropic-ai/sdk";

export interface RuntimeToolDescriptor {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  http: { method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; path_template: string };
  /** Mirrors manifest.operations[].requires_confirmation. */
  requires_confirmation: boolean;
  /** Substitution template for the ActionCard title (FR-022). */
  summary_template: string;
}

export const RUNTIME_TOOLS: RuntimeToolDescriptor[] = [
  {
    "name": "list_products",
    "description": "List catalog products, optionally filtered by a substring query (e.g. origin, varietal, process, roast, brew method, or sensory descriptor). Use this to search the coffee catalog and to power recommendations and comparisons.",
    "input_schema": {
      "type": "object",
      "properties": {
        "q": {
          "type": "string",
          "description": "Optional substring filter applied to product fields."
        }
      },
      "required": []
    },
    "http": {
      "method": "GET",
      "path_template": "/products"
    },
    "requires_confirmation": false,
    "summary_template": "Searching catalog for \"{q}\""
  },
  {
    "name": "get_product",
    "description": "Get full details for a single product by UUID. Use this to look up any information about a specific coffee (origin, description, price, stock) and to ground comparisons or recommendations.",
    "input_schema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "description": "Product UUID."
        }
      },
      "required": [
        "id"
      ]
    },
    "http": {
      "method": "GET",
      "path_template": "/products/{id}"
    },
    "requires_confirmation": false,
    "summary_template": "Looking up product {id}"
  },
  {
    "name": "get_cart",
    "description": "Get the authenticated shopper's active cart, including line items and total. Use to inspect what's currently in the cart before adding, updating, or summarizing.",
    "input_schema": {
      "type": "object",
      "properties": {},
      "required": []
    },
    "http": {
      "method": "GET",
      "path_template": "/cart"
    },
    "requires_confirmation": false,
    "summary_template": "Loading your cart"
  },
  {
    "name": "add_cart_item",
    "description": "Add a product to the shopper's cart by product UUID and quantity. Quantities of the same product are merged into a single line.",
    "input_schema": {
      "type": "object",
      "properties": {
        "product_id": {
          "type": "string",
          "format": "uuid",
          "description": "UUID of the product to add."
        },
        "quantity": {
          "type": "integer",
          "minimum": 1,
          "description": "Number of units to add."
        }
      },
      "required": [
        "product_id",
        "quantity"
      ]
    },
    "http": {
      "method": "POST",
      "path_template": "/cart/items"
    },
    "requires_confirmation": true,
    "summary_template": "Adding {quantity} × product {product_id} to cart"
  },
  {
    "name": "update_cart_item",
    "description": "Set the quantity of an existing cart line item. Setting quantity to 0 removes the line.",
    "input_schema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "description": "Cart line item UUID."
        },
        "quantity": {
          "type": "integer",
          "minimum": 0,
          "description": "New quantity for the line. 0 removes the line."
        }
      },
      "required": [
        "id",
        "quantity"
      ]
    },
    "http": {
      "method": "PATCH",
      "path_template": "/cart/items/{id}"
    },
    "requires_confirmation": true,
    "summary_template": "Updating cart line {id} to quantity {quantity}"
  },
  {
    "name": "remove_cart_item",
    "description": "Remove a line item from the shopper's cart by line UUID.",
    "input_schema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "description": "Cart line item UUID to remove."
        }
      },
      "required": [
        "id"
      ]
    },
    "http": {
      "method": "DELETE",
      "path_template": "/cart/items/{id}"
    },
    "requires_confirmation": true,
    "summary_template": "Removing cart line {id}"
  },
  {
    "name": "list_my_orders",
    "description": "List the authenticated shopper's past orders, newest first, with line items. Read-only — use to answer questions about prior purchases and to ground recommendations on order history.",
    "input_schema": {
      "type": "object",
      "properties": {},
      "required": []
    },
    "http": {
      "method": "GET",
      "path_template": "/orders"
    },
    "requires_confirmation": false,
    "summary_template": "Loading your past orders"
  }
];

export const SAFE_READ_TOOLS: string[] = RUNTIME_TOOLS.filter(
  (t) => !t.requires_confirmation,
).map((t) => t.name);

export const ACTION_TOOLS: string[] = RUNTIME_TOOLS.filter(
  (t) => t.requires_confirmation,
).map((t) => t.name);

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
