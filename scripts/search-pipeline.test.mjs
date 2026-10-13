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
  const ebaySeen = new Map();
  const remember = out => JSON.stringify(out || {}, (k, v) => {
    if (v && typeof v === "object" && typeof v.link === "string" && /ebay\.com\/itm\/(\d+)/.test(v.link)) {
      const id = v.link.match(/\/itm\/(\d+)/)[1];
      const price = Number(v.extracted_price ?? v.price?.extracted ?? String(v.snippet || "").match(/\$(\d+(?:\.\d+)?)/)?.[1]) || null;
      if (!ebaySeen.has(id) || price) ebaySeen.set(id, { title: String(v.title || "").replace(/\s*\|\s*eBay$/, ""), price });
    }
    return v;
  });
  globalThis.fetch = async (url, options) => {
    const u = new URL(url);
    if (/(^|\.)ebay\.com$/.test(u.hostname) && !u.searchParams.get("engine")) {
      // Live item-page check: a stubbed live Buy It Now page (tests may override).
      const id = u.pathname.match(/\/itm\/(\d+)/)?.[1];
      calls.push({ id: "ebay-page", path: u.pathname });
      const seen = ebaySeen.get(id) || {};
      const page = routes["ebay-page"] ? await routes["ebay-page"]({ id, seen }) : null;
      const price = seen.price ? "US $" + seen.price.toFixed(2) : "US $1.00 to US $99999.00";
      const html = page?.html ?? `<h1 class="x-item-title__mainTitle"><span class="ux-textspans ux-textspans--BOLD">${seen.title || "Item"}</span></h1><div class="x-price-primary"><span class="ux-textspans">${price}</span></div><button>Buy It Now</button>`;
      return { ok: (page?.status || 200) < 400, status: page?.status || 200, url: u.href, text: async () => html };
    }
    const engine = u.searchParams.get("engine");
    const body = options?.body ? JSON.parse(options.body) : null;
    const id = u.hostname === "google.serper.dev" ? "serper" : engine;
    calls.push({ id, path: u.pathname, q: body?.q || u.searchParams.get("q"), params: Object.fromEntries(u.searchParams), body });
    const route = routes[id];
    if (!route) throw new Error("unexpected provider " + id);
    const out = await route({ q: body?.q || u.searchParams.get("q"), params: u.searchParams, body, path: u.pathname });
    remember(out);
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
    { provider: "Store price search", marketplace: "amazon", seller: "Amazon.com", title: "MSI GeForce RTX 5070 12G Ventus 2X OC", url: "https://www.amazon.com/dp/B0DTEST001", itemPrice: 549, totalPrice: 549, shipping: 0, shippingKnown: true, defaultCondition: "new" },
    { provider: "Store price search", marketplace: "mercari", seller: "Mercari", title: "RTX 5070 Founders Edition", url: "https://www.mercari.com/us/item/m123456/", itemPrice: 470, totalPrice: 470, shipping: 0, shippingKnown: false, defaultCondition: "used" }
  ];
  const { items, stats } = qualifyOffers(offers, { query: "RTX 5070", category: "GPU", condition: "used" });
  assert.deepEqual(items.map(x => x.marketplace), ["mercari"]);
  assert.equal(stats.get("Store price search").dropped["condition-mismatch"], 1);
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
    for (const id of ["newegg", "microcenter", "ebay", "amazon", "walmart", "bestbuy", "other"]) assert.ok(stores.has(id), id);
    assert.ok(!stores.has("mercari"), "unverifiable Mercari pages are hidden");
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
  const google = { provider: "Store price search", marketplace: "amazon", seller: "Amazon.com", title: "Samsung 990 PRO 2TB PCIe 4.0 NVMe SSD", url: "https://www.amazon.com/Samsung-990-PRO/dp/B0BHJJ9Y77?tag=x", itemPrice: 169.99, totalPrice: 169.99, shipping: 0, shippingKnown: false, defaultCondition: "new" };
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
    assert.match(ebay.message, /out of credits \(HTTP 429\)/);
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
    const serper = body.providers.find(p => p.name === "Store price search");
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

test("unknown web shops, too-good-to-be-true prices and listings without a real item link are dropped", () => {
  const base = { provider: "Store price search", shipping: 0, shippingKnown: false, defaultCondition: "new" };
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
  assert.equal(stats.get("Store price search").dropped["untrusted-store"], 2);
  assert.ok(!items.some(x => x.totalPrice === 70), "$70 when the median is ~$180 is dropped");
  assert.ok(!items.some(x => x.title.startsWith("XFX")), "no link -> not shown");
  assert.equal(stats.get("Store price search").dropped["no-direct-link"], 1);
  assert.ok(items.every(x => x.linkType === "listing" && !/google\.|\/sch\/|search/.test(x.url)));
});

