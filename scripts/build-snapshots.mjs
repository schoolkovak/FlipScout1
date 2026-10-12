#!/usr/bin/env node
// Background listing builder (run by .github/workflows/snapshots.yml).
//
// Like PCTechSniper: listings are gathered on a schedule and saved, and every
// visitor reads the saved copy. Nobody's page view ever spends API credits.
//
//   node scripts/build-snapshots.mjs --site=https://flip-scout-ebon.vercel.app --data=snapdata --budget=60
//
// - Free official APIs (eBay Browse, Best Buy), when the site has keys:
//   every model, every run.
// - Paid store search (Serper credits): a few models per run, flipper
//   favorites first, never more than --budget credits per UTC day.
// - Store-page matches are saved in links.json and reused for free.
// Output: <data>/models/<slug>.json, <data>/links.json, <data>/state.json
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PART_GROUPS } from "../shared/partCatalog.js";
import { modelSlug } from "../api/_lib/snapshots.js";
import { buildMarket, rankDeals } from "../api/_lib/market.js";

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? "1"]; }));
const SITE = (args.site || "https://flip-scout-ebon.vercel.app").replace(/\/$/, "");
const DATA = args.data || "snapdata";
const DAILY_BUDGET = Math.max(0, Number(args.budget ?? 60));
const MAX_PAID_PER_RUN = Math.max(0, Number(args["max-paid"] ?? 6));
const CREDITS_PER_MODEL_GUESS = 12; // worst case for one snapshot-mode search
const PAID_STALE_H = { priority: 48, normal: 24 * 7 };
const FREE_STALE_H = 2.5;
const RUN_LIMIT_MS = Number(args["time-limit"] ?? 20 * 60 * 1000);

// Parts a gaming-PC flipper buys and sells most: refreshed first.
// (Flipper Deals sections are built from these too.)
const PRIORITY = [
  "GTX 1660 Super", "GTX 1660 Ti", "RTX 3060 12GB", "16GB DDR4 3200", "500GB NVMe SSD", "Ryzen 5 3600", "650W PSU",
  "ATX mid tower PC case", "RTX 3060 Ti", "RTX 3070", "RTX 2060", "Ryzen 5 2600", "Ryzen 5 5600", "8GB DDR4 3200",
  "650W 80+ Gold PSU", "550W PSU", "GTX 1660", "RX 6600", "RX 580 8GB", "RX 5700 XT", "Ryzen 5 3500X", "Ryzen 5 5600X",
  "Micro ATX PC case", "16GB DDR4 3600", "RTX 2060 Super", "RTX 2070 Super", "GTX 1070", "GTX 1080", "RX 6700 XT",
  "RTX 3080 10GB", "RTX 4060", "Ryzen 7 5700X", "Ryzen 7 5800X3D", "750W 80+ Gold PSU", "500GB SSD",
  "B550 AM4 motherboard", "B450 AM4 motherboard", "32GB DDR4 3200", "1TB NVMe SSD", "RTX 5070"
];

const readJson = (p, d) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return d; } };
const now = () => new Date().toISOString();
const hoursSince = iso => iso ? (Date.now() - Date.parse(iso)) / 3600000 : Infinity;
const FREE_PROVIDER = /eBay Browse API|Best Buy API/;

function catalog() {
  const seen = new Map();
  for (const g of PART_GROUPS) for (const s of g.series) for (const item of s.items) if (!seen.has(item.name)) seen.set(item.name, item);
  return [...seen.values()];
}

async function getJson(url, timeoutMs = 75000) {
  const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { "User-Agent": "FlipScout-snapshot-builder" } });
  if (!r.ok) throw new Error("HTTP " + r.status + " for " + url);
  return r.json();
}

function liveUrl(item, free) {
  const qs = new URLSearchParams({ q: item.query, category: item.category, condition: "any", msrp: String(item.msrp || 0), live: "1" });
  if (free) qs.set("free", "1");
  return SITE + "/api/deals/search?" + qs;
}

// Re-rank a merged listing set the same way the site does.
function rerank(items, item) {
  const market = buildMarket(items);
  const ranked = rankDeals(items, market, { query: item.query, msrp: item.msrp || 0, sortBy: "lowest" });
  return { market, ranked };
}

function saveModel(item, payload) {
  const file = join(DATA, "models", modelSlug(item.name) + ".json");
  const { credits, resolved, sources, ...rest } = payload;
  writeFileSync(file, JSON.stringify({ model: item.name, query: item.query, category: item.category, msrp: item.msrp || 0, ...rest }));
}

async function pool(list, size, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, list.length) }, async () => { while (i < list.length) await fn(list[i++]); }));
}

