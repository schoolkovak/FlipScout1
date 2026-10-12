import { searchMarketplaces, providerStatus } from "../_lib/market.js";
import { findSeries } from "../../shared/partCatalog.js";
import { readSnapshot, modelPath, ageHours } from "../_lib/snapshots.js";
import { cardFromResults } from "../_lib/summary.js";

// Browse grid. GET ?group=&series= reads each model's saved snapshot (built
// in the background by scripts/build-snapshots.mjs): no credits, instant.
// Models not saved yet come back as `pending` instead of triggering paid
// searches. POST (direct API use) still runs light live searches.
const MAX_ITEMS = 12;
const SNAPSHOT_MAX_AGE_H = 24 * 7;

export default async function handler(req, res) {
  const isGet = req.method === "GET";
  if (!isGet && req.method !== "POST") return res.status(405).json({ error: "GET or POST required" });

  if (isGet) {
    const { series } = findSeries(String(req.query?.group || "gpu"), String(req.query?.series || ""));
    const items = await Promise.all(series.items.slice(0, MAX_ITEMS).map(async item => {
      const snap = await readSnapshot(modelPath(item.name));
      if (!snap?.results?.length || ageHours(snap.searchedAt) > SNAPSHOT_MAX_AGE_H) {
        return { id: item.name, available: false, pending: true, count: 0, listings: [], searchedAt: snap?.searchedAt || null };
      }
      return cardFromResults(item.name, snap.results, {
        median: snap.market?.median ?? null, searchedAt: snap.searchedAt,
        sources: (snap.providers || []).map(p => ({ name: p.name, status: p.status, message: p.message, raw: p.raw, kept: p.kept, dropped: p.dropped }))
      });
    }));
    const updated = items.map(x => x.searchedAt).filter(Boolean).sort();
    res.setHeader?.("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    return res.status(200).json({ available: items.some(x => x.available), snapshot: true, searchedAt: updated[updated.length - 1] || null, items });
  }

  const providerKeys = {
    SERPER_API_KEY: req.body?.providerKeys?.SERPER_API_KEY || "",
    SEARCHAPI_API_KEY: req.body?.providerKeys?.SEARCHAPI_API_KEY || ""
  };
  if (!providerStatus(providerKeys).some(x => x.status === "Connected")) {
    return res.status(200).json({ available: false, message: "No market data provider is configured.", items: [] });
  }
  const items = (Array.isArray(req.body?.items) ? req.body.items : []).slice(0, MAX_ITEMS)
    .map(x => ({ id: String(x?.id || x?.query || ""), query: String(x?.query || "").trim().slice(0, 120), category: String(x?.category || "GPU"), msrp: Math.max(0, Number(x?.msrp) || 0) }))
    .filter(x => x.query);
  if (!items.length) return res.status(400).json({ available: false, message: "No parts requested.", items: [] });
  const results = await Promise.all(items.map(async item => {
    try {
      const data = await searchMarketplaces({ query: item.query, category: item.category, msrp: item.msrp, condition: "any", sortBy: "lowest", providerKeys }, { includeOtherMerchants: true, lite: true });
      return cardFromResults(item.id, data.ranked, {
        median: data.market.median, searchedAt: data.observedAt, errors: data.errors,
        sources: data.providers.map(p => ({ name: p.name, status: p.status, message: p.message, raw: p.raw, kept: p.kept, dropped: p.dropped }))
      });
    } catch (error) {
      return { id: item.id, available: false, count: 0, listings: [], errors: [{ provider: "FlipScout", message: String(error?.message || error).slice(0, 160) }] };
    }
  }));
  res.setHeader?.("Cache-Control", "no-store");
  res.status(200).json({ available: results.some(x => x.available), searchedAt: new Date().toISOString(), items: results });
}