test("deep scan reads AliExpress item pages; no Google-indexed eBay or Mercari pages", async () => {
  const stub = stubFetch({
    serper: ({ body, path }) => path === "/search" ? { organic: [
      { title: "Sapphire Pulse RX 7800 XT 16GB GDDR6 Used | eBay", link: "https://www.ebay.com/itm/334455667788", snippet: "Pre-Owned · $389.99 · Free shipping" },
      { title: "AMD Radeon RX 7800 XT 16GB Graphics Card - AliExpress", link: "https://www.aliexpress.us/item/3256807000000001.html", snippet: "US $402.15 · 4.6 stars" },
      { title: "XFX RX 7800 XT 16GB - Mercari", link: "https://www.mercari.com/us/item/m12345678901/", snippet: "$360 · Good condition" }
    ] } : { shopping: [] }
  });
  try {
    const result = await searchPartsSniper({ query: "RX 7800 XT", category: "GPU", condition: "any", marketplaces: ["ebay", "aliexpress", "mercari"], providerKeys: keys() });
    const organicCalls = stub.calls.filter(c => c.path === "/search");
    assert.ok(organicCalls.every(c => !/site:|\bOR\b/.test(c.body.q)), "no site:/OR operators (blocked on Serper's free plan)");
    assert.ok(organicCalls.some(c => c.body.q === "RX 7800 XT AliExpress"));
    assert.ok(!organicCalls.some(c => /ebay/i.test(c.body.q)), "no eBay web search");
    assert.deepEqual(result.ranked.map(x => x.marketplace), ["aliexpress"]);
    assert.equal(result.ranked[0].itemPrice, 402.15);
    assert.equal(result.ranked[0].totalPrice, 417.15, "unknown GPU shipping is estimated (~$15), not assumed free");
    assert.equal(result.ranked[0].shippingEstimated, true);
  } finally { stub.restore(); }
});

test("PSUs, cooling and monitors are new-only: no used queries, no used listings", async () => {
  const stub = stubFetch({
    serper: ({ body, path }) => path === "/search" ? { organic: [
      { title: "Corsair RM850x 850W 80+ Gold PSU | eBay", link: "https://www.ebay.com/itm/998877665544", snippet: "Pre-Owned · $70.00" }
    ] } : { shopping: [
      { title: "Corsair RM850x 850W 80 PLUS Gold Fully Modular Power Supply", source: "Newegg.com", price: "$129.99", link: "https://www.newegg.com/p/N82E16817139326" },
      { title: "Corsair RM850x 850W 80 PLUS Gold Power Supply - Used", source: "Amazon.com", price: "$95.00", link: "https://www.amazon.com/dp/B0AAAABBBB" }
    ] }
  });
  try {
    const result = await searchPartsSniper({ query: "850W 80+ Gold PSU", category: "Power Supply / PSU", condition: "any", marketplaces: ["newegg", "amazon", "ebay"], providerKeys: keys() });
    assert.ok(!stub.calls.some(c => c.id === "serper" && /^(used|refurbished) /.test(c.body.q)), "no used/refurbished shopping queries");
    assert.ok(result.ranked.length >= 1);
    assert.ok(result.ranked.every(x => x.condition === "new"));
  } finally { stub.restore(); }
});

test("retailer product pages (Amazon, Newegg, Best Buy...) come from one web search with real links", async () => {
  const stub = stubFetch({
    serper: ({ body, path }) => path === "/search" && / price$/.test(body.q) ? { organic: [
      { title: "Amazon.com: EVGA 650 GQ, 80+ Gold 650W, Semi Modular Power Supply", link: "https://www.amazon.com/EVGA-Supernova-Modular/dp/B07Q24YHJ5", snippet: "$69.99 · In stock" },
      { title: "Thermaltake Toughpower GF A3 650W Gold - Newegg.com", link: "https://www.newegg.com/thermaltake-650w/p/N82E16817153340", price: 74.99, snippet: "ATX 3.0" },
      { title: "Corsair RM650e 650W 80 PLUS Gold - Best Buy", link: "https://www.bestbuy.com/site/corsair-rm650e/6560512.p", snippet: "Price $89.99" },
      { title: "650W Power Supplies - Best Buy", link: "https://www.bestbuy.com/site/searchpage.jsp?st=650w", snippet: "$59.99" }
    ] } : path === "/search" ? { organic: [] } : { shopping: [] }
  });
  try {
    const result = await searchPartsSniper({ query: "650W PSU", category: "Power Supply / PSU", condition: "any", marketplaces: ["amazon", "newegg", "bestbuy"], providerKeys: keys() });
    const prices = Object.fromEntries(result.ranked.map(x => [x.marketplace, x.totalPrice]));
    assert.deepEqual(prices, { amazon: 69.99, newegg: 74.99, bestbuy: 89.99 });
    assert.ok(result.ranked.every(x => x.condition === "new" && x.linkType === "listing"));
    assert.ok(!result.ranked.some(x => /searchpage/.test(x.url)));
  } finally { stub.restore(); }
});

