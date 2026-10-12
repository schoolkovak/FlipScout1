// Search pipeline tests: listing matcher, provider fan-out, condition
// handling, de-duplication, error reporting and sorting. Provider HTTP is
// stubbed with response shapes from each provider; scripts/live-audit.mjs
// runs the same pipeline against the real providers.
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateListing, classifyCondition } from "../api/_lib/matching.js";
import { searchMarketplaces, searchPartsSniper, providerStatus, qualifyOffers, rankDeals, buildMarket } from "../api/_lib/market.js";
import { sortDeals } from "../shared/dealSort.js";
import dealsHandler from "../api/deals/search.js";
import { LISTING_CORPUS } from "./fixtures/listing-corpus.mjs";

let keySeq = 0;
const keys = () => ({ SERPER_API_KEY: "serper-test-" + (++keySeq), SEARCHAPI_API_KEY: "searchapi-test-" + keySeq });

function stubFetch(routes) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    const u = new URL(url);
    const engine = u.searchParams.get("engine");
    const body = options?.body ? JSON.parse(options.body) : null;
    const id = u.hostname === "google.serper.dev" ? "serper" : engine;
    calls.push({ id, q: body?.q || u.searchParams.get("q"), params: Object.fromEntries(u.searchParams), body });
    const route = routes[id];
    if (!route) throw new Error("unexpected provider " + id);
    const out = await route({ q: body?.q || u.searchParams.get("q"), params: u.searchParams, body });
    if (out && out.status) return { ok: false, status: out.status, text: async () => JSON.stringify(out.body || {}) };
    return { ok: true, status: 200, json: async () => out };
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

test("matcher: every corpus listing is kept or rejected correctly", () => {
  const wrong = [];
  for (const c of LISTING_CORPUS) {
    const r = evaluateListing({ title: c.title, query: c.query, category: c.category, structuredCondition: c.structuredCondition });
    if ((c.expect === "keep") !== r.ok) wrong.push(`${c.expect} [${c.query}] ${c.title} -> ${r.reason || "kept"}`);
  }
  assert.deepEqual(wrong, []);
});

test("matcher: rejection reasons explain why a listing disappeared", () => {
  const reason = (title, query, category, extra = {}) => evaluateListing({ title, query, category, ...extra }).reason;
  assert.equal(reason("MSI GeForce RTX 4060 Ti VENTUS 2X BLACK 8G OC", "RTX 4060 Ti 16GB", "GPU"), "vram-mismatch");
  assert.equal(reason("Sapphire PULSE AMD Radeon RX 9070 16GB", "RX 9070 XT", "GPU"), "model-mismatch");
  assert.equal(reason("NVIDIA RTX 3080 10GB", "RTX 3080", "GPU", { structuredCondition: "For parts or not working" }), "broken-or-parts");
  assert.equal(reason("Samsung 990 PRO 1TB", "2TB NVMe SSD", "NVMe SSD"), "capacity-mismatch");
  assert.equal(reason("EVGA 850 BQ 80+ Bronze 850W", "850W 80+ Gold PSU", "PSU"), "efficiency-mismatch");
});

test("condition: eBay/Walmart/Amazon wording maps to the right family", () => {
  assert.equal(classifyCondition("Pre-Owned", { structured: true }), "used");
  assert.equal(classifyCondition("Very Good", { structured: true }), "used");
  assert.equal(classifyCondition("New (Other)", { structured: true }), "open-box");
  assert.equal(classifyCondition("Open box", { structured: true }), "open-box");
  assert.equal(classifyCondition("Certified - Refurbished", { structured: true }), "refurbished");
  assert.equal(classifyCondition("Restored MSI RTX 3060 12GB"), "refurbished");
  assert.equal(classifyCondition("ASUS RTX 4070 (Renewed)"), "renewed");
  assert.equal(classifyCondition("For parts or not working", { structured: true }), "parts");
  assert.equal(classifyCondition("Tested, no artifacts, works great"), "unknown");
  assert.equal(classifyCondition("Brand new, factory sealed"), "new");
});

