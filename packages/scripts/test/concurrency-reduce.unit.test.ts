/**
 * T101 / US9 — Unit test for ConcurrencyController auto-reduce policy.
 *
 * Verifies contracts/enrichment.md §5:
 *   - 3 consecutive 429s at cap 10 → reduce to 3, reduction recorded.
 *   - 3 further consecutive 429s at cap 3 → halt flag raised.
 *   - A single successful (non-429) call resets the consecutive counter.
 *   - A reduction entry has {at, from, to, reason} and reason
 *     "sustained_429".
 */
import { describe, it, expect } from "vitest";
import {
  ConcurrencyController,
  DynamicGate,
} from "../src/lib/concurrency-control.js";

function fixedClock(initialIso = "2026-04-22T12:00:00.000Z") {
  let t = new Date(initialIso).getTime();
  return () => {
    const d = new Date(t);
    t += 1000;
    return d;
  };
}

describe("DynamicGate", () => {
  it("admits up to max concurrent acquires", async () => {
    const gate = new DynamicGate(2);
    await gate.acquire();
    await gate.acquire();
    expect(gate.inFlight).toBe(2);

    let acquired3 = false;
    const p = gate.acquire().then(() => {
      acquired3 = true;
    });
    await new Promise((r) => setImmediate(r));
    expect(acquired3).toBe(false);

    gate.release();
    await p;
    expect(acquired3).toBe(true);
    expect(gate.inFlight).toBe(2);
  });

  it("setMax(lower) blocks future acquires but doesn't preempt running ones", async () => {
    const gate = new DynamicGate(10);
    for (let i = 0; i < 5; i++) await gate.acquire();
    expect(gate.inFlight).toBe(5);

    gate.setMax(3);
    // Five are already running; a new acquire must wait until enough
    // releases bring inFlight down to < 3.
    let admitted = false;
    const p = gate.acquire().then(() => {
      admitted = true;
    });
    await new Promise((r) => setImmediate(r));
    expect(admitted).toBe(false);

    gate.release(); // 5 -> 4
    gate.release(); // 4 -> 3
    await new Promise((r) => setImmediate(r));
    expect(admitted).toBe(false);

    gate.release(); // 3 -> 2, wakes waiter → back to 3
    await p;
    expect(admitted).toBe(true);
  });

  it("rejects non-positive-integer initial / setMax", () => {
    expect(() => new DynamicGate(0)).toThrow();
    expect(() => new DynamicGate(-1)).toThrow();
    const gate = new DynamicGate(1);
    expect(() => gate.setMax(0)).toThrow();
  });
});

describe("ConcurrencyController (T101 / US9)", () => {
  it("3 consecutive 429s at cap 10 reduces cap to 3 and records a reduction", () => {
    const ctl = new ConcurrencyController({ initial: 10, now: fixedClock() });
    ctl.onHttpStatus(429);
    ctl.onHttpStatus(429);
    expect(ctl.effectiveMax).toBe(10);
    expect(ctl.reductions).toHaveLength(0);

    ctl.onHttpStatus(429);
    expect(ctl.effectiveMax).toBe(3);
    expect(ctl.halt).toBe(false);
    expect(ctl.reductions).toHaveLength(1);
    const red = ctl.reductions[0];
    expect(red.from).toBe(10);
    expect(red.to).toBe(3);
    expect(red.reason).toBe("sustained_429");
    expect(red.at).toBe("2026-04-22T12:00:00.000Z");
  });

  it("3 further consecutive 429s at cap 3 raises halt", () => {
    const ctl = new ConcurrencyController({ initial: 10, now: fixedClock() });
    ctl.onHttpStatus(429);
    ctl.onHttpStatus(429);
    ctl.onHttpStatus(429); // reduce to 3
    expect(ctl.effectiveMax).toBe(3);
    expect(ctl.halt).toBe(false);

    ctl.onHttpStatus(429);
    ctl.onHttpStatus(429);
    expect(ctl.halt).toBe(false);
    ctl.onHttpStatus(429);
    expect(ctl.halt).toBe(true);
  });

  it("a successful call resets the consecutive 429 counter", () => {
    const ctl = new ConcurrencyController({ initial: 10, now: fixedClock() });
    ctl.onHttpStatus(429);
    ctl.onHttpStatus(429);
    ctl.onHttpStatus(200); // reset
    expect(ctl.consecutive429Count).toBe(0);
    ctl.onHttpStatus(429);
    ctl.onHttpStatus(429);
    // only 2 since last reset → no reduction yet
    expect(ctl.effectiveMax).toBe(10);
    expect(ctl.reductions).toHaveLength(0);
  });

  it("non-429 non-200 statuses also reset (only 429 pressure matters)", () => {
    const ctl = new ConcurrencyController({ initial: 10, now: fixedClock() });
    ctl.onHttpStatus(429);
    ctl.onHttpStatus(500);
    ctl.onHttpStatus(429);
    ctl.onHttpStatus(429);
    // Counter was reset by the 500 mid-stream.
    expect(ctl.effectiveMax).toBe(10);
  });

  it("reductions[] preserves order for multiple trips (not expected in prod but safe)", () => {
    // In real flow we only ever reduce 10 -> 3; the controller should
    // not double-reduce. Confirm behavior.
    const ctl = new ConcurrencyController({ initial: 10, now: fixedClock() });
    for (let i = 0; i < 3; i++) ctl.onHttpStatus(429);
    for (let i = 0; i < 3; i++) ctl.onHttpStatus(429);
    // 6 consecutive 429s → 1 reduction (10->3) then halt. Not a second
    // reduction entry.
    expect(ctl.reductions).toHaveLength(1);
    expect(ctl.halt).toBe(true);
  });

  it("custom threshold and reducedTo values are honored", () => {
    const ctl = new ConcurrencyController({
      initial: 8,
      reducedTo: 2,
      threshold: 2,
      now: fixedClock(),
    });
    ctl.onHttpStatus(429);
    expect(ctl.effectiveMax).toBe(8);
    ctl.onHttpStatus(429);
    expect(ctl.effectiveMax).toBe(2);
    expect(ctl.reductions[0].to).toBe(2);
  });
});