test("Best value blends market value with launch MSRP; Google Shopping offer pages are kept and labeled", () => {
  const rows = [
    { id: "a", title: "RTX 5070", totalPrice: 560, itemPrice: 560, shippingKnown: true, condition: "new", relevance: 1, url: "https://www.amazon.com/dp/B0A" },
    { id: "b", title: "RTX 5070", totalPrice: 600, itemPrice: 600, shippingKnown: true, condition: "new", relevance: 1, url: "https://www.newegg.com/p/N1" },
    { id: "c", title: "RTX 5070", totalPrice: 640, itemPrice: 640, shippingKnown: true, condition: "new", relevance: 1, url: "https://www.walmart.com/ip/1" },
    { id: "d", title: "RTX 5070", totalPrice: 680, itemPrice: 680, shippingKnown: true, condition: "new", relevance: 1, url: "https://www.bestbuy.com/site/x/1.p" }
  ];
  const market = buildMarket(rows);
  const plain = rankDeals(rows, market, { query: "RTX 5070" });
  const withMsrp = rankDeals(rows, market, { query: "RTX 5070", msrp: 549 });
  const score = (list, id) => list.find(x => x.id === id).score;
  assert.ok(score(withMsrp, "d") <= score(plain, "d"), "listings far over MSRP lose value");
  const { items } = qualifyOffers([{ provider: "Store price search", marketplace: "bestbuy", seller: "Best Buy", title: "NVIDIA GeForce RTX 5070 12GB", itemPrice: 549, totalPrice: 549, shipping: 0, shippingKnown: false, defaultCondition: "new", url: "https://www.google.com/shopping/product/123456789?prds=oid:1" }], { query: "RTX 5070", category: "GPU", condition: "any" });
  assert.equal(items.length, 1);
  assert.equal(items[0].linkType, "google");
});

test("Google Shopping offers are shown only when resolved to the store's real item page", async () => {
  const g = id => "https://www.google.com/shopping/product/" + id + "?prds=oid:" + id;
  const stub = stubFetch({
    serper: ({ body, path }) => {
      if (path === "/shopping") return { shopping: body.q.startsWith("used ") || body.q.startsWith("refurbished ") ? [] : [
        { title: "Palit GeForce RTX 5090 GameRock 32GB", source: "eBay", price: "$2,890.00", link: g(1) },
        { title: "Gigabyte GeForce RTX 5090 Gaming OC 32G", source: "Best Buy", price: "$2,999.99", link: g(2) },
        { title: "ASUS TUF Gaming GeForce RTX 5090 32GB", source: "Newegg.com", price: "$3,099.99", link: g(3) }
      ] };
      if (/GameRock/.test(body.q)) return { organic: [
        { title: "rtx 5090 for sale | eBay", link: "https://www.ebay.com/sch/i.html?_nkw=rtx+5090" },
        { title: "Palit GeForce RTX 5090 GameRock 32GB GDDR7 Graphics Card | eBay", link: "https://www.ebay.com/itm/226611223344" }
      ] };
      if (/Gaming OC 32G/.test(body.q)) return { organic: [
        { title: "Gigabyte GeForce RTX 5090 Gaming OC 32G Graphics Card - Best Buy", link: "https://www.bestbuy.com/site/gigabyte-rtx-5090-gaming-oc/6615929.p?skuId=6615929" }
      ] };
      return { organic: [{ title: "RTX 5090 graphics cards - Newegg.com", link: "https://www.newegg.com/p/pl?d=rtx+5090" }] };
    }
  });
  try {
    const result = await searchPartsSniper({ query: "RTX 5090", category: "GPU", condition: "any", marketplaces: ["ebay", "bestbuy", "newegg"], providerKeys: keys() });
    const urls = result.ranked.map(x => x.url).sort();
    // eBay offers seen only through Google are not shown (can't be confirmed live).
    assert.deepEqual(urls, ["https://www.bestbuy.com/site/gigabyte-rtx-5090-gaming-oc/6615929.p?skuId=6615929"]);
    assert.ok(!stub.calls.some(c => /GameRock/.test(c.body?.q || "")), "no credit spent matching an eBay offer");
    assert.ok(result.ranked.every(x => x.linkType === "listing"));
    assert.ok(!result.ranked.some(x => /google\.|\/sch\/|\/pl\?/.test(x.url)), "no Google or search pages");
  } finally { stub.restore(); }
});

