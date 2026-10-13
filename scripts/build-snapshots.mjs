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
import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { PART_GROUPS } from "../shared/partCatalog.js";
import { modelSlug } from "../api/_lib/snapshots.js";
import { buildMarket, rankDeals, shippingFields } from "../api/_lib/market.js";
import { normalizeListingText, evaluateListing } from "../api/_lib/matching.js";
import { findGreatDeals, sendAlerts } from "./deal-alerts.mjs";
import { flipperSection, FLIPPER_SECTIONS } from "../api/_lib/flipper.js";
import { readdirSync } from "node:fs";
import { neweggListings, fetchNeweggCombos, NEWEGG_PROVIDER } from "./newegg.mjs";
import { amazonListings, AMAZON_PROVIDER } from "./amazon.mjs";

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? "1"]; }));
const SITE = (args.site || "https://flip-scout-ebon.vercel.app").replace(/\/$/, "");
const DATA = args.data || "snapdata";
const DAILY_BUDGET = Math.max(0, Number(args.budget ?? 60));
const MAX_PAID_PER_RUN = Math.max(0, Number(args["max-paid"] ?? 6));
const CREDITS_PER_MODEL_GUESS = 12; // worst case for one snapshot-mode search
const PAID_STALE_H = { priority: 48, normal: 24 * 7 };
const FREE_STALE_H = 1.9; // eBay allows 5,000 calls/day: ~200 models every 2 h ≈ 2,400
const RUN_LIMIT_MS = Number(args["time-limit"] ?? 20 * 60 * 1000);
// Newegg store pages (free, read politely one at a time): each model about
// every 6 hours, at most NEWEGG_PER_RUN models per run.
const NEWEGG_STALE_H = 6;
const NEWEGG_PER_RUN = Number(args["newegg-per-run"] ?? 45);
const NEWEGG_GAP_MS = 1500;
// Amazon search pages: gentler still (each model about every 8 hours).
const AMAZON_STALE_H = 8;
const AMAZON_PER_RUN = Number(args["amazon-per-run"] ?? 25);
const AMAZON_GAP_MS = 4000;
const STORE_PROVIDERS = new Set([NEWEGG_PROVIDER, AMAZON_PROVIDER]);

