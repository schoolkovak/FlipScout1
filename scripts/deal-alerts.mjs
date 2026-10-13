// Great-deal alerts, computed from saved listings after each refresh (no API
// credits). A deal is a Flipper-type listing at least ALERT_MIN_PCT under that
// model's current used-market price. New deals are pushed to the phone via
// ntfy (free app, no account): https://ntfy.sh/<topic>.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { flipperSection, FLIPPER_SECTIONS } from "../api/_lib/flipper.js";
import { modelPath } from "../api/_lib/snapshots.js";

export const ALERT_MIN_PCT = 10;
const MAX_PER_RUN = 10;
// No pushes overnight (US Eastern, where the user lives); deals found then
// are sent at 8am if they're still for sale.
export const QUIET_HOURS = { from: 3, to: 8, tz: "America/New_York" };
export function inQuietHours(date = new Date(), q = QUIET_HOURS) {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: q.tz }).format(date));
  return h >= q.from && h < q.to;
}
// Never alert on a GPU over this, or on anything priced above its launch MSRP.
export const ALERT_GPU_MAX = 500;

const money = n => "$" + Number(n).toFixed(2).replace(/\.00$/, "");

export async function findGreatDeals(dataDir) {
  const read = async path => { try { return JSON.parse(readFileSync(join(dataDir, path), "utf8")); } catch { return null; } };
  const deals = [];
  const msrpOf = new Map();
  const msrp = async model => {
    if (!model) return 0;
    if (!msrpOf.has(model)) msrpOf.set(model, Number((await read(modelPath(model)))?.msrp) || 0);
    return msrpOf.get(model);
  };
  for (const id of Object.keys(FLIPPER_SECTIONS)) {
    const s = await flipperSection(id, read);
    for (const x of s?.listings || []) {
      if (x.underPct == null || x.underPct < ALERT_MIN_PCT || !x.market || !x.url) continue;
      if (id === "gpu" && x.totalPrice > ALERT_GPU_MAX) continue;
      const launch = await msrp(x.model);
      if (launch && x.totalPrice > launch) continue;
      const price = x.perPair || x.totalPrice;
      // Estimated profit = what it resells for on the used market minus what
      // you pay (before selling fees; shipping and tax-free local resale).
      const profit = Math.round((x.market - price) * (x.perPair ? (x.sticks || 2) / 2 : 1) * 100) / 100;
      deals.push({ key: x.url, section: s.title, title: x.title, price: x.totalPrice, market: x.market, underPct: x.underPct, profit, url: x.url, model: x.model || x.tag || null, perPair: x.perPair || null, image: x.image || null });
    }
  }
  return deals.sort((a, b) => b.profit - a.profit);
}

// verify(urls) → Map(url → current total price) of eBay listings eBay
// confirms are still for sale. A deal is pushed only when its listing is
// confirmed live and its price hasn't gone up.
export async function sendAlerts(deals, { topic, alerted = [], fetchImpl = fetch, server = "https://ntfy.sh", verify = null, now = new Date() } = {}) {
  if (inQuietHours(now)) return { sent: [], candidates: deals.length, quiet: true };
  const seen = new Set(alerted);
  let fresh = deals.filter(d => !seen.has(d.key)).slice(0, MAX_PER_RUN * 3);
  if (verify) {
    const ebay = fresh.filter(d => /ebay\.com\/itm\//.test(d.url)).map(d => d.url);
    const live = ebay.length ? await verify(ebay).catch(() => new Map()) : new Map();
    fresh = fresh.filter(d => !/ebay\.com\/itm\//.test(d.url) || (live.has(d.url) && live.get(d.url) <= d.price + 0.5));
  }
  fresh = fresh.slice(0, MAX_PER_RUN);
  const sent = [];
  for (const d of fresh) {
    const body = `${money(d.price)} incl. shipping · used market ~${money(d.market)} (${d.underPct}% under)\nEst. profit ~${money(d.profit)}${d.perPair ? " (" + money(d.perPair) + " per 2×8GB)" : ""}\n${d.title}`;
    if (topic) {
      const r = await fetchImpl(server + "/" + encodeURIComponent(topic), {
        method: "POST", body,
        headers: { "Title": `FlipScout deal: ${d.model || d.section} ${money(d.price)}`, "Click": d.url, "Tags": "moneybag", "Priority": d.underPct >= 30 ? "high" : "default", ...(d.image ? { "Attach": d.image } : {}) }
      }).catch(e => ({ ok: false, status: String(e) }));
      if (!r.ok) { console.log("alert failed", r.status); continue; }
    }
    sent.push(d.key);
  }
  return { sent, candidates: deals.length };
}