test("'Ultra 7 265KF ... RTX 5090' prebuilt is not shown as a GPU", () => {
  const r = evaluateListing({ title: "ArsenalPC - Ultra 7 265KF - RTX 5090 - 2TB NVMe SSD - 64GB DDR5 Memory", query: "RTX 5090", category: "GPU" });
  assert.equal(r.ok, false);
  assert.ok(["complete-system", "laptop-or-system"].includes(r.reason), r.reason);
});

test("GPU: laptops, whole PCs and bare PCBs are not shown as graphics cards", () => {
  const no = t => evaluateListing({ title: t, query: t.includes("5070") ? "RTX 5070 Ti" : "RTX 5090", category: "GPU" });
  for (const t of [
    "Razer Blade 16 240Hz QHD+ 2025 Ryzen AI 9 HX 370 64GB RAM 4TB SSD RTX 5090",
    "ASUS ROG Strix SCAR 16 Ultra 9 HX 32GB RAM RTX 5090",
    "Nvidia RTX 5090 MSI Raider 18 HX AI A2XWJG-416US 18\" QHD+ 240hz, 64gb Ddr5 2tb",
    "ASUS ROG EDITION 20 RTX 5090 Gaming PC | 9950X3D2 | 96GB RAM CL28 | 6TB SSD",
    "MSI GeForce RTX 5070 Ti 16GB PCB only - no cooler",
    "Gigabyte RTX 5070 Ti Gaming OC 16G graphics card PCB",
    "2pcs Cooling Fan Video Graphics Card for MSI RX5500XT 8GB MECH OC Graphics Card RTX 5090",
    "For ASUS TUF RX6700XT/6800XT/6900XT/6950XT GAMING Series Graphics Card Heatsink RTX 5090",
    "NVIDIA RTX NVLink Bridge 4-Slot for 3090 / 30 Series P3657 GPU SLI RTX 5090",
    "Gigabyte AORUS RTX 5090 Gaming Box Water-Cooled External Graphics Card eGPU"
  ]) assert.equal(no(t).ok, false, t);
  for (const t of [
    "NVIDIA RTX 5090 32GB 575W pulled from NEW DELL Alienware Area-51 0 Hours",
    "ASUS TUF GeForce RTX 5090 32GB GDDR7 Gaming OC Edition",
    "MSI GeForce RTX 5070 Ti 16G Gaming Trio OC Graphics Card"
  ]) assert.equal(no(t).ok, true, t);
});

test("Serper per-second rate limit (429) is retried, not treated as out of credits", async () => {
  let n = 0;
  const stub = stubFetch({
    serper: ({ path }) => {
      if (path === "/shopping" && n++ === 0) return { status: 429, body: { message: "Rate limit exceeded. You are allowed to submit up to 5 requests per second to this API." } };
      return path === "/shopping" ? { shopping: [{ title: "Corsair RM650e 650W 80 PLUS Gold Power Supply", source: "Newegg.com", price: "$79.99", link: "https://www.newegg.com/p/N82E16817139313" }] } : { organic: [] };
    }
  });
  try {
    const result = await searchPartsSniper({ query: "650W PSU", category: "Power Supply / PSU", condition: "new", marketplaces: ["newegg"], providerKeys: keys() });
    assert.equal(result.ranked.length, 1);
    assert.ok(!result.providers.some(p => p.status !== "ok"));
  } finally { stub.restore(); }
});