test("used search does not relabel new retail stock as used", async () => {
  const offers = [
    { provider: "Google Shopping (Serper)", marketplace: "amazon", seller: "Amazon.com", title: "MSI GeForce RTX 5070 12G Ventus 2X OC", url: "https://www.amazon.com/dp/B0DTEST001", itemPrice: 549, totalPrice: 549, shipping: 0, shippingKnown: true, defaultCondition: "new" },
    { provider: "Google Shopping (Serper)", marketplace: "mercari", seller: "Mercari", title: "RTX 5070 Founders Edition", url: "https://www.mercari.com/us/item/m123456/", itemPrice: 470, totalPrice: 470, shipping: 0, shippingKnown: false, defaultCondition: "used" }
  ];
  const { items, stats } = qualifyOffers(offers, { query: "RTX 5070", category: "GPU", condition: "used" });
  assert.deepEqual(items.map(x => x.marketplace), ["mercari"]);
  assert.equal(stats.get("Google Shopping (Serper)").dropped["condition-mismatch"], 1);
});

test("Deal Scanner queries Google Shopping, eBay, and direct stores missing from Google results", async () => {
  const gpu = "GIGABYTE GeForce RTX 5070 WINDFORCE OC SFF 12G Graphics Card";
  const stub = stubFetch({
    serper: ({ q }) => ({ shopping: q.startsWith("used ") ? [
      { title: "RTX 5070 Founders Edition - used", source: "Mercari", price: "$455.00", link: "https://www.mercari.com/us/item/m999/" }
    ] : [
      { title: gpu, source: "Newegg.com", price: "$549.99", delivery: "Free delivery", link: "https://www.newegg.com/p/N82E16814932777" },
      { title: "ASUS Prime GeForce RTX 5070 OC 12GB", source: "Micro Center", price: "$559.99", link: "https://www.microcenter.com/product/1" },
      { title: "PNY RTX 5070 OC 12GB", source: "Central Computers", price: "$569.00", delivery: "$9.99 delivery", link: "https://www.centralcomputer.com/pny-5070.html" },
      { title: "RTX 5070 Ti 16GB", source: "Newegg.com", price: "$749.99", link: "https://www.newegg.com/p/N82E16814932778" }
    ] }),
    ebay_search: () => ({ organic_results: [
      { title: "MSI RTX 5070 12G Ventus 2X OC", extracted_price: 480, extracted_shipping: 15, condition: "Pre-Owned", item_id: "1", link: "https://www.ebay.com/itm/123456789012" },
      { title: "RTX 5070 12GB no display", extracted_price: 150, condition: "For parts or not working", item_id: "2", link: "https://www.ebay.com/itm/123456789013" }
    ] }),
    amazon_search: () => ({ organic_results: [{ title: "ZOTAC GAMING GeForce RTX 5070 Twin Edge OC 12GB", asin: "B0DTEST0AA", extracted_price: 549.99, link: "https://www.amazon.com/dp/B0DTEST0AA" }] }),
    walmart_search: () => ({ organic_results: [{ title: "PNY GeForce RTX 5070 Epic-X 12GB", extracted_price: 579, is_free_shipping: true, seller_name: "Walmart.com", link: "https://www.walmart.com/ip/pny-5070/123456789" }] }),
    bestbuy_search: () => ({ organic_results: [{ title: "NVIDIA GeForce RTX 5070 12GB GDDR7 Graphics Card", product_id: "6614154", extracted_price: 549.99, link: "https://www.bestbuy.com/site/6614154.p?skuId=6614154", open_box_options: [{ condition: "Excellent", extracted_price: 489.99 }] }] })
  });
  try {
    const result = await searchMarketplaces({ query: "RTX 5070", category: "GPU", condition: "any", providerKeys: keys() }, { includeOtherMerchants: true });
    const engines = stub.calls.map(c => c.id);
    const shoppingQs = stub.calls.filter(c => c.id === "serper").map(c => c.q);
    for (const q of ["RTX 5070", "used RTX 5070", "refurbished RTX 5070"]) assert.ok(shoppingQs.includes(q), q);
    assert.ok(shoppingQs.some(q => /aliexpress|b&h photo|adorama/.test(q)), "store-targeted query for a store Google missed");
    for (const e of ["ebay_search", "amazon_search", "walmart_search", "bestbuy_search"]) assert.ok(engines.includes(e), e);
    const stores = new Set(result.ranked.map(x => x.marketplace));
    for (const id of ["newegg", "microcenter", "mercari", "ebay", "amazon", "walmart", "bestbuy", "other"]) assert.ok(stores.has(id), id);
    assert.ok(!result.ranked.some(x => /5070 ti|no display/i.test(x.title)), "wrong model and broken listing filtered");
    assert.ok(result.ranked.some(x => x.condition === "open-box" && x.marketplace === "bestbuy"));
    const ebay = result.providers.find(p => p.name === "eBay (SearchAPI)");
    assert.equal(ebay.raw, 2);
    assert.equal(ebay.kept, 1);
    assert.equal(ebay.dropped["broken-or-parts"], 1);
    assert.equal(result.coverage.find(c => c.id === "amazon").direct, true);
    assert.equal(new Set(result.ranked.map(x => x.id)).size, result.ranked.length, "listing ids are unique (UI keys)");
  } finally { stub.restore(); }
});

