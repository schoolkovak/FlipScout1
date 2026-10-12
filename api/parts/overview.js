import { searchMarketplaces, providerStatus } from "../_lib/market.js";

// Browse grid: new + used Google Shopping queries and one eBay/AliExpress/
// Mercari item-page search per model, returning the
// cheapest qualified listings so the browser can pick by pricing mode
// (cheapest / best deal / only new) without another request.
const MAX_ITEMS = 12;

function slim(x) {
  return {
    id: x.id, title: x.title, source: x.source, marketplace: x.marketplace, condition: x.condition,
    totalPrice: x.totalPrice, itemPrice: x.itemPrice, shippingKnown: x.shippingKnown, url: x.url,
    linkType: x.linkType, image: x.image || null, score: x.score, percentVsMarket: x.percentVsMarket
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
  const providerKeys = {
    SERPER_API_KEY: req.body?.providerKeys?.SERPER_API_KEY || "",
    SEARCHAPI_API_KEY: req.body?.providerKeys?.SEARCHAPI_API_KEY || ""
  };
  if (!providerStatus(providerKeys).some(x => x.status === "Connected")) {
    return res.status(200).json({ available: false, message: "No market data provider is configured. Add SERPER_API_KEY to the server environment.", items: [] });
  }
  const items = (Array.isArray(req.body?.items) ? req.body.items : []).slice(0, MAX_ITEMS)
    .map(x => ({ id: String(x?.id || x?.query || ""), query: String(x?.query || "").trim().slice(0, 120), category: String(x?.category || "GPU") }))
    .filter(x => x.query);
  if (!items.length) return res.status(400).json({ available: false, message: "No parts requested.", items: [] });

  const results = await Promise.all(items.map(async item => {
    try {
      const data = await searchMarketplaces({ query: item.query, category: item.category, condition: "any", sortBy: "lowest", providerKeys }, { includeOtherMerchants: true, lite: true });
      const listings = data.ranked.slice().sort((a, b) => a.totalPrice - b.totalPrice);
      const isUsed = x => ["used", "refurbished", "renewed", "open-box"].includes(x.condition);
      const newOnes = listings.filter(x => x.condition === "new");
      const usedOnes = listings.filter(isUsed);
      const best = data.ranked.slice().sort((a, b) => b.score - a.score);
      const pick = [...new Map([...listings.slice(0, 12), ...newOnes.slice(0, 5), ...usedOnes.slice(0, 5), ...best.slice(0, 3)].map(x => [x.id, x])).values()];
      return {
        id: item.id,
        available: listings.length > 0,
        count: listings.length,
        stores: new Set(listings.map(x => x.marketplace === "other" ? x.source : x.marketplace)).size,
        newCount: newOnes.length,
        usedCount: usedOnes.length,
        newFrom: newOnes[0]?.totalPrice ?? null,
        usedFrom: usedOnes[0]?.totalPrice ?? null,
        median: data.market.median,
        image: listings.find(x => x.image)?.image || null,
        listings: pick.map(slim),
        // What each source returned, so a thin card can be explained.
        sources: data.providers.map(p => ({ name: p.name, status: p.status, message: p.message, raw: p.raw, kept: p.kept, dropped: p.dropped })),
        byStore: Object.entries(listings.reduce((m, x) => (m[x.source] = (m[x.source] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1]),
        searchedAt: data.observedAt,
        errors: data.errors
      };
    } catch (error) {
      return { id: item.id, available: false, count: 0, listings: [], errors: [{ provider: "FlipScout", message: String(error?.message || error).slice(0, 160) }] };
    }
  }));
  res.status(200).json({ available: results.some(x => x.available), searchedAt: new Date().toISOString(), items: results });
}