test("eBay live check: sold, removed, for-parts and auction-only pages are hidden; live price wins", async () => {
  const { parseEbayItemPage } = await import("../api/_lib/verify.js");
  const live = (price, extra = "") => `<h1 class="x-item-title__mainTitle"><span class="ux-textspans ux-textspans--BOLD">EVGA GTX 1660 Super 6GB</span></h1><div class="x-price-primary" data-testid="x-price-primary"><span class="ux-textspans">${price}</span></div>${extra}<a>Buy It Now</a>`;
  assert.equal(parseEbayItemPage("<h1>We looked everywhere!</h1>", 404).reason, "listing-removed");
  assert.equal(parseEbayItemPage("<h1>We looked everywhere!</h1> Looks like this page is missing.", 200).reason, "listing-removed");
  assert.equal(parseEbayItemPage(live("US $99.00", "<div>This listing sold on Mon, Oct 6 at 9:12 PM.</div>")).reason, "sold-or-ended");
  assert.equal(parseEbayItemPage(live("US $99.00", "<div>This listing was ended by the seller because the item is no longer available.</div>")).reason, "sold-or-ended");
  assert.equal(parseEbayItemPage(live("US $40.00", '<div class="x-item-condition-text"><div><span class="ux-textspans">For parts or not working</span></div></div>')).reason, "for-parts");
  assert.equal(parseEbayItemPage('<div class="x-price-primary"><span class="ux-textspans">US $50.00</span></div><button>Place bid</button>').reason, "auction-only");
  const ok = parseEbayItemPage(live("US $1,129.99"));
  assert.equal(ok.live, true);
  assert.equal(ok.price, 1129.99);
  assert.equal(ok.title, "EVGA GTX 1660 Super 6GB");
  assert.deepEqual(parseEbayItemPage(live("US $20.00 to US $45.00")).range, [20, 45]);
  assert.equal(parseEbayItemPage("<html>Pardon Our Interruption... captcha</html>").live, null);
});

test("pages read saved snapshots: no paid search, pending models never trigger one", async () => {
  const { default: overview } = await import("../api/parts/overview.js");
  const { default: deals } = await import("../api/deals/search.js");
  (await import("../api/_lib/snapshots.js")).clearSnapshotCache();
  const original = globalThis.fetch;
  const fetched = [];
  const listing = (p, cond) => ({ id: "s|" + p, title: "MSI GeForce GTX 1660 Super 6GB", source: "Newegg", marketplace: "newegg", condition: cond, totalPrice: p, itemPrice: p, shipping: 0, shippingKnown: true, url: "https://www.newegg.com/p/N82E1" + p, linkType: "listing", provider: "Store price search", score: 50 });
  globalThis.fetch = async url => {
    fetched.push(String(url));
    if (/models\/gtx-1660-super\.json$/.test(url)) return { ok: true, json: async () => ({ model: "GTX 1660 Super", searchedAt: new Date().toISOString(), market: { median: 150 }, results: [listing(140, "used"), listing(199, "new")], providers: [] }) };
    if (/raw\.githubusercontent\.com/.test(url)) return { ok: false, status: 404, json: async () => ({}) };
    throw new Error("paid search attempted: " + url);
  };
  const prev = process.env.SNAPSHOTS_OFF;
  delete process.env.SNAPSHOTS_OFF;
  try {
    let body;
    const res = { setHeader() {}, status() { return this; }, json(x) { body = x; return x; } };
    await overview({ method: "GET", query: { group: "gpu", series: "gtx16" } }, res);
    const card = body.items.find(x => x.id === "GTX 1660 Super");
    assert.equal(card.available, true);
    assert.equal(card.usedFrom, 140);
    assert.equal(card.newFrom, 199);
    assert.ok(body.items.find(x => x.id === "GTX 1630").pending, "unsaved model is pending, not searched");
    await deals({ method: "GET", query: { q: "GTX 1660 Super", category: "GPU", condition: "new", model: "GTX 1660 Super" } }, res);
    assert.equal(body.snapshot, true);
    assert.deepEqual(body.results.map(x => x.totalPrice), [199]);
    assert.ok(fetched.every(u => /raw\.githubusercontent\.com/.test(u)), "only saved files were read");
  } finally {
    globalThis.fetch = original;
    if (prev !== undefined) process.env.SNAPSHOTS_OFF = prev;
  }
});