test("no extra direct-store request when Google Shopping already covers that store", async () => {
  const stub = stubFetch({
    serper: () => ({ shopping: [
      { title: "AMD Ryzen 7 9800X3D 8-Core Desktop Processor", source: "Amazon.com", price: "$479.00", link: "https://www.amazon.com/dp/B0DKFMSMYK" },
      { title: "AMD Ryzen 7 9800X3D 8-Core Desktop Processor", source: "Walmart - Seller", price: "$489.00", link: "https://www.walmart.com/ip/5000000001" },
      { title: "AMD Ryzen 7 9800X3D Processor", source: "Best Buy", price: "$479.99", link: "https://www.bestbuy.com/site/6604220.p?skuId=6604220" }
    ] }),
    ebay_search: () => ({ organic_results: [] })
  });
  try {
    const result = await searchPartsSniper({ query: "Ryzen 7 9800X3D", category: "CPU", condition: "new", marketplaces: ["amazon", "walmart", "bestbuy", "ebay"], providerKeys: keys() });
    // Amazon/Walmart/Best Buy were covered by Google Shopping: no direct store calls.
    assert.ok(!stub.calls.some(c => ["amazon_search", "walmart_search", "bestbuy_search"].includes(c.id)));
    assert.ok(stub.calls.some(c => c.id === "serper" && c.q === "Ryzen 7 9800X3D ebay"), "eBay gap filled with a targeted query");
    assert.equal(result.ranked.length, 3);
  } finally { stub.restore(); }
});

test("same Amazon item from Google Shopping and Amazon search is shown once, direct copy kept", () => {
  const google = { provider: "Google Shopping (Serper)", marketplace: "amazon", seller: "Amazon.com", title: "Samsung 990 PRO 2TB PCIe 4.0 NVMe SSD", url: "https://www.amazon.com/Samsung-990-PRO/dp/B0BHJJ9Y77?tag=x", itemPrice: 169.99, totalPrice: 169.99, shipping: 0, shippingKnown: false, defaultCondition: "new" };
  const direct = { ...google, provider: "Amazon (SearchAPI)", seller: "Amazon", title: "SAMSUNG 990 PRO SSD 2TB PCIe 4.0 M.2 2280 Internal Solid State Drive", url: "https://www.amazon.com/dp/B0BHJJ9Y77", shippingKnown: true };
  const { items } = qualifyOffers([google, direct, { ...google }], { query: "2TB NVMe SSD", category: "NVMe SSD", condition: "new" });
  assert.equal(items.length, 1);
  assert.equal(items[0].provider, "Amazon (SearchAPI)");
  assert.equal(items[0].shippingKnown, true);
});

