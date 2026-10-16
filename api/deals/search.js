import { searchMarketplaces, providerStatus, buildMarket, checkEbayAvailability, searchEbay } from "../_lib/market.js";
import { withMeter } from "../_lib/meter.js";
import { readSnapshot, modelPath, ageHours } from "../_lib/snapshots.js";
import { modelPayload, filterByCondition } from "../_lib/summary.js";
import { findCatalogModel } from "../../shared/partCatalog.js";

const RESULT_LIMIT = 200;
const SNAPSHOT_MAX_AGE_H = 24 * 7;

// GET ?q=&category=&condition=&msrp=[&model=] (model pages):
//   1. a saved snapshot for that model (free, instant), else
//   2. one light live search, cached at the edge for 12 hours.
// GET ...&live=1 is the background builder: a fresh search (no edge cache)
//   that also reports credits spent and store-page matches to save.
//   &free=1 limits it to free official APIs (no credits).
// POST runs a full deep scan (direct API use).
export default async function handler(req, res) {
  const isGet = req.method === "GET";
  if (!isGet && req.method !== "POST") return res.status(405).json({ error: "GET or POST required" });
  const q = isGet ? req.query || {} : {};
  // GET ?watch=<part type> (deal watcher): the newest Buy It Now listings in
  // that eBay category, newest first, as raw offers. One eBay call.
  if (isGet && q.watch) {
    const WATCH = { gpu: ["graphics card", "GPU"], cpu: ["ryzen processor", "CPU"], ram: ["ddr4 8gb desktop", "RAM / Memory"], ssd: ["ssd", "SSD / Storage"], psu: ["power supply", "Power Supply / PSU"], mobo: ["motherboard", "Motherboard"], case: ["pc case", "PC Case"] };
    const w = WATCH[String(q.watch)];
    if (!w) return res.status(400).json({ error: "unknown watch type" });
    try {
      const offers = await searchEbay({ query: w[0], category: w[1], condition: "any", sort: "newlyListed", limit: 100 });
      res.setHeader?.("Cache-Control", "no-store");
      return res.status(200).json({ ok: true, offers });
    } catch (error) {
      return res.status(200).json({ ok: false, error: String(error?.message || error).slice(0, 160) });
    }
  }
  // GET ?check=<eBay item URL>,... (deal alerts): which of these listings eBay
  // confirms are still for sale right now, with their current price.
  if (isGet && q.check) {
    const urls = String(q.check).split(",").map(u => u.trim()).filter(u => /^https:\/\/www\.ebay\.com\/itm\/\d{9,15}$/.test(u)).slice(0, 20);
    const r = await checkEbayAvailability(urls.map(url => ({ url, marketplace: "ebay", totalPrice: 0, itemPrice: 0 })), { limit: 20 });
    res.setHeader?.("Cache-Control", "no-store");
    const kept = new Set(r.items.map(x => x.url));
    return res.status(200).json({ checked: r.checked, error: r.error,
      live: r.items.filter(x => x.liveChecked).map(x => ({ url: x.url, itemPrice: x.itemPrice, shipping: x.shipping, totalPrice: x.totalPrice })),
      gone: urls.filter(u => !kept.has(u)) });
  }
  if (isGet) req.body = { query: q.q, category: q.category, condition: q.condition, msrp: q.msrp };
  const live = isGet && q.live === "1";
  const input = {
    category: req.body?.category || "GPU",
    query: String(req.body?.query || "").trim().slice(0, 160),
    condition: req.body?.condition || "any",
    msrp: Math.max(0, Number(req.body?.msrp) || 0),
    partBudget: Number(req.body?.partBudget || 0),
    buildBudget: Number(req.body?.buildBudget || 0),
    committed: Number(req.body?.committed || 0),
    sortBy: req.body?.sortBy || "lowest",
    deepScan: true,
    free: live && q.free === "1",
    providerKeys: {
      SERPER_API_KEY: req.body?.providerKeys?.SERPER_API_KEY || "",
      SEARCHAPI_API_KEY: req.body?.providerKeys?.SEARCHAPI_API_KEY || ""
    }
  };
  if (!input.query) return res.status(400).json({ available: false, message: "Enter a part or model to search." });

  if (isGet && !live) {
    const name = String(q.model || "") || findCatalogModel(input.query)?.item.name || "";
    const snap = name ? await readSnapshot(modelPath(name)) : null;
    if (snap?.results?.length && ageHours(snap.searchedAt) < SNAPSHOT_MAX_AGE_H) {
      // Ask eBay which of the cheapest saved listings are still for sale.
      const live = await checkEbayAvailability(filterByCondition(snap.results, input.condition));
      const results = live.items;
      const market = input.condition === "any" && !live.removed ? snap.market : { ...snap.market, ...pick(buildMarket(results)) };
      res.setHeader?.("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
      return res.status(200).json({ ...snap, available: results.length > 0, market, results, resultCount: results.length, snapshot: true, liveCheck: { checked: live.checked, removed: live.removed, error: live.error },
        message: results.length ? undefined : "No " + input.condition + " listings in the latest update for this model." });
    }
  }

  const connected = providerStatus(input.providerKeys).some(x => x.status === "Connected");
  if (!connected) {
    return res.status(200).json({ available: false, message: "No market data provider is configured.", sources: providerStatus(input.providerKeys) });
  }

  const mode = live ? { snapshot: true } : isGet ? { lite: true } : {};
  const { result, meter } = await withMeter(() => searchMarketplaces(input, { includeOtherMerchants: true, ...mode }));
  const body = { ...modelPayload(result, RESULT_LIMIT), sources: providerStatus(input.providerKeys) };
  if (live) { body.credits = meter.credits; body.resolved = meter.resolved; }
  if (!result.market.sampleSize) {
    const failed = result.providers.filter(p => p.status !== "ok");
    body.message = failed.length === result.providers.length && failed.length
      ? "Every market data provider failed for this search: " + failed.map(p => p.name + " — " + p.message).join("; ")
      : "No listing matched this exact part and condition right now. See provider notes for what was filtered out.";
  }
  if (isGet && !live && result.market.sampleSize) res.setHeader?.("Cache-Control", "public, s-maxage=43200, stale-while-revalidate=86400");
  else res.setHeader?.("Cache-Control", "no-store");
  res.status(200).json(body);
}

function pick(m) {
  return { median: m.median, low: m.low, high: m.high, sampleSize: m.sampleSize, byCondition: m.byCondition, bySource: m.bySource, conditionMedians: m.conditionMedians };
}
