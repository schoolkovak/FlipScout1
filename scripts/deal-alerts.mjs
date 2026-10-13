// Great-deal alerts, computed from saved listings after each refresh (no API
// credits). A deal is a Flipper-type listing at least ALERT_MIN_PCT under that
// model's current used-market price. New deals are pushed to the phone via
// ntfy (free app, no account): https://ntfy.sh/<topic>.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { flipperSection, FLIPPER_SECTIONS } from "../api/_lib/flipper.js";

export const ALERT_MIN_PCT = 15;
const MAX_PER_RUN = 6;

const money = n => "$" + Number(n).toFixed(2).replace(/\.00$/, "");

export async function findGreatDeals(dataDir) {
  const read = async path => { try { return JSON.parse(readFileSync(join(dataDir, path), "utf8")); } catch { return null; } };
  const deals = [];
  for (const id of Object.keys(FLIPPER_SECTIONS)) {
    const s = await flipperSection(id, read);
    for (const x of s?.listings || []) {
      if (x.underPct == null || x.underPct < ALERT_MIN_PCT || !x.market || !x.url) continue;
      const price = x.perPair || x.totalPrice;
      // Estimated profit = what it resells for on the used market minus what
      // you pay (before selling fees; shipping and tax-free local resale).
      const profit = Math.round((x.market - price) * (x.perPair ? (x.sticks || 2) / 2 : 1) * 100) / 100;
      deals.push({ key: x.url, section: s.title, title: x.title, price: x.totalPrice, market: x.market, underPct: x.underPct, profit, url: x.url, model: x.model || x.tag || null, perPair: x.perPair || null, image: x.image || null });
    }
  }
  return deals.sort((a, b) => b.profit - a.profit);
}

export async function sendAlerts(deals, { topic, alerted = [], fetchImpl = fetch, server = "https://ntfy.sh" } = {}) {
  const seen = new Set(alerted);
  const fresh = deals.filter(d => !seen.has(d.key)).slice(0, MAX_PER_RUN);
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
