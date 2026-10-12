// Per-request accounting: how many Serper credits a search spent and which
// Google Shopping offers were matched to real store pages (so the snapshot
// builder can save those matches and never pay for them again).
import { AsyncLocalStorage } from "node:async_hooks";

const als = new AsyncLocalStorage();

export function withMeter(fn) {
  const store = { credits: 0, calls: 0, resolved: {} };
  return als.run(store, async () => ({ result: await fn(), meter: store }));
}

export function meterStore() { return als.getStore() || null; }

// Serper bills 1 credit per call, 2 when more than 10 results are requested.
export function chargeSerper(body) {
  const s = als.getStore();
  if (!s) return;
  s.calls++;
  s.credits += Number(body?.num) > 10 ? 2 : 1;
}

export function noteResolved(key, url) {
  const s = als.getStore();
  if (s) s.resolved[key] = url;
}
