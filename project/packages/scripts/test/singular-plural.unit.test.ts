import { describe, expect, it } from "vitest";
import { normaliseName } from "../src/lib/singular-plural.js";

describe("normaliseName (FR-011 / research R9)", () => {
  it("treats singular and plural as equal for simple nouns", () => {
    expect(normaliseName("Products")).toBe(normaliseName("Product"));
    expect(normaliseName("Orders")).toBe(normaliseName("Order"));
    expect(normaliseName("Customers")).toBe(normaliseName("Customer"));
  });

  it("handles -ies → -y plurals", () => {
    expect(normaliseName("Categories")).toBe(normaliseName("Category"));
    expect(normaliseName("Queries")).toBe(normaliseName("Query"));
  });

  it("handles -ses / -xes / -ches / -shes plurals", () => {
    expect(normaliseName("Addresses")).toBe(normaliseName("Address"));
    expect(normaliseName("Boxes")).toBe(normaliseName("Box"));
    expect(normaliseName("Batches")).toBe(normaliseName("Batch"));
    expect(normaliseName("Brushes")).toBe(normaliseName("Brush"));
  });

  it("does not strip -ss endings", () => {
    expect(normaliseName("Address")).toBe("address");
    expect(normaliseName("addresses")).toBe("address");
  });

  it("handles compound names word-by-word", () => {
    expect(normaliseName("order_items")).toBe(normaliseName("OrderItem"));
    expect(normaliseName("cart-lines")).toBe(normaliseName("CartLine"));
    expect(normaliseName("OrderItems")).toBe(normaliseName("order_item"));
  });

  it("lowercases and strips non-alphanumerics", () => {
    expect(normaliseName("  Order-Items  ")).toBe("orderitem");
    expect(normaliseName("Order.Items")).toBe("orderitem");
  });

  it("leaves non-English or too-short inputs reasonably unchanged", () => {
    expect(normaliseName("x")).toBe("x");
    expect(normaliseName("ID")).toBe("id");
    expect(normaliseName("")).toBe("");
  });

  it("is idempotent", () => {
    const once = normaliseName("Categories");
    const twice = normaliseName(once);
    expect(twice).toBe(once);
  });
});