// Parts a gaming-PC flipper buys and sells most: refreshed first.
// (Flipper Deals sections are built from these too.)
const PRIORITY = [
  "GTX 1660 Super", "GTX 1660 Ti", "RTX 3060 12GB", "16GB DDR4 3200", "500GB NVMe SSD", "Ryzen 5 3600", "650W PSU",
  "RGB gaming PC case", "ARGB PC case", "White PC case", "ATX mid tower PC case", "Micro ATX PC case", "RTX 3060 Ti", "RTX 3070", "RTX 2060", "Ryzen 5 2600", "Ryzen 5 5600", "8GB DDR4 3200",
  "650W 80+ Gold PSU", "550W PSU", "GTX 1660", "RX 6600", "RX 580 8GB", "RX 5700 XT", "Ryzen 5 3500X", "Ryzen 5 5600X",
  "16GB DDR4 3600", "RTX 2060 Super", "RTX 2070 Super", "GTX 1070", "GTX 1080", "RX 6700 XT",
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

// Merged sets (fresh free-API listings + kept store listings) are cleaned the
// way the site cleans a live search: one entry per eBay item / per identical
// store offer, and every price includes shipping (stated or estimated).
function cleanMerged(items, item) {
  const seen = new Set();
  const out = [];
  for (const x of items) {
    const ebayId = String(x.url || "").match(/\/itm\/(?:[^/?#]+\/)?(\d{9,15})/)?.[1];
    const keys = [ebayId ? "ebay:" + ebayId : null, (x.marketplace || "") + "|" + normalizeListingText(x.title) + "|" + Math.round(Number(x.itemPrice) || 0)].filter(Boolean);
    if (keys.some(k => seen.has(k))) continue;
    // Kept listings from earlier runs must still pass today's filters.
    if (!evaluateListing({ title: x.title, query: item.query, category: item.category }).ok) continue;
    keys.forEach(k => seen.add(k));
    const y = ebayId ? { ...x, url: "https://www.ebay.com/itm/" + ebayId } : { ...x };
    if (!y.shippingKnown && y.shippingEstimated === undefined) Object.assign(y, shippingFields(y, y.marketplace, item.category));
    out.push(y);
  }
  return out;
}

// Re-rank a merged listing set the same way the site does.
function rerank(items, item) {
  items = cleanMerged(items, item);
  const market = buildMarket(items);
  const ranked = rankDeals(items, market, { query: item.query, msrp: item.msrp || 0, sortBy: "lowest" });
  return { market, ranked };
}

// Up to 200 listings per model, cheapest first — plus up to 40 more from
// stores other than eBay, so new store stock still shows on models with
// hundreds of cheaper used eBay listings.
function capResults(ranked) {
  const top = ranked.slice(0, 200);
  const extra = ranked.slice(200).filter(x => x.marketplace !== "ebay").slice(0, 40);
  return [...top, ...extra];
}

// Each save adds a point to the model's price history (lowest new / used /
// overall price), so the model page can chart prices without new searches.
function saveModel(item, payload) {
  const file = join(DATA, "models", modelSlug(item.name) + ".json");
  const { credits, resolved, sources, ...rest } = payload;
  const prev = readJson(file, null);
  const low = list => list.length ? Math.min(...list.map(x => x.totalPrice)) : null;
  const res = rest.results || [];
  const point = { at: rest.searchedAt || now(), low: low(res), newLow: low(res.filter(x => x.condition === "new")), usedLow: low(res.filter(x => x.condition !== "new")) };
  const history = [...(prev?.history || []), point].filter(p => p.low != null).slice(-90);
  writeFileSync(file, JSON.stringify({ model: item.name, query: item.query, category: item.category, msrp: item.msrp || 0, ...rest, history }));
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
    const force = args["force-free"] === "1";
    const due = models.filter(m => force || hoursSince(state.models[m.name]?.freeAt) > FREE_STALE_H);
    await pool(due, 6, async item => {
      if (Date.now() - started > RUN_LIMIT_MS * 0.8) return;
      try {
        const data = await getJson(liveUrl(item, true));
        const fresh = (data.results || []).filter(x => FREE_PROVIDER.test(x.provider || ""));
        const old = existing(item);
        const kept = (old?.results || []).filter(x => !FREE_PROVIDER.test(x.provider || ""));
        const merged = [...fresh, ...kept];
        if (!merged.length) return;
        const { market, ranked } = rerank(merged, item);
        const payload = { ...(old || data), available: true, searchedAt: now(), market, resultCount: ranked.length, results: capResults(ranked), providers: data.providers, coverage: data.coverage };
        saveModel(item, payload);
        (state.models[item.name] ||= {}).freeAt = now();
        state.models[item.name].count = ranked.length;
        log.free++;
      } catch (e) { log.errors.push(item.name + ": " + e.message); }
    });
  }

  // 1b. Newegg store listings (new, open-box and refurbished stock — often
  // cheaper than used for cases, PSUs, coolers...). Priority models first.
  if (args.newegg !== "0") {
    const prio = new Set(PRIORITY);
    const due = models
      .map(m => ({ m, age: hoursSince(state.models[m.name]?.neweggAt), p: prio.has(m.name) }))
      .filter(x => args["force-free"] === "1" || x.age > NEWEGG_STALE_H)
      .sort((a, b) => (b.p - a.p) || (b.age - a.age))
      .slice(0, NEWEGG_PER_RUN).map(x => x.m);
    let fails = 0;
    for (const item of due) {
      if (Date.now() - started > RUN_LIMIT_MS * 0.9 || fails >= 3) break;
      try {
        const fresh = await neweggListings(item);
        const old = existing(item);
        const kept = (old?.results || []).filter(x => x.provider !== NEWEGG_PROVIDER);
        const merged = [...fresh, ...kept];
        const st = (state.models[item.name] ||= {});
        st.neweggAt = now(); st.newegg = fresh.length;
        fails = 0;
        log.newegg = (log.newegg || 0) + 1;
        if (merged.length && (fresh.length || old?.results?.some(x => x.provider === NEWEGG_PROVIDER))) {
          const { market, ranked } = rerank(merged, item);
          saveModel(item, { ...(old || {}), available: true, searchedAt: old?.searchedAt || now(), market, resultCount: ranked.length, results: capResults(ranked) });
        }
      } catch (e) { fails++; log.errors.push("newegg " + item.name + ": " + e.message); }
      await new Promise(r => setTimeout(r, NEWEGG_GAP_MS));
    }
    if (log.newegg) console.log(`newegg: ${log.newegg} models checked`);
    // Amazon: same idea, fewer pages per run; stop at the first captcha.
    if (args.amazon !== "0") {
      const dueA = models
        .map(m => ({ m, age: hoursSince(state.models[m.name]?.amazonAt), p: prio.has(m.name) }))
        .filter(x => x.age > AMAZON_STALE_H)
        .sort((a, b) => (b.p - a.p) || (b.age - a.age))
        .slice(0, AMAZON_PER_RUN).map(x => x.m);
      for (const item of dueA) {
        if (Date.now() - started > RUN_LIMIT_MS * 0.9) break;
        try {
          const fresh = await amazonListings(item);
          const old = existing(item);
          const kept = (old?.results || []).filter(x => x.provider !== AMAZON_PROVIDER);
          const st = (state.models[item.name] ||= {});
          st.amazonAt = now(); st.amazon = fresh.length;
          log.amazon = (log.amazon || 0) + 1;
          if (fresh.length || old?.results?.some(x => x.provider === AMAZON_PROVIDER)) {
            const { market, ranked } = rerank([...fresh, ...kept], item);
            saveModel(item, { ...(old || {}), available: true, searchedAt: old?.searchedAt || now(), market, resultCount: ranked.length, results: capResults(ranked) });
          }
        } catch (e) { log.errors.push("amazon " + item.name + ": " + e.message); if (/captcha|HTTP 50|HTTP 429/.test(e.message)) break; }
        await new Promise(r => setTimeout(r, AMAZON_GAP_MS));
      }
      if (log.amazon) console.log(`amazon: ${log.amazon} models checked`);
    }

    // Newegg combo deals (Flipper Deals), about every 6 hours.
    if (args["force-free"] === "1" || hoursSince(state.combosAt) > NEWEGG_STALE_H) {
      try {
        const combos = await fetchNeweggCombos();
        if (combos.length) {
          writeFileSync(join(DATA, "combos.json"), JSON.stringify({ updatedAt: now(), combos }));
          state.combosAt = now();
          log.combos = combos.length;
          console.log(`newegg combos: ${combos.length}`);
        }
      } catch (e) { log.errors.push("newegg combos: " + e.message); }
    }
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
          // (and always keep the saved Newegg listings).
          const hasFree = results.some(x => FREE_PROVIDER.test(x.provider || ""));
          const freeOld = (old?.results || []).filter(x => STORE_PROVIDERS.has(x.provider) || (!hasFree && FREE_PROVIDER.test(x.provider || "")));
          const { market, ranked } = freeOld.length ? rerank([...results, ...freeOld], item) : { market: data.market, ranked: results };
          saveModel(item, { ...data, available: ranked.length > 0, market, resultCount: ranked.length, results: capResults(ranked), searchedAt: now() });
        }
        const st = (state.models[item.name] ||= {});
        st.paidAt = now(); st.credits = spent; st.count = results.length;
        log.paid++;
        console.log(`paid ${item.name}: ${results.length} listings, ${spent} credits`);
        if (/out of credits|API key rejected/i.test(JSON.stringify(data.errors || []))) { log.errors.push("paid search stopped: " + JSON.stringify(data.errors).slice(0, 200)); break; }
      } catch (e) { log.errors.push(item.name + ": " + e.message); }
    }
  }

  // 2b. Flipper Deals show saved listings: ask eBay whether the top ones are
  // still for sale (sold out, ended, box-only → removed from the saved data).
  const checkEbay = async urls => {
    const live = new Map(), gone = new Set();
    for (let i = 0; i < urls.length; i += 20) {
      const r = await getJson(SITE + "/api/deals/search?q=check&check=" + encodeURIComponent(urls.slice(i, i + 20).join(",")), 45000);
      for (const x of r.live || []) live.set(x.url, x.totalPrice);
      for (const u of r.gone || []) gone.add(u);
    }
    return { live, gone };
  };
  if (freeApis && (log.free > 0 || log.newegg > 0 || log.amazon > 0)) {
    try {
      const read = async path => readJson(join(DATA, path), null);
      const urls = new Set();
      for (const id of Object.keys(FLIPPER_SECTIONS)) {
        const sec = await flipperSection(id, read);
        for (const x of (sec?.listings || []).slice(0, 10)) if (/ebay\.com\/itm\/\d+$/.test(x.url || "")) urls.add(x.url);
      }
      const { gone } = await checkEbay([...urls]);
      if (gone.size) {
        for (const f of readdirSync(join(DATA, "models"))) {
          const file = join(DATA, "models", f);
          const snap = readJson(file, null);
          if (!snap?.results?.some(x => gone.has(x.url))) continue;
          snap.results = snap.results.filter(x => !gone.has(x.url));
          snap.resultCount = snap.results.length;
          writeFileSync(file, JSON.stringify(snap));
        }
      }
      log.flipChecked = urls.size; log.flipGone = gone.size;
      console.log(`flipper live check: ${urls.size} eBay listings checked, ${gone.size} sold out/removed`);
    } catch (e) { log.errors.push("flipper live check: " + e.message); }
  }

  // 3. Great-deal alerts from the saved listings (no credits).
  const topic = process.env.NTFY_TOPIC || "";
  if (topic && (log.free > 0 || log.paid > 0 || log.newegg > 0 || log.amazon > 0)) {
    try {
      const deals = await findGreatDeals(DATA);
      // Ask eBay (through the site) which deal listings are still for sale.
      const verify = async urls => (await checkEbay(urls)).live;
      const { sent, candidates, quiet } = await sendAlerts(deals, { topic, alerted: state.alerted || [], verify });
      if (quiet) console.log("deal alerts: quiet hours, none sent");
      state.alerted = [...sent, ...(state.alerted || [])].slice(0, 2000);
      log.alerts = sent.length;
      console.log(`deal alerts: ${sent.length} sent of ${candidates} deals`);
    } catch (e) { log.errors.push("alerts: " + e.message); }
  }

  const changed = log.free > 0 || log.paid > 0 || log.newegg > 0 || log.amazon > 0 || log.combos > 0;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, "changed=" + changed + "\n");
  if (!changed) { console.log("nothing to refresh this run", JSON.stringify(log)); return; }
  state.runs = [log, ...(state.runs || [])].slice(0, 30);
  state.updatedAt = now();
  writeFileSync(join(DATA, "state.json"), JSON.stringify(state, null, 1));
  writeFileSync(join(DATA, "links.json"), JSON.stringify(links));
  console.log(JSON.stringify(log));
}

main().catch(e => { console.error(e); process.exit(1); });