test("an out-of-credit provider is reported clearly and stops being called; others still return listings", async () => {
  const providerKeys = keys();
  const stub = stubFetch({
    serper: () => ({ shopping: [{ title: "Corsair RM850x 850W 80 PLUS Gold ATX 3.1 Power Supply", source: "Newegg", price: "$129.99", link: "https://www.newegg.com/p/N82E16817139326" }] }),
    ebay_search: () => ({ status: 429, body: { error: "You have run out of searches for this month (api_key=" + providerKeys.SEARCHAPI_API_KEY + ")" } })
  });
  try {
    const first = await searchPartsSniper({ query: "850W Gold PSU", category: "Power Supply / PSU", condition: "new", marketplaces: ["newegg", "ebay"], providerKeys });
    assert.equal(first.ranked.length, 1);
    const ebay = first.providers.find(p => p.name === "eBay (SearchAPI)");
    assert.equal(ebay.status, "error");
    assert.match(ebay.message, /out of credits or rate-limited \(HTTP 429\)/);
    assert.ok(!ebay.message.includes(providerKeys.SEARCHAPI_API_KEY), "API key never echoed");
    const before = stub.calls.filter(c => c.id === "ebay_search").length;
    await searchPartsSniper({ query: "1000W Gold PSU", category: "Power Supply / PSU", condition: "new", marketplaces: ["newegg", "ebay"], providerKeys });
    assert.equal(stub.calls.filter(c => c.id === "ebay_search").length, before, "circuit breaker skips the exhausted key");
  } finally { stub.restore(); }
});

test("Deal Scanner API returns provider diagnostics when nothing qualifies", async () => {
  const stub = stubFetch({
    serper: () => ({ shopping: [{ title: "RTX 4090 Water Block", source: "Amazon.com", price: "$150", link: "https://www.amazon.com/dp/B0WATERBLK" }] }),
    ebay_search: () => ({ organic_results: [] }),
    amazon_search: () => ({ organic_results: [] }),
    walmart_search: () => ({ organic_results: [] }),
    bestbuy_search: () => ({ organic_results: [] })
  });
  try {
    let body;
    await dealsHandler({ method: "POST", body: { query: "RTX 4090", category: "GPU", condition: "new", providerKeys: keys() } }, { status() { return this; }, json(x) { body = x; return x; } });
    assert.equal(body.available, false);
    const serper = body.providers.find(p => p.name === "Google Shopping (Serper)");
    assert.ok(serper.dropped.accessory >= 1);
  } finally { stub.restore(); }
});

test("credentials come only from the environment or the request", () => {
  const before = { ...process.env };
  try {
    process.env.VERCEL = "1";
    delete process.env.SERPER_API_KEY;
    delete process.env.SEARCHAPI_API_KEY;
    const status = Object.fromEntries(providerStatus({}).map(x => [x.id, x.status]));
    assert.equal(status.serper, "Missing credentials");
    assert.equal(status.searchapi, "Missing credentials");
    process.env.SERPER_API_KEY = "from-env";
    assert.equal(providerStatus({}).find(x => x.id === "serper").status, "Connected");
  } finally { process.env = before; }
});

test("sorting: Lowest Total Price and Best Deal reorder the same loaded results", () => {
  const rows = [
    { id: "a", title: "RTX 5070 used", totalPrice: 470, itemPrice: 455, shipping: 15, shippingKnown: true, condition: "used", relevance: 1, url: "https://www.ebay.com/itm/111111111111" },
    { id: "b", title: "RTX 5070 new", totalPrice: 549, itemPrice: 549, shipping: 0, shippingKnown: true, condition: "new", relevance: 1, url: "https://www.amazon.com/dp/B0AAAAAAAA" },
    { id: "c", title: "RTX 5070 open box", totalPrice: 489, itemPrice: 489, shipping: 0, shippingKnown: false, condition: "open-box", relevance: 1, url: "https://www.bestbuy.com/site/1.p?skuId=1234567" },
    { id: "d", title: "RTX 5070 new", totalPrice: 470, itemPrice: 470, shipping: 0, shippingKnown: false, condition: "new", relevance: 1, url: "https://www.walmart.com/ip/99999" }
  ];
  const ranked = rankDeals(rows, buildMarket(rows), { query: "RTX 5070", sortBy: "best" });
  const lowest = sortDeals(ranked, "lowest");
  assert.deepEqual(lowest.map(x => x.totalPrice), [470, 470, 489, 549]);
  assert.equal(lowest[0].id, "a", "known delivered price wins a tie");
  const best = sortDeals(lowest, "best");
  for (let i = 1; i < best.length; i++) assert.ok(best[i - 1].score >= best[i].score);
  assert.equal(sortDeals(ranked, "lowest").length, ranked.length, "re-sorting never drops listings");
});

