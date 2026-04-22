/**
 * T087 — HTTP failure-mode matrix unit test for `callWithHttpRetries`.
 *
 * Drives a fake `fn` that throws objects with `.status` set to each HTTP
 * status in `enrichment.md` §5 and asserts:
 *   - 200 (no throw) → pass through.
 *   - 400 → `OPUS_400` thrown once, no retry.
 *   - 401 / 403 → `OPUS_AUTH`, no retry.
 *   - 408 / 409 → retried exactly once, then throws.
 *   - 429 → up to 3 attempts before throwing `OPUS_RATE_LIMIT`.
 *   - 5xx → retried exactly once, second failure → `OPUS_5XX_TWICE`.
 *
 * Sleep is stubbed so tests are fast; random jitter is deterministic.
 */
import { describe, it, expect } from "vitest";
import { callWithHttpRetries } from "../src/enrich-entity.js";

function http(status: number, message = "x"): Error & { status: number } {
  const e = Object.assign(new Error(message), { status });
  return e as Error & { status: number };
}

function rng(): number {
  // Deterministic midpoint → jitter multiplier of exactly 1.0.
  return 0.5;
}
const noSleep = async () => {};

describe("callWithHttpRetries (T087 / enrichment.md §5)", () => {
  it("200 passes through without retry", async () => {
    let calls = 0;
    const r = await callWithHttpRetries(
      async () => {
        calls += 1;
        return "ok";
      },
      { sleep: noSleep, rng },
    );
    expect(r).toBe("ok");
    expect(calls).toBe(1);
  });

  it("400 throws OPUS_400 once, no retry", async () => {
    let calls = 0;
    await expect(
      callWithHttpRetries(
        async () => {
          calls += 1;
          throw http(400, "bad request");
        },
        { sleep: noSleep, rng },
      ),
    ).rejects.toMatchObject({ code: "OPUS_400" });
    expect(calls).toBe(1);
  });

  it("401 throws OPUS_AUTH", async () => {
    let calls = 0;
    await expect(
      callWithHttpRetries(
        async () => {
          calls += 1;
          throw http(401);
        },
        { sleep: noSleep, rng },
      ),
    ).rejects.toMatchObject({ code: "OPUS_AUTH" });
    expect(calls).toBe(1);
  });

  it("403 throws OPUS_AUTH", async () => {
    let calls = 0;
    await expect(
      callWithHttpRetries(
        async () => {
          calls += 1;
          throw http(403);
        },
        { sleep: noSleep, rng },
      ),
    ).rejects.toMatchObject({ code: "OPUS_AUTH" });
    expect(calls).toBe(1);
  });

  it("408 retries once and then propagates", async () => {
    let calls = 0;
    await expect(
      callWithHttpRetries(
        async () => {
          calls += 1;
          throw http(408);
        },
        { sleep: noSleep, rng },
      ),
    ).rejects.toMatchObject({ status: 408 });
    expect(calls).toBe(2);
  });

  it("409 retries once and then propagates", async () => {
    let calls = 0;
    await expect(
      callWithHttpRetries(
        async () => {
          calls += 1;
          throw http(409);
        },
        { sleep: noSleep, rng },
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(calls).toBe(2);
  });

  it("408 then success succeeds on second attempt", async () => {
    let calls = 0;
    const r = await callWithHttpRetries(
      async () => {
        calls += 1;
        if (calls === 1) throw http(408);
        return "ok";
      },
      { sleep: noSleep, rng },
    );
    expect(r).toBe("ok");
    expect(calls).toBe(2);
  });

  it("429 escalates to OPUS_RATE_LIMIT after 3 attempts", async () => {
    let calls = 0;
    await expect(
      callWithHttpRetries(
        async () => {
          calls += 1;
          throw http(429);
        },
        { sleep: noSleep, rng },
      ),
    ).rejects.toMatchObject({ code: "OPUS_RATE_LIMIT" });
    expect(calls).toBe(3);
  });

  it("429 then success recovers", async () => {
    let calls = 0;
    const r = await callWithHttpRetries(
      async () => {
        calls += 1;
        if (calls <= 2) throw http(429);
        return "ok";
      },
      { sleep: noSleep, rng },
    );
    expect(r).toBe("ok");
    expect(calls).toBe(3);
  });

  it("500 retries once and then throws OPUS_5XX_TWICE", async () => {
    let calls = 0;
    await expect(
      callWithHttpRetries(
        async () => {
          calls += 1;
          throw http(500);
        },
        { sleep: noSleep, rng },
      ),
    ).rejects.toMatchObject({ code: "OPUS_5XX_TWICE" });
    expect(calls).toBe(2);
  });

  it("503 retries once and then throws OPUS_5XX_TWICE", async () => {
    let calls = 0;
    await expect(
      callWithHttpRetries(
        async () => {
          calls += 1;
          throw http(503);
        },
        { sleep: noSleep, rng },
      ),
    ).rejects.toMatchObject({ code: "OPUS_5XX_TWICE" });
    expect(calls).toBe(2);
  });

  it("500 then success recovers without throwing", async () => {
    let calls = 0;
    const r = await callWithHttpRetries(
      async () => {
        calls += 1;
        if (calls === 1) throw http(500);
        return "ok";
      },
      { sleep: noSleep, rng },
    );
    expect(r).toBe("ok");
    expect(calls).toBe(2);
  });

  it("non-HTTP error is re-thrown untouched (no status)", async () => {
    let calls = 0;
    const weird = Object.assign(new Error("weird network blip"), { code: "ECONNRESET" });
    await expect(
      callWithHttpRetries(
        async () => {
          calls += 1;
          throw weird;
        },
        { sleep: noSleep, rng },
      ),
    ).rejects.toBe(weird);
    expect(calls).toBe(1);
  });
});
