// Shapes shared by the live endpoints and the snapshot builder.
const USED = ["used", "refurbished", "renewed", "open-box"];

export function slimListing(x) {
  return {
    id: x.id, title: x.title, source: x.source, marketplace: x.marketplace, condition: x.condition,
    totalPrice: x.totalPrice, itemPrice: x.itemPrice, shipping: x.shipping, shippingKnown: x.shippingKnown, url: x.url,
    linkType: x.linkType, image: x.image || null, score: x.score, percentVsMarket: x.percentVsMarket,
    provider: x.provider, seller: x.seller, riskFlags: x.riskFlags, dealLabel: x.dealLabel, conditionAssumed: x.conditionAssumed
  };
}

// Full model payload (what the model page renders).
export function modelPayload(result, limit = 200) {
  return {
    available: result.ranked.length > 0,
    searchedAt: result.observedAt,
    market: {
      median: result.market.median, low: result.market.low, high: result.market.high,
      sampleSize: result.market.sampleSize, rawSampleSize: result.market.rawSampleSize,
      byCondition: result.market.byCondition, bySource: result.market.bySource,
      conditionMedians: result.market.conditionMedians, shippingKnownPct: result.market.shippingKnownPct,
      confidence: result.market.confidence, valueLabel: "Current asking-market value"
    },
    resultCount: result.ranked.length,
    results: result.ranked.slice(0, limit),
    errors: result.errors,
    providers: result.providers,
    coverage: result.coverage
  };
}

// One browse card, from a model payload's results.
export function cardFromResults(id, results, { median = null, searchedAt = null, sources = [], errors = [] } = {}) {
  const listings = results.slice().sort((a, b) => a.totalPrice - b.totalPrice);
  const newOnes = listings.filter(x => x.condition === "new");
  const usedOnes = listings.filter(x => USED.includes(x.condition));
  const best = results.slice().sort((a, b) => (b.score || 0) - (a.score || 0));
  const pick = [...new Map([...listings.slice(0, 12), ...newOnes.slice(0, 5), ...usedOnes.slice(0, 5), ...best.slice(0, 3)].map(x => [x.id, x])).values()];
  return {
    id,
    available: listings.length > 0,
    count: listings.length,
    stores: new Set(listings.map(x => x.marketplace === "other" ? x.source : x.marketplace)).size,
    newCount: newOnes.length,
    usedCount: usedOnes.length,
    newFrom: newOnes[0]?.totalPrice ?? null,
    usedFrom: usedOnes[0]?.totalPrice ?? null,
    median,
    image: listings.find(x => x.image)?.image || null,
    listings: pick.map(slimListing),
    sources,
    byStore: Object.entries(listings.reduce((m, x) => (m[x.source] = (m[x.source] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1]),
    searchedAt,
    errors
  };
}

export function filterByCondition(results, condition) {
  if (!condition || condition === "any") return results;
  if (condition === "used") return results.filter(x => USED.includes(x.condition));
  if (condition === "refurbished" || condition === "renewed") return results.filter(x => x.condition === "refurbished" || x.condition === "renewed");
  return results.filter(x => x.condition === condition);
}
