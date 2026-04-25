/**
 * Singular/plural name normalisation for cross-validation (FR-011 / research R9).
 *
 * Classifier tag names are typically plural (`products`, `orders`, `customers`)
 * because they are derived from OpenAPI path prefixes. Schema-map entity names
 * are typically singular (`Product`, `Order`, `Customer`). A strict exact-match
 * comparison in `validate-artifacts.ts`' `action-references-excluded-entity`
 * rule produced spurious failures in the Feature 007 demo.
 *
 * `normaliseName` applies lowercase + alphanumeric filtering + conservative
 * English singularisation so `"Products"` and `"Product"` compare equal.
 * Non-English inputs pass through unchanged. Compound names (separated by
 * `_`, `-`, or camel-case boundaries) are normalised word-by-word.
 *
 * No dependency on the `pluralize` package — we cover the observed
 * Feature 007 mismatches with ~40 lines of deterministic logic.
 */
/**
 * Normalise a name for cross-artifact comparison.
 *
 * - Lowercases the input.
 * - Strips non-alphanumerics.
 * - Singularises each word via the conservative English ruleset.
 * - Rejoins compound names without separators.
 *
 * @example
 * normaliseName("Products")           // "product"
 * normaliseName("Product")            // "product"
 * normaliseName("order_items")        // "orderitem"
 * normaliseName("OrderItems")         // "orderitem"
 * normaliseName("Categories")         // "category"
 * normaliseName("customers")          // "customer"
 */
export declare function normaliseName(input: string): string;
//# sourceMappingURL=singular-plural.d.ts.map