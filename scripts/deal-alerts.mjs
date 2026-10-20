// Great-deal alerts, computed from saved listings after each refresh (no API
// credits). A deal is a Flipper-type listing at least ALERT_MIN_PCT under that
// model's current used-market price. Deals are ranked by price-to-performance
// (valueScore) and mixed across part types, then pushed to the phone via
// ntfy (free app, no account): https://ntfy.sh/<topic>.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { flipperSection, FLIPPER_SECTIONS, isAm5 } from "../api/_lib/flipper.js";
import { modelPath } from "../api/_lib/snapshots.js";
import { PART_GROUPS } from "../shared/partCatalog.js";
import { xeonSections, XEON_SECTIONS, XEON_GREAT_PCT, XEON_GREAT_PROFIT } from "./xeon-deals.mjs";

export const ALERT_MIN_PCT = 10;
// A deal must make at least this much per item (per drive / per 2 sticks):
// a $4 margin isn't worth a buzz on the phone.
export const MIN_ITEM_PROFIT = 10;
const MAX_PER_RUN = 15;
// Variety: sections of the same part type share one family, and each family
// gets at most FAMILY_PER_RUN alerts per batch and FAMILY_PER_DAY per 24 h
// (great deals still go through once a family's day is used up).
const FAMILY = { nvme500: "ssd", bulkssd: "ssd", ddr4: "ram", bulkram: "ram", psu: "psu", psunew: "psu", ryzen: "cpu", cpus: "cpu", whitecases: "case" };
export const familyOf = sectionId => FAMILY[sectionId] || sectionId;
const FAMILY_PER_RUN = 2;
const FAMILY_PER_DAY = 6;
// Ranking: each alert already picked from a family costs the next one from
// that family this many points, so a batch mixes part types.
const FAMILY_PENALTY = 12;
// A really good deal (❗ in the notification): far under its used market
// and real money on each item.
export const GREAT_PCT = 40;
export const GREAT_PROFIT = 50;
// Price-to-performance score: how far under what the part is worth (%),
// plus a log-scaled bonus for the dollars made per item. Lots count per
// drive / per 2 sticks, so a 46-drive lot doesn't outrank everything just
// because its total profit is big.
export const valueScore = (underPct, itemProfit) => Math.round((underPct + 10 * Math.log2(1 + Math.max(0, itemProfit) / 10)) * 10) / 10;

// Alert-only extra part type (not a Flipper page section) for more variety:
// Intel and AM4 Ryzen CPUs up to $300, each under its own model's used market.
const EXTRA_CPU_MAX = 300;
const cpuNames = () => [...new Set(PART_GROUPS.find(g => g.id === "cpu").series.flatMap(s => s.items.map(i => i.name)))].filter(n => !isAm5(n));
const USED = new Set(["used", "refurbished", "renewed", "open-box"]);
// Whole computers and bundles listed under a CPU's name aren't the CPU.
const NOT_JUST_CPU = /\b(?:workstation|desktop pc|gaming pc|computer|laptop|tower|motherboard|mobo|combo|bundle|lot|ram|ddr[45]|gpu|rtx|gtx|radeon)\b/i;
async function extraCpus(read) {
  const listings = [];
  for (const name of cpuNames()) {
    const snap = await read(modelPath(name));
    const msrp = Number(snap?.msrp) || 0;
    const results = (snap?.results || []).filter(x => !NOT_JUST_CPU.test(x.title || "") && !(msrp && x.totalPrice > msrp * 2));
    const used = results.filter(x => USED.has(x.condition)).map(x => x.totalPrice).filter(n => n > 0).sort((a, b) => a - b);
    // Asking prices run high (sold CPUs go for less), so the market here is
    // the lower third of used asking prices, not the median.
    if (used.length < 8) continue;
    const market = used[Math.floor(used.length / 3)];
    for (const x of results) {
      if (!(x.totalPrice > 0) || x.totalPrice > EXTRA_CPU_MAX || x.totalPrice < market * 0.4 || isAm5(x.title)) continue;
      // Ryzen CPUs up to $65 already come from the Flipper section.
      if (/^Ryzen/.test(name) && x.totalPrice <= 65) continue;
      const underPct = Math.round((market - x.totalPrice) / market * 100);
      if (underPct >= ALERT_MIN_PCT) listings.push({ ...x, model: name, market: Math.round(market * 100) / 100, underPct, usedComps: used.length });
    }
  }
  return { title: "CPUs under their used market", listings };
}
// No pushes overnight (US Eastern, where the user lives); deals found then
// are sent at 8am if they're still for sale.
export const QUIET_HOURS = { from: 3, to: 8, tz: "America/New_York" };
export function inQuietHours(date = new Date(), q = QUIET_HOURS) {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: q.tz }).format(date));
  return h >= q.from && h < q.to;
}

