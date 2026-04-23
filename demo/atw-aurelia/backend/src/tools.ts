/**
 * Tool descriptors rendered at build time from
 * `.atw/artifacts/action-manifest.md`. Keep the split between safe-read
 * and action tools strict — the runtime uses it to decide whether to
 * execute server-side or to emit an action intent for the widget.
 *
 * Source: specs/003-runtime/contracts/chat-endpoint.md §5.
 */
import type Anthropic from "@anthropic-ai/sdk";

export interface RuntimeToolDescriptor {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  http: { method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; path: string };
  /** When true the backend builds an action-intent instead of executing. */
  is_action: boolean;
  /** Human-readable template for the confirmation-card description. */
  description_template?: string;
  summary_fields?: string[];
}

export const RUNTIME_TOOLS: RuntimeToolDescriptor[] = [
  {
    "name": "add_line_item",
    "description": "Add a line item to the cart.",
    "input_schema": {
      "properties": {
        "id": {
          "type": "string"
        },
        "quantity": {
          "minimum": 1,
          "type": "integer"
        },
        "variant_id": {
          "type": "string"
        }
      },
      "required": [
        "variant_id",
        "quantity",
        "id"
      ],
      "type": "object"
    },
    "http": {
      "method": "POST",
      "path": "/store/carts/{id}/line-items"
    },
    "is_action": true
  },
  {
    "name": "delete_line_item",
    "description": "Remove a line item from the cart.",
    "input_schema": {
      "properties": {
        "id": {
          "type": "string"
        },
        "line_id": {
          "type": "string"
        }
      },
      "required": [
        "id",
        "line_id"
      ],
      "type": "object"
    },
    "http": {
      "method": "DELETE",
      "path": "/store/carts/{id}/line-items/{line_id}"
    },
    "is_action": true
  },
  {
    "name": "get_cart",
    "description": "Retrieve a cart.",
    "input_schema": {
      "properties": {
        "id": {
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
      "path": "/store/carts/{id}"
    },
    "is_action": false
  },
  {
    "name": "remove_discount_from_cart",
    "description": "Remove a discount code from the cart.",
    "input_schema": {
      "properties": {
        "code": {
          "type": "string"
        },
        "id": {
          "type": "string"
        }
      },
      "required": [
        "id",
        "code"
      ],
      "type": "object"
    },
    "http": {
      "method": "DELETE",
      "path": "/store/carts/{id}/discounts/{code}"
    },
    "is_action": true
  },
  {
    "name": "update_line_item",
    "description": "Update a line item on the cart.",
    "input_schema": {
      "properties": {
        "id": {
          "type": "string"
        },
        "line_id": {
          "type": "string"
        },
        "quantity": {
          "minimum": 0,
          "type": "integer"
        }
      },
      "required": [
        "quantity",
        "id",
        "line_id"
      ],
      "type": "object"
    },
    "http": {
      "method": "POST",
      "path": "/store/carts/{id}/line-items/{line_id}"
    },
    "is_action": true
  },
  {
    "name": "get_collection",
    "description": "Retrieve a collection.",
    "input_schema": {
      "properties": {
        "id": {
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
      "path": "/store/collections/{id}"
    },
    "is_action": false
  },
  {
    "name": "get_collections",
    "description": "List collections.",
    "input_schema": {
      "properties": {},
      "required": [],
      "type": "object"
    },
    "http": {
      "method": "GET",
      "path": "/store/collections"
    },
    "is_action": false
  },
  {
    "name": "add_my_address",
    "description": "Add an address to the authenticated customer.",
    "input_schema": {
      "properties": {},
      "required": [],
      "type": "object"
    },
    "http": {
      "method": "POST",
      "path": "/store/customers/me/addresses"
    },
    "is_action": true
  },
  {
    "name": "delete_my_address",
    "description": "Delete one of the authenticated customer's addresses.",
    "input_schema": {
      "properties": {
        "address_id": {
          "type": "string"
        }
      },
      "required": [
        "address_id"
      ],
      "type": "object"
    },
    "http": {
      "method": "DELETE",
      "path": "/store/customers/me/addresses/{address_id}"
    },
    "is_action": true
  },
  {
    "name": "get_me",
    "description": "Retrieve the authenticated customer.",
    "input_schema": {
      "properties": {},
      "required": [],
      "type": "object"
    },
    "http": {
      "method": "GET",
      "path": "/store/customers/me"
    },
    "is_action": false
  },
  {
    "name": "list_my_addresses",
    "description": "List the authenticated customer's addresses.",
    "input_schema": {
      "properties": {},
      "required": [],
      "type": "object"
    },
    "http": {
      "method": "GET",
      "path": "/store/customers/me/addresses"
    },
    "is_action": false
  },
  {
    "name": "list_my_orders",
    "description": "List the authenticated customer's orders.",
    "input_schema": {
      "properties": {},
      "required": [],
      "type": "object"
    },
    "http": {
      "method": "GET",
      "path": "/store/customers/me/orders"
    },
    "is_action": false
  },
  {
    "name": "update_my_address",
    "description": "Update one of the authenticated customer's addresses.",
    "input_schema": {
      "properties": {
        "address_id": {
          "type": "string"
        }
      },
      "required": [
        "address_id"
      ],
      "type": "object"
    },
    "http": {
      "method": "PUT",
      "path": "/store/customers/me/addresses/{address_id}"
    },
    "is_action": true
  },
  {
    "name": "get_order",
    "description": "Retrieve an order.",
    "input_schema": {
      "properties": {
        "id": {
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
      "path": "/store/orders/{id}"
    },
    "is_action": false
  },
  {
    "name": "get_product_tags",
    "description": "List product tags.",
    "input_schema": {
      "properties": {},
      "required": [],
      "type": "object"
    },
    "http": {
      "method": "GET",
      "path": "/store/product-tags"
    },
    "is_action": false
  },
  {
    "name": "get_product_types",
    "description": "List product types.",
    "input_schema": {
      "properties": {},
      "required": [],
      "type": "object"
    },
    "http": {
      "method": "GET",
      "path": "/store/product-types"
    },
    "is_action": false
  },
  {
    "name": "get_product",
    "description": "Retrieve a product.",
    "input_schema": {
      "properties": {
        "id": {
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
      "path": "/store/products/{id}"
    },
    "is_action": false
  },
  {
    "name": "get_products",
    "description": "List products.",
    "input_schema": {
      "properties": {},
      "required": [],
      "type": "object"
    },
    "http": {
      "method": "GET",
      "path": "/store/products"
    },
    "is_action": false
  },
  {
    "name": "get_product_by_handle",
    "description": "Retrieve a product by handle.",
    "input_schema": {
      "properties": {
        "handle": {
          "type": "string"
        }
      },
      "required": [
        "handle"
      ],
      "type": "object"
    },
    "http": {
      "method": "GET",
      "path": "/store/products-by-handle/{handle}"
    },
    "is_action": false
  },
  {
    "name": "get_region",
    "description": "Retrieve a region.",
    "input_schema": {
      "properties": {
        "id": {
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
      "path": "/store/regions/{id}"
    },
    "is_action": false
  },
  {
    "name": "get_regions",
    "description": "List regions.",
    "input_schema": {
      "properties": {},
      "required": [],
      "type": "object"
    },
    "http": {
      "method": "GET",
      "path": "/store/regions"
    },
    "is_action": false
  },
  {
    "name": "create_review",
    "description": "Leave a product review.",
    "input_schema": {
      "properties": {
        "body": {
          "maxLength": 2000,
          "type": "string"
        },
        "product_id": {
          "type": "string"
        },
        "rating": {
          "maximum": 5,
          "minimum": 1,
          "type": "integer"
        }
      },
      "required": [
        "product_id",
        "rating"
      ],
      "type": "object"
    },
    "http": {
      "method": "POST",
      "path": "/store/reviews"
    },
    "is_action": true
  },
  {
    "name": "get_shipping_options_for_cart",
    "description": "List shipping options for a cart.",
    "input_schema": {
      "properties": {
        "cart_id": {
          "type": "string"
        }
      },
      "required": [
        "cart_id"
      ],
      "type": "object"
    },
    "http": {
      "method": "GET",
      "path": "/store/shipping-options/{cart_id}"
    },
    "is_action": false
  }
];

export const SAFE_READ_TOOLS: string[] = RUNTIME_TOOLS.filter(
  (t) => !t.is_action,
).map((t) => t.name);

export const ACTION_TOOLS: string[] = RUNTIME_TOOLS.filter(
  (t) => t.is_action,
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