async function main() {
  const started = Date.now();
  mkdirSync(join(DATA, "models"), { recursive: true });
  const state = readJson(join(DATA, "state.json"), { models: {}, runs: [] });
  const links = readJson(join(DATA, "links.json"), {});
  const today = now().slice(0, 10);
  if (state.day !== today) { state.day = today; state.creditsToday = 0; }
  state.totalCredits ||= 0;

  const sources = await getJson(SITE + "/api/sources").catch(() => ({ sources: [] }));
  const connected = id => (sources.sources || []).some(s => s.id === id && s.status === "Connected");
  const freeApis = connected("ebay") || connected("bestbuy");
  const paidOk = connected("serper") || connected("searchapi");
  const models = catalog();
  const log = { at: now(), free: 0, paid: 0, credits: 0, errors: [] };
  console.log(`site ${SITE} | free APIs: ${freeApis} | paid search: ${paidOk} | credits today ${state.creditsToday}/${DAILY_BUDGET}`);

  const existing = item => readJson(join(DATA, "models", modelSlug(item.name) + ".json"), null);

  // 1. Free refresh (eBay / Best Buy official APIs): every model.
  if (freeApis) {
    const due = models.filter(m => hoursSince(state.models[m.name]?.freeAt) > FREE_STALE_H);
    await pool(due, 3, async item => {
      if (Date.now() - started > RUN_LIMIT_MS / 2) return;
      try {
        const data = await getJson(liveUrl(item, true));
        const fresh = (data.results || []).filter(x => FREE_PROVIDER.test(x.provider || ""));
        const old = existing(item);
        const kept = (old?.results || []).filter(x => !FREE_PROVIDER.test(x.provider || ""));
        const merged = [...fresh, ...kept];
        if (!merged.length) return;
        const { market, ranked } = rerank(merged, item);
        const payload = { ...(old || data), available: true, searchedAt: now(), market, resultCount: ranked.length, results: ranked.slice(0, 200), providers: data.providers, coverage: data.coverage };
        saveModel(item, payload);
        (state.models[item.name] ||= {}).freeAt = now();
        state.models[item.name].count = ranked.length;
        log.free++;
      } catch (e) { log.errors.push(item.name + ": " + e.message); }
    });
  }

  // 2. Paid refresh: priority models first, then the stalest, within budget.
  if (paidOk) {
    const prio = new Set(PRIORITY);
    const due = models
      .map(m => ({ m, age: hoursSince(state.models[m.name]?.paidAt), p: prio.has(m.name) }))
      .filter(x => x.age > (x.p ? PAID_STALE_H.priority : PAID_STALE_H.normal))
      .sort((a, b) => (b.p - a.p) || (b.age - a.age) || PRIORITY.indexOf(a.m.name) - PRIORITY.indexOf(b.m.name))
      .map(x => x.m);
    for (const item of due) {
      if (log.paid >= MAX_PAID_PER_RUN) break;
      if (state.creditsToday + CREDITS_PER_MODEL_GUESS > DAILY_BUDGET) break;
      if (Date.now() - started > RUN_LIMIT_MS) break;
      try {
        const data = await getJson(liveUrl(item, false));
        const spent = Number(data.credits) || 0;
        state.creditsToday += spent; state.totalCredits += spent; log.credits += spent;
        Object.assign(links, data.resolved || {});
        const results = data.results || [];
        const old = existing(item);
        if (results.length || !old) {
          // Keep free-API listings from the last free run if this one lacked them.
          const freeOld = results.some(x => FREE_PROVIDER.test(x.provider || "")) ? [] : (old?.results || []).filter(x => FREE_PROVIDER.test(x.provider || ""));
          const { market, ranked } = freeOld.length ? rerank([...results, ...freeOld], item) : { market: data.market, ranked: results };
          saveModel(item, { ...data, available: ranked.length > 0, market, resultCount: ranked.length, results: ranked.slice(0, 200), searchedAt: now() });
        }
        const st = (state.models[item.name] ||= {});
        st.paidAt = now(); st.credits = spent; st.count = results.length;
        log.paid++;
        console.log(`paid ${item.name}: ${results.length} listings, ${spent} credits`);
        if (/out of credits|API key rejected/i.test(JSON.stringify(data.errors || []))) { log.errors.push("paid search stopped: " + JSON.stringify(data.errors).slice(0, 200)); break; }
      } catch (e) { log.errors.push(item.name + ": " + e.message); }
    }
  }

  state.runs = [log, ...(state.runs || [])].slice(0, 30);
  state.updatedAt = now();
  writeFileSync(join(DATA, "state.json"), JSON.stringify(state, null, 1));
  writeFileSync(join(DATA, "links.json"), JSON.stringify(links));
  console.log(JSON.stringify(log));
}

main().catch(e => { console.error(e); process.exit(1); });