const money = n => "$" + Number(n).toFixed(2).replace(/\.00$/, "");

export async function findGreatDeals(dataDir, { read: readOverride } = {}) {
  const read = readOverride || (async path => { try { return JSON.parse(readFileSync(join(dataDir, path), "utf8")); } catch { return null; } });
  const deals = [];
  // Never alert on anything priced above its model's launch MSRP.
  const msrpOf = new Map();
  const msrp = async model => {
    if (!model) return 0;
    if (!msrpOf.has(model)) msrpOf.set(model, Number((await read(modelPath(model)))?.msrp) || 0);
    return msrpOf.get(model);
  };
  const xeon = await xeonSections(read);
  for (const id of [...Object.keys(FLIPPER_SECTIONS), "cpus", ...Object.keys(XEON_SECTIONS)]) {
    const s = id === "cpus" ? await extraCpus(read) : xeon[id] || await flipperSection(id, read);
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
      const price = x.perUnit || x.perPair || x.totalPrice;
      // Estimated profit = what it resells for on the used market minus what
      // you pay (before selling fees; shipping and tax-free local resale).
      // Lots: per-unit margin × number of units (pairs of sticks / drives).
      const units = x.perUnit ? x.count : x.perPair ? (x.sticks || 2) / 2 : 1;
      const itemProfit = Math.round((x.market - price) * 100) / 100;
      if (itemProfit < MIN_ITEM_PROFIT) continue;
      const profit = Math.round(itemProfit * units * 100) / 100;
      const great = (x.underPct >= GREAT_PCT && itemProfit >= GREAT_PROFIT) || (id in XEON_SECTIONS && x.underPct >= XEON_GREAT_PCT && itemProfit >= XEON_GREAT_PROFIT[id]);
      deals.push({ key: x.url, sectionId: id, family: familyOf(id), score: Math.round((valueScore(x.underPct, itemProfit) + (x.perfBonus || 0)) * 10) / 10, great, itemProfit, marketKind: x.marketKind || (id === "whitecases" ? "similar" : "used"), section: s.title, title: x.title, price: x.totalPrice, market: x.market, underPct: x.underPct, profit, url: x.url, model: id === "whitecases" ? "White ARGB case" : id === "ddr4" && x.sticks ? `${x.sticks}×8GB DDR4 ${x.speed}` : x.model || x.tag || null, perPair: x.perPair || null, perUnit: x.perUnit || null, count: x.count || null, image: x.image || null, note: x.note || null, unitLabel: x.unitLabel || null, unitNoun: x.unitNoun || null });
    }
  }
  // The same item listed twice (same title and price, different link) and
  // the same link in two sections alert once.
  const seen = new Set();
  return deals.sort((a, b) => b.score - a.score || b.profit - a.profit).filter(d => {
    const k = [d.key, String(d.title).toLowerCase().replace(/\s+/g, " ").trim().slice(0, 60) + "|" + d.price];
    if (k.some(x => seen.has(x))) return false;
    k.forEach(x => seen.add(x));
    return true;
  });
}

// Best-value first, but each pick from a family pushes that family's next
// deal down by FAMILY_PENALTY, so one part type can't fill the batch.
export function diversify(deals) {
  const left = deals.map(d => ({ ...d, family: d.family || familyOf(d.sectionId) })), out = [], taken = {};
  while (left.length) {
    let best = 0, bestScore = -Infinity;
    left.forEach((d, i) => { const s = (d.score ?? 0) - FAMILY_PENALTY * (taken[d.family] || 0); if (s > bestScore) { best = i; bestScore = s; } });
    const [d] = left.splice(best, 1);
    taken[d.family] = (taken[d.family] || 0) + 1;
    out.push(d);
  }
  return out;
}