test("Flipper Deals sections are computed from saved listings", async () => {
  const { flipperSection, ddr4StickInfo } = await import("../api/_lib/flipper.js");
  assert.deepEqual(ddr4StickInfo("G.Skill Ripjaws V 16GB (2x8GB) DDR4 3600 CL16"), { sticks: 2, speed: "3600" });
  assert.deepEqual(ddr4StickInfo("Lot of 4 Corsair Vengeance 8GB DDR4 3200MHz Desktop RAM"), { sticks: 4, speed: "3200" });
  assert.equal(ddr4StickInfo("Kingston 8GB DDR4 2666 Desktop"), null, "slower than 3000MHz");
  assert.equal(ddr4StickInfo("Crucial 32GB (2x16GB) DDR4 3200"), null, "not 8GB sticks");
  const L = (title, p, extra = {}) => ({ id: title, title, totalPrice: p, itemPrice: p, condition: "new", url: "https://www.newegg.com/p/" + encodeURIComponent(title), source: "Newegg", marketplace: "newegg", ...extra });
  const many = (title, prices, extra) => prices.map((p, k) => L(title + " #" + k, p, extra));
  const files = {
    // DDR4 market ≈ $70 per pair: $40/pair lots are deals, $68 is not, ECC is skipped.
    "models/8gb-ddr4-3200.json": [L("Lot of 4 Corsair 8GB DDR4 3200MHz Desktop RAM", 80, { condition: "used" }), L("HyperX 8GB DDR4 2666", 12), L("SK hynix 8GB DDR4 3200 ECC UDIMM", 20, { condition: "used" })],
    "models/16gb-ddr4-3200.json": [L("G.Skill 16GB (2x8GB) DDR4 3200", 39.99), ...many("Corsair 16GB (2x8GB) DDR4 3200 RGB", [68, 70, 72, 75], { condition: "used" })],
    // PSU market per wattage; only >=10% under it.
    "models/650w-psu.json": [L("EVGA 650 BR 650W 80+ Bronze Power Supply", 49.99), ...many("Corsair CX650 650W 80+ Bronze", [70, 72, 75], { condition: "used" })],
    "models/750w-80-gold-psu.json": [L("Corsair RM750e 750W 80+ Gold", 79.99), ...many("MSI A750GL 750W 80+ Gold", [99, 100, 105], { condition: "used" })],
    // Cases: RGB, Micro-ATX or bigger, <= $52; no open-air, no Mini-ITX.
    "models/rgb-gaming-pc-case.json": [L("Montech AIR 100 ARGB Micro ATX Mid Tower Case", 49.99), L("Lian Li Lancool 216 RGB ATX Case", 99.99), L("Open Air RGB ATX Test Bench", 25), L("Cooler Master NR200 Mini ITX RGB case", 45), L("Zalman T6 ATX Mid Tower Case", 35)],
    "models/ryzen-5-3600.json": [L("AMD Ryzen 5 3600 Processor", 55, { condition: "used" }), ...many("AMD Ryzen 5 3600", [70, 72, 75], { condition: "used" })],
    "models/ryzen-7-5800x3d.json": [L("AMD Ryzen 7 5800X3D", 199, { condition: "used" }), ...many("AMD Ryzen 7 5800X3D", [250, 260, 270], { condition: "used" })],
    // GPUs: appeal first, price must still be justified.
    "models/rtx-5060.json": [L("ZOTAC RTX 5060 8GB", 290, { condition: "used" }), ...many("RTX 5060 8GB", [340, 350, 360], { condition: "used" })],
    "models/rtx-3070.json": [L("EVGA RTX 3070 8GB", 220, { condition: "used" }), ...many("RTX 3070 8GB", [255, 260, 270], { condition: "used" })],
    "models/rtx-5090.json": [L("ASUS RTX 5090 32GB", 3900, { condition: "used" }), ...many("RTX 5090 32GB", [4500, 4600, 4700], { condition: "used" })]
  };
  const read = async path => files[path] ? { searchedAt: new Date().toISOString(), results: files[path] } : null;
  const ram = await flipperSection("ddr4", read);
  assert.deepEqual(ram.listings.map(x => [x.perPair, x.sticks]), [[39.99, 2], [40, 4]], "per-pair price, < $65, >=10% under market, no ECC");
  assert.ok(ram.listings[0].underPct >= 10 && ram.listings[0].market > 60);
  const psu = await flipperSection("psu", read);
  assert.deepEqual(psu.listings.map(x => x.tag), ["650W Bronze", "750W Gold"], "only under-market units; 650 before 750");
  const cs = await flipperSection("cases", read);
  assert.deepEqual(cs.listings.map(x => x.totalPrice), [49.99], "RGB, Micro-ATX+, <= $52, no open-air / Mini-ITX / non-RGB");
  const cpu = await flipperSection("ryzen", read);
  assert.deepEqual(cpu.listings.map(x => x.model), ["Ryzen 5 3600"], "never more than $65");
  const gpu = await flipperSection("gpu", read);
  assert.equal(gpu.listings[0].model, "RTX 5060", "newer high-appeal card beats a cheaper older one");
  assert.ok(gpu.listings.findIndex(x => x.model === "RTX 5090") > gpu.listings.findIndex(x => x.model === "RTX 3070"), "price must justify itself");
});

