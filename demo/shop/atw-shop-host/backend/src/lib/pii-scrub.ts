/**
 * Defence-in-depth PII scrubber. Source of truth lives in
 * @atw/scripts/dist/lib/runtime-pii-scrub.ts so the unit tests can
 * exercise it directly (T111).
 *
 * Source: specs/003-runtime/research §7 + FR-038.
 */
export {
  type ScrubResult,
  scrubPii,
} from "../_shared/runtime-pii-scrub.js";