test("every scan is deep and never asks eBay for for-parts listings", async () => {
  const stub = stubFetch({
    serper: () => ({ shopping: [] }),
    ebay_search: () => ({ organic_results: [] }),
    amazon_search: () => ({ organic_results: [] }),
    walmart_search: () => ({ organic_results: [] }),
    bestbuy_search: () => ({ organic_results: [] })
  });
  try {
    await searchPartsSniper({ query: "RTX 4080 Super", category: "GPU", condition: "any", deepScan: false, marketplaces: ["ebay", "amazon", "newegg"], providerKeys: keys() });
    const ebay = stub.calls.find(c => c.id === "ebay_search");
    assert.ok(ebay.params.condition && !ebay.params.condition.includes("for_parts"), "condition filter excludes for-parts");
    assert.ok(stub.calls.filter(c => c.id === "serper").length >= 3, "deep scan even when deepScan=false");
  } finally { stub.restore(); }
});

test("SerpApi eBay engine requests sellable conditions only", async () => {
  const before = process.env.SERPAPI_API_KEY;
  process.env.SERPAPI_API_KEY = "serpapi-test";
  const stub = stubFetch({
    serper: () => ({ shopping: [] }),
    ebay: () => ({ organic_results: [
      { title: "ASUS TUF RTX 4080 SUPER 16GB", link: "https://www.ebay.com/itm/223344556677", condition: "Pre-Owned", price: { raw: "$849.00", extracted: 849 }, shipping: "Free shipping" }
    ] })
  });
  try {
    const result = await searchPartsSniper({ query: "RTX 4080 Super", category: "GPU", condition: "any", marketplaces: ["ebay"], providerKeys: { SERPER_API_KEY: "serper-serpapi-test" } });
    const call = stub.calls.find(c => c.id === "ebay");
    assert.equal(call.params.LH_ItemCondition, "1000|1500|2000|2010|2020|2030|2500|3000");
    assert.ok(!call.params.LH_ItemCondition.includes("7000"));
    const item = result.ranked.find(x => x.provider === "eBay (SerpApi)");
    assert.equal(item.totalPrice, 849);
    assert.equal(item.condition, "used");
    assert.equal(item.shippingKnown, true);
  } finally { stub.restore(); if (before === undefined) delete process.env.SERPAPI_API_KEY; else process.env.SERPAPI_API_KEY = before; }
});

test("unknown web shops and too-good-to-be-true prices are dropped; missing links become store searches", () => {
  const base = { provider: "Google Shopping (Serper)", shipping: 0, shippingKnown: false, defaultCondition: "new" };
  const mk = (seller, title, price, url) => ({ ...base, seller, title, itemPrice: price, totalPrice: price, url });
  const offers = [
    mk("mafsantander.com", "vga sapphire rx 5700 xt rgb Graphics Card", 54, "https://mafsantander.com/p/1"),
    mk("resmab.eu", "Graphics Card AMD Radeon RX 5700 XT", 63, "https://resmab.eu/x"),
    mk("eBay", "XFX Radeon RX 5700 XT Thicc II Ultra 8GB", 160, null),
    mk("eBay", "Sapphire Pulse RX 5700 XT 8GB", 70, "https://www.ebay.com/itm/111122223333"),
    ...[170, 175, 180, 185, 190, 199].map((p, i) => mk("Newegg.com", "PowerColor Red Devil RX 5700 XT 8GB " + i, p, "https://www.newegg.com/p/N82E1681413" + i))
  ];
  const { items, stats } = qualifyOffers(offers, { query: "RX 5700 XT", category: "GPU", condition: "any" });
  assert.ok(!items.some(x => /mafsantander|resmab/.test(x.seller)));
  assert.equal(stats.get("Google Shopping (Serper)").dropped["untrusted-store"], 2);
  assert.ok(!items.some(x => x.totalPrice === 70), "$70 when the median is ~$180 is dropped");
  const noLink = items.find(x => x.title.startsWith("XFX"));
  assert.equal(noLink.linkType, "store-search");
  assert.match(noLink.url, /^https:\/\/www\.ebay\.com\/sch\/i\.html/);
});