// verify(urls) → Map(url → current total price) of eBay listings eBay
// confirms are still for sale. A deal is pushed only when its listing is
// confirmed live and its price hasn't gone up.
// recent = [{ f: family, at: ISO time }] of alerts already sent (the
// builder keeps it in state.alertLog); the result's `log` holds the new ones.
export async function sendAlerts(deals, { topic, alerted = [], recent = [], fetchImpl = fetch, server = "https://ntfy.sh", verify = null, now = new Date() } = {}) {
  if (inQuietHours(now)) return { sent: [], log: [], candidates: deals.length, quiet: true };
  const seen = new Set(alerted);
  const today = {};
  for (const r of recent) if (now - new Date(r.at) < 24 * 3600e3) today[r.f] = (today[r.f] || 0) + 1;
  let fresh = diversify(deals.filter(d => !seen.has(d.key)).map(d => ({ ...d, score: d.score ?? valueScore(d.underPct || 0, d.itemProfit ?? d.profit ?? 0) })))
    .filter(d => d.great || (today[d.family] || 0) < FAMILY_PER_DAY)
    .slice(0, MAX_PER_RUN * 4);
  if (verify) {
    const ebay = fresh.filter(d => /ebay\.com\/itm\//.test(d.url)).map(d => d.url);
    const live = ebay.length ? await verify(ebay).catch(() => new Map()) : new Map();
    fresh = fresh.filter(d => !/ebay\.com\/itm\//.test(d.url) || (live.has(d.url) && live.get(d.url) <= d.price + 0.5));
  }
  const taken = {};
  fresh = fresh.filter(d => { taken[d.family] = (taken[d.family] || 0) + 1; return taken[d.family] <= FAMILY_PER_RUN; }).slice(0, MAX_PER_RUN);
  const sent = [], log = [];
  for (const d of fresh) {
    const r = topic ? await fetchImpl(server + "/" + encodeURIComponent(topic), { method: "POST", ...alertMessage(d) }).catch(e => ({ ok: false, status: String(e) })) : { ok: true };
    if (!r.ok) { console.log("alert failed", r.status); continue; }
    sent.push(d.key);
    log.push({ f: d.family, at: now.toISOString() });
  }
  return { sent, log, candidates: deals.length };
}

// Keeps the last 24 h of the alert log (for the per-family daily limit).
export const recentAlerts = (log, now = new Date()) => log.filter(r => now - new Date(r.at) < 24 * 3600e3);

// The ntfy message for one deal. Great deals get ❗ (ntfy shows the
// "exclamation" tag as an emoji before the title) and high priority.
export function alertMessage(d) {
  const vs = d.marketKind === "new" ? "typical new price" : d.marketKind === "similar" ? "similar cases" : d.marketKind === "parts" ? "parts sold separately" : "used market";
  // Lots compare per drive / per 2 sticks, so say so next to both prices.
  const unit = d.unitLabel || (d.perUnit ? " per drive" : d.perPair ? " per 2×8GB" : "");
  const each = d.perUnit || d.perPair;
  const body = `${d.great ? "Great deal! " : ""}${money(d.price)} incl. shipping${each && each !== d.price ? " = " + money(each) + unit : ""} · ${vs} ~${money(d.market)}${unit} (${d.underPct}% under)\nEst. profit ~${money(d.profit)}${d.perUnit ? " across " + d.count + " " + (d.unitNoun || "drives") : ""}${d.note ? "\n" + d.note : ""}\n${d.title}`;
  return {
    body,
    headers: { "Title": `FlipScout deal: ${d.model || d.section} ${money(d.price)}`, "Click": d.url, "Tags": d.great ? "exclamation,moneybag" : "moneybag", "Priority": d.great ? "high" : "default", ...(d.image ? { "Attach": d.image } : {}) }
  };
}