test("Deal Hunt answers catalog targets from saved listings without a paid search", async () => {
  const { default: sniper } = await import("../api/parts/sniper.js");
  (await import("../api/_lib/snapshots.js")).clearSnapshotCache();
  const original = globalThis.fetch;
  const L = (p, cond, mp = "newegg") => ({ id: mp + p, title: "MSI GeForce GTX 1660 Super Ventus XS 6GB", source: mp, marketplace: mp, condition: cond, totalPrice: p, itemPrice: p, shipping: 0, shippingKnown: true, url: "https://www." + mp + ".com/p/" + p, linkType: "listing", relevance: 1 });
  const fetched = [];
  globalThis.fetch = async url => {
    fetched.push(String(url));
    if (/models\/gtx-1660-super\.json$/.test(url)) return { ok: true, json: async () => ({ searchedAt: new Date().toISOString(), results: [L(150, "used"), L(199, "new"), L(120, "used", "aliexpress")] }) };
    throw new Error("paid search attempted: " + url);
  };
  const prev = process.env.SNAPSHOTS_OFF;
  delete process.env.SNAPSHOTS_OFF;
  try {
    let body;
    await sniper({ method: "POST", body: { targets: [{ query: "gtx 1660 super", category: "GPU", condition: "used" }], marketplaces: ["newegg", "ebay"], providerKeys: keys() } },
      { status() { return this; }, json(x) { body = x; return x; } });
    const r = body.results[0];
    assert.equal(r.available, true);
    assert.deepEqual(r.results.map(x => x.totalPrice), [150], "used only, selected stores only");
    assert.match(r.providers[0].name, /Saved listings/);
    assert.ok(fetched.every(u => /raw\.githubusercontent\.com/.test(u)));
  } finally {
    globalThis.fetch = original;
    if (prev !== undefined) process.env.SNAPSHOTS_OFF = prev;
  }
});

test("shipping: unknown is estimated by part type; big retailers ship free over $35", async () => {
  const { shippingFields } = await import("../api/_lib/market.js");
  assert.deepEqual(shippingFields({ itemPrice: 32, shippingKnown: false }, "ebay", "GPU"), { shipping: 15, shippingKnown: false, shippingEstimated: true, totalPrice: 47 });
  assert.equal(shippingFields({ itemPrice: 32, shipping: 15, shippingKnown: true }, "ebay", "GPU").totalPrice, 47);
  assert.equal(shippingFields({ itemPrice: 189.99, shippingKnown: false }, "newegg", "GPU").totalPrice, 189.99);
  assert.equal(shippingFields({ itemPrice: 20, shippingKnown: false }, "newegg", "RAM / Memory").totalPrice, 26);
  assert.equal(shippingFields({ itemPrice: 40, shippingKnown: false }, "ebay", "PC Case").totalPrice, 65);
});

test("eBay Browse API: auctions are skipped, Buy It Now kept, links cleaned", async () => {
  const { searchEbay } = await import("../api/_lib/market.js");
  const env = { ...process.env };
  process.env.EBAY_CLIENT_ID = "id"; process.env.EBAY_CLIENT_SECRET = "secret";
  const original = globalThis.fetch;
  const headers = [], urls = [];
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes("/oauth2/token")) return { ok: true, status: 200, json: async () => ({ access_token: "t", expires_in: 7200 }) };
    headers.push(opts.headers); urls.push(String(url));
    return { ok: true, status: 200, json: async () => ({ itemSummaries: [
      { itemId: "v1|1|0", title: "EVGA GTX 1660 Super", price: { value: "99" }, buyingOptions: ["FIXED_PRICE"], itemWebUrl: "https://www.ebay.com/itm/111111111111?_skw=x&hash=y", image: { imageUrl: "https://i.ebayimg.com/images/g/abc/s-l225.jpg" } },
      { itemId: "v1|2|0", title: "MSI GTX 1660 Super", price: { value: "60" }, buyingOptions: ["AUCTION", "FIXED_PRICE"], itemWebUrl: "https://www.ebay.com/itm/222222222222" },
      { itemId: "v1|3|0", title: "ASUS GTX 1660 Super", price: { value: "51", currency: "USD" }, buyingOptions: ["FIXED_PRICE"], itemLocation: { country: "CA" }, itemWebUrl: "https://www.ebay.com/itm/333333333333" }
    ] }) };
  };
  try {
    const offers = await searchEbay({ query: "GTX 1660 Super", condition: "any" });
    assert.deepEqual(offers.map(o => o.url), ["https://www.ebay.com/itm/111111111111"]);
    assert.equal(offers[0].image, "https://i.ebayimg.com/images/g/abc/s-l225.jpg", "the listing's own photo");
    assert.match(headers[0]["X-EBAY-C-ENDUSERCTX"], /zip%3D32832/);
    assert.ok(urls[0].includes("itemLocationCountry%3AUS"), "US sellers only");
  } finally { globalThis.fetch = original; process.env = env; }
});

