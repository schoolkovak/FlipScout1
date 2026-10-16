// Great-deal alerts, computed from saved listings after each refresh (no API
// credits). A deal is a Flipper-type listing at least ALERT_MIN_PCT under that
// model's current used-market price. New deals are pushed to the phone via
// ntfy (free app, no account): https://ntfy.sh/<topic>.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { flipperSection, FLIPPER_SECTIONS } from "../api/_lib/flipper.js";
import { modelPath } from "../api/_lib/snapshots.js";

export const ALERT_MIN_PCT = 10;
const MAX_PER_RUN = 15;
// Variety: no single part type can take a whole batch.
const PER_SECTION = { gpu: 6, ryzen: 3, ddr4: 3, nvme500: 2, psu: 2, psunew: 3, whitecases: 2 };
// No pushes overnight (US Eastern, where the user lives); deals found then
// are sent at 8am if they're still for sale.
export const QUIET_HOURS = { from: 3, to: 8, tz: "America/New_York" };
export function inQuietHours(date = new Date(), q = QUIET_HOURS) {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: q.tz }).format(date));
  return h >= q.from && h < q.to;
}

const money = n => "$" + Number(n).toFixed(2).replace(/\.00$/, "");

export async function findGreatDeals(dataDir) {
  const read = async path => { try { return JSON.parse(readFileSync(join(dataDir, path), "utf8")); } catch { return null; } };
  const deals = [];
  // Never alert on anything priced above its model's launch MSRP.
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
      // Only alert against a real used-market price: at least 5 used comps.
      // Cases are skipped — their "market" mixes every case model, so any
      // cheap new case looked 50% under it.
      if (id === "cases" || id === "combos") continue;
      // Used-market sections need >= 5 used comps; the new-price sections
      // (cheap new PSUs, white ARGB cases) need >= 5 comparable listings.
      if (id === "psunew" ? (x.newComps ?? 0) < 5 : id !== "whitecases" && (x.usedComps ?? 0) < 5) continue;
      if (id === "whitecases" && (x.underPct ?? 0) < 15) continue;
      // AliExpress search prices are a listing's cheapest variant: shown on
      // the site (flagged), never pushed as an alert.
      if (x.marketplace === "aliexpress") continue;
      // A launch MSRP under a quarter of today's used price is a data error
      // (e.g. "$5"), so it can't block a real deal.
      const launch = await msrp(x.model);
      if (launch && launch >= x.market * 0.25 && x.totalPrice > launch) continue;
      const price = x.perPair || x.totalPrice;
      // Estimated profit = what it resells for on the used market minus what
      // you pay (before selling fees; shipping and tax-free local resale).
      const profit = Math.round((x.market - price) * (x.perPair ? (x.sticks || 2) / 2 : 1) * 100) / 100;
      deals.push({ key: x.url, sectionId: id, marketKind: x.marketKind || (id === "whitecases" ? "similar" : "used"), section: s.title, title: x.title, price: x.totalPrice, market: x.market, underPct: x.underPct, profit, url: x.url, model: x.model || x.tag || null, perPair: x.perPair || null, image: x.image || null });
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
  let fresh = deals.filter(d => !seen.has(d.key)).slice(0, MAX_PER_RUN * 4);
  if (verify) {
    const ebay = fresh.filter(d => /ebay\.com\/itm\//.test(d.url)).map(d => d.url);
    const live = ebay.length ? await verify(ebay).catch(() => new Map()) : new Map();
    fresh = fresh.filter(d => !/ebay\.com\/itm\//.test(d.url) || (live.has(d.url) && live.get(d.url) <= d.price + 0.5));
  }
  const taken = {};
  fresh = fresh.filter(d => { const cap = PER_SECTION[d.sectionId] ?? 3; taken[d.sectionId] = (taken[d.sectionId] || 0) + 1; return taken[d.sectionId] <= cap; }).slice(0, MAX_PER_RUN);
  const sent = [];
  for (const d of fresh) {
    const vs = d.marketKind === "new" ? "typical new price" : d.marketKind === "similar" ? "similar cases" : "used market";
    const body = `${money(d.price)} incl. shipping · ${vs} ~${money(d.market)} (${d.underPct}% under)\nEst. profit ~${money(d.profit)}${d.perPair ? " (" + money(d.perPair) + " per 2×8GB)" : ""}\n${d.title}`;
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