test("saved eBay listings: sold-out/ended ones dropped, live price used", async () => {
  const { checkEbayAvailability } = await import("../api/_lib/market.js");
  const env = { ...process.env };
  process.env.EBAY_CLIENT_ID = "id2"; process.env.EBAY_CLIENT_SECRET = "secret2";
  const original = globalThis.fetch;
  globalThis.fetch = async url => {
    if (String(url).includes("/oauth2/token")) return { ok: true, status: 200, json: async () => ({ access_token: "t", expires_in: 7200 }) };
    return { ok: true, status: 200, json: async () => ({ items: [
      { itemId: "v1|111111111111|0", price: { value: "105.00" }, estimatedAvailabilities: [{ estimatedAvailabilityStatus: "IN_STOCK" }], shippingOptions: [{ shippingCost: { value: "12.50" } }] },
      { itemId: "v1|222222222222|0", price: { value: "90.00" }, estimatedAvailabilities: [{ estimatedAvailabilityStatus: "OUT_OF_STOCK" }] }
    ] }) };
  };
  const L = (id, p, extra = {}) => ({ id, marketplace: "ebay", url: "https://www.ebay.com/itm/" + id, itemPrice: p, shipping: 15, shippingKnown: false, shippingEstimated: true, totalPrice: p + 15, ...extra });
  try {
    const r = await checkEbayAvailability([L("111111111111", 99), L("222222222222", 80), L("333333333333", 70, { providerItemId: "v1|333333333333|0" }), { id: "nw", marketplace: "newegg", totalPrice: 120 }]);
    assert.deepEqual(r.items.map(x => x.id), ["111111111111", "nw"], "out of stock and vanished (ended) listings removed; other stores untouched");
    assert.equal(r.items[0].totalPrice, 117.5, "live price + live shipping");
    assert.equal(r.removed, 2);
  } finally { globalThis.fetch = original; process.env = env; }
});

test("PSU: desktop units only (no chargers, office/OEM, server or peak-rated junk)", () => {
  const ok = t => evaluateListing({ title: t, query: "650W PSU", category: "Power Supply / PSU" }).ok;
  for (const t of ["New--Power Star Yellow 650w-MAX 12cm-Fan ATX Power Supply 20+4pin", "442036-001 HP Workstation xw6600 650W PSU",
    "Charger for Rattan LM 650W Folding Fat Tire E-Bike", "New SHARK 650W ATX12V Replacement PC Power Supply", "Delta 650W 1U redundant server power supply"])
    assert.equal(ok(t), false, t);
  for (const t of ["Thermaltake Smart BM3 80+ Bronze ATX 3.0 650W Semi-Modular", "Gigabyte P650 Power Supply, 80 Plus Bronze, 650w Max.",
    "650W ATX Power Supply 80 Plus Gold Non-Modular", "SEGOTEP GN650W PSU"])
    assert.equal(ok(t), true, t);
  const ok750 = t => evaluateListing({ title: t, query: "750W PSU", category: "Power Supply / PSU" }).ok;
  assert.equal(ok750("Thermaltake Smart 750W ATX Power Supply"), false, "750W needs an 80 Plus rating");
  assert.equal(ok750("Rosewill 750W 80+ White ATX Power Supply"), true);
  assert.equal(ok750("Corsair CX750 750W 80 Plus Bronze"), true);
});

test("cases: size / lighting / color read from titles; models only keep matching cases", async () => {
  const { caseAttributes } = await import("../shared/caseAttrs.js");
  assert.deepEqual(caseAttributes("Montech AIR 903 Base White ATX Mid Tower Case ARGB"), { Size: "ATX", Lighting: "ARGB", Color: "White" });
  assert.deepEqual(caseAttributes("Thermaltake Versa H18 Black Micro ATX Case"), { Size: "Micro ATX", Lighting: "No RGB", Color: "Black" });
  assert.deepEqual(caseAttributes("Cooler Master NR200 Mini ITX RGB case"), { Size: "Mini ITX", Lighting: "RGB", Color: "Other" });
  const ok = (t, q) => evaluateListing({ title: t, query: q, category: "PC Case" }).ok;
  assert.equal(ok("Corsair 4000D Airflow Black ATX Mid Tower", "White PC case"), false);
  assert.equal(ok("Montech AIR 903 Base White ATX Mid Tower Case ARGB", "White PC case"), true);
  assert.equal(ok("Thermaltake Versa H18 Black Micro ATX Case", "ATX mid tower PC case"), false);
  assert.equal(ok("Zalman T6 ATX Mid Tower Case", "ARGB PC case"), false);
});
