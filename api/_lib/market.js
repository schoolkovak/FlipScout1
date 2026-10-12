import { createHash } from "node:crypto";
import { evaluateListing, normalizeListingText } from "./matching.js";
import { SNIPER_MARKETPLACES, allowsUsed } from "../../shared/sniper.js";
import { sortDeals } from "../../shared/dealSort.js";
import { isTrustedMerchant, listingLink } from "./stores.js";

export { relevanceScore } from "./matching.js";

const EBAY_SCOPE = "https://api.ebay.com/oauth/api_scope";
const CACHE_MS = 10 * 60 * 1000;
const PROVIDER_TIMEOUT_MS = 10000;
const ALL_MARKETPLACES = SNIPER_MARKETPLACES.map(x => x.id);

// ---------------------------------------------------------------------------
// Credentials: environment variables (Vercel / local .env) or keys the owner
// typed into the browser settings panel. Never embedded in source.
// ---------------------------------------------------------------------------
function env(name) {
  return process.env[name] || "";
}

function providerKey(name, input = {}) {
  return input?.providerKeys?.[name] || env(name);
}

function availableProviders(input = {}) {
  return {
    serper: Boolean(providerKey("SERPER_API_KEY", input)),
    searchapi: Boolean(providerKey("SEARCHAPI_API_KEY", input)),
    serpapi: Boolean(env("SERPAPI_API_KEY")),
    bestbuyApi: Boolean(env("BESTBUY_API_KEY")),
    ebayApi: Boolean(env("EBAY_CLIENT_ID") && env("EBAY_CLIENT_SECRET"))
  };
}

export function providerStatus(providerKeys = {}) {
  const has = availableProviders({ providerKeys });
  return [
    {
      id: "serper",
      name: "Serper",
      status: has.serper ? "Connected" : "Missing credentials",
      coverage: "Store price search: Amazon, Best Buy, Walmart, Newegg, eBay, AliExpress, Mercari, B&H, Adorama, Micro Center and other trusted stores",
      signupUrl: "https://serper.dev/",
      freeAllowance: "2,500 free queries (each 100-result shopping search uses 2)"
    },
    {
      id: "searchapi",
      name: "SearchAPI",
      status: has.searchapi ? "Connected" : "Missing credentials",
      coverage: "Direct eBay, Amazon, Walmart and Best Buy search results",
      signupUrl: "https://www.searchapi.io/",
      freeAllowance: "Small free allowance; each direct store search uses 1 request"
    },
    {
      id: "serpapi",
      name: "SerpApi (eBay)",
      status: has.serpapi ? "Connected" : "Missing credentials",
      coverage: "Structured eBay search (condition-filtered, never for-parts)",
      signupUrl: "https://serpapi.com/",
      freeAllowance: "250 searches/month free"
    },
    {
      id: "bestbuy",
      name: "Best Buy",
      status: has.bestbuyApi ? "Connected" : "Missing credentials",
      coverage: "Official Best Buy new and Open Box offers",
      signupUrl: "https://developer.bestbuy.com/",
      freeAllowance: "50,000 calls/day if approved"
    },
    {
      id: "ebay",
      name: "eBay",
      status: has.ebayApi ? "Connected" : "Missing credentials / production approval",
      coverage: "Official eBay Browse API: live new and used fixed-price listings",
      signupUrl: "https://developer.ebay.com/",
      freeAllowance: "Developer registration is free; production Buy API approval required"
    }
  ];
}

// ---------------------------------------------------------------------------
// Provider HTTP: timeouts, per-host concurrency, readable errors, and a short
// circuit breaker so an exhausted/invalid key is not hammered.
// ---------------------------------------------------------------------------
export class ProviderError extends Error {
  constructor(message, { status = null, quota = false, skipped = false } = {}) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.quota = quota;
    this.skipped = skipped;
  }
}

const hostSlots = new Map();
async function withHostLimit(host, max, fn) {
  let slot = hostSlots.get(host);
  if (!slot) hostSlots.set(host, slot = { active: 0, queue: [] });
  // A finishing request hands its slot straight to the next waiter.
  if (slot.active >= max) await new Promise(resolve => slot.queue.push(resolve));
  else slot.active++;
  try { return await fn(); }
  finally {
    const next = slot.queue.shift();
    if (next) next();
    else slot.active--;
  }
}

const providerCircuit = new Map();

function redact(text, secrets = []) {
  let out = String(text || "").replace(/api_key=[^&\s"]+/gi, "api_key=[redacted]").replace(/https?:\/\/\S+/g, "[provider]");
  for (const secret of secrets) if (secret && secret.length > 6) out = out.split(secret).join("[redacted]");
  return out.replace(/\s+/g, " ").trim().slice(0, 200);
}

function providerMessage(text) {
  try {
    const data = JSON.parse(text);
    return String(data.error || data.message || data.detail || data.errors?.[0]?.message || "");
  } catch { return String(text || "").slice(0, 200); }
}

// Serper's free plan allows 5 requests/second: space request starts per host
// so a page of searches never trips the limit.
const HOST_MIN_INTERVAL_MS = { "google.serper.dev": 230 };
const hostNextStart = new Map();
async function paceHost(host) {
  const gap = HOST_MIN_INTERVAL_MS[host];
  if (!gap) return;
  const now = Date.now();
  const at = Math.max(now, hostNextStart.get(host) || 0);
  hostNextStart.set(host, at + gap);
  if (at > now) await new Promise(r => setTimeout(r, at - now));
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function providerFetch(provider, url, options = {}, secrets = []) {
  // One circuit per provider credential: a browser-entered key and the
  // server key fail independently.
  const circuitId = provider + ":" + createHash("sha256").update(String(secrets[0] || "")).digest("hex").slice(0, 12);
  const open = providerCircuit.get(circuitId);
  if (open && open.until > Date.now()) throw new ProviderError(open.message, { quota: true, skipped: true });
  const host = new URL(url).hostname;
  return withHostLimit(host, 5, async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      await paceHost(host);
      let response;
      try {
        response = await fetch(url, { ...options, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
      } catch (error) {
        if (error?.name === "TimeoutError" || error?.name === "AbortError") throw new ProviderError("timed out after " + PROVIDER_TIMEOUT_MS / 1000 + "s");
        throw new ProviderError("network error: " + redact(error?.cause?.code || error?.cause?.message || error?.message || error, secrets));
      }
      if (response.status >= 500 && attempt === 0) { await response.body?.cancel?.(); continue; }
      if (!response.ok) {
        const text = await response.text?.().catch(() => "") || "";
        const detail = redact(providerMessage(text), secrets);
        // Per-second rate limit: wait and retry, never pause the provider.
        if (response.status === 429 && /per second|rate limit/i.test(detail) && attempt < 3) { await sleep(700 * (attempt + 1)); continue; }
        const keyProblem = response.status === 401 || response.status === 403;
        // Only real credit/key problems pause a provider.
        const quota = keyProblem || response.status === 402 || /not enough credits|out of (?:credits|searches)|credits? (?:exhausted|depleted)|quota exceeded|insufficient (?:credits|balance)/i.test(detail);
        const message = (keyProblem ? "API key rejected" : quota ? "out of credits" : response.status === 429 ? "rate-limited" : "request failed") + " (HTTP " + response.status + ")" + (detail ? ": " + detail : "");
        if (quota) providerCircuit.set(circuitId, { until: Date.now() + 10 * 60 * 1000, message });
        throw new ProviderError(message, { status: response.status, quota });
      }
      return response.json();
    }
    throw new ProviderError("rate-limited (HTTP 429) after retries");
  });
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------
function parseMoney(text) {
  if (typeof text === "number") return Number.isFinite(text) ? text : null;
  if (!text) return null;
  const m = String(text).replace(/,/g, "").match(/\$?\s*([0-9]+(?:\.[0-9]+)?)/);
  return m ? Number(m[1]) : null;
}

function parseShippingText(text) {
  const delivery = String(text || "");
  if (!delivery) return { shipping: 0, shippingKnown: false };
  if (/free/i.test(delivery)) return { shipping: 0, shippingKnown: true };
  const value = /\$\s*\d/.test(delivery) ? parseMoney(delivery) : null;
  return { shipping: value || 0, shippingKnown: value !== null };
}

function safeUrl(value) {
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) ? u.href : null;
  } catch { return null; }
}

export function marketplaceIdFromResult(seller, url) {
  const s = String(seller || "").toLowerCase();
  let host = "";
  try { host = new URL(url || "").hostname.toLowerCase(); } catch {}
  if (/(^|\.)google\./.test(host)) host = "";
  const hay = s + " " + host;
  if (hay.includes("amazon")) return "amazon";
  if (hay.includes("bestbuy") || hay.includes("best buy")) return "bestbuy";
  if (hay.includes("walmart")) return "walmart";
  if (hay.includes("newegg")) return "newegg";
  if (hay.includes("ebay")) return "ebay";
  if (hay.includes("aliexpress") || hay.includes("ali express")) return "aliexpress";
  if (hay.includes("bhphotovideo") || hay.includes("b&h photo") || hay.includes("b h photo")) return "bhphoto";
  if (hay.includes("adorama")) return "adorama";
  if (hay.includes("microcenter") || hay.includes("micro center")) return "microcenter";
  if (hay.includes("mercari")) return "mercari";
  return null;
}

export function marketplaceName(id) {
  return SNIPER_MARKETPLACES.find(x => x.id === id)?.name || id || "Marketplace";
}

// What a retailer sells when the listing does not say otherwise.
const MARKETPLACE_DEFAULT_CONDITION = {
  amazon: "new", bestbuy: "new", walmart: "new", newegg: "new", aliexpress: "new",
  bhphoto: "new", adorama: "new", microcenter: "new", mercari: "used", ebay: "unknown"
};

// Shopping results are new stock by default, so only non-new conditions are
// added to the query text.
function conditionSearchTerm(condition) {
  return condition === "open-box" ? "open box" : condition === "any" || condition === "new" ? "" : condition;
}

// ---------------------------------------------------------------------------
// Provider adapters. Each returns raw offers; qualification happens later.
// ---------------------------------------------------------------------------
function offer(base) {
  const itemPrice = Number(base.itemPrice) || 0;
  const shipping = Number(base.shipping) || 0;
  return {
    structuredCondition: "",
    defaultCondition: "unknown",
    shippingKnown: false,
    ...base,
    itemPrice,
    shipping,
    totalPrice: itemPrice + shipping
  };
}

function googleShoppingOffer(x, provider, index) {
  const seller = x.source || x.seller || x.merchant?.name || "";
  const url = x.link || x.product_link || x.offers_link || null;
  const marketplace = marketplaceIdFromResult(seller, url);
  const ship = parseShippingText(x.delivery || x.shipping || x.delivery_return || "");
  return offer({
    provider,
    providerItemId: x.productId || x.product_id || null,
    marketplace,
    seller: seller || "Unknown merchant",
    title: x.title || "",
    url,
    itemPrice: parseMoney(x.extracted_price ?? x.price),
    shipping: ship.shipping,
    shippingKnown: ship.shippingKnown,
    structuredCondition: x.condition || x.second_hand_condition || x.secondHandCondition || "",
    defaultCondition: marketplace ? MARKETPLACE_DEFAULT_CONDITION[marketplace] : "new",
    rating: Number(x.rating || 0) || null,
    reviews: Number(x.ratingCount || x.reviews || 0) || null,
    image: x.imageUrl || x.thumbnail || x.image || null,
    position: x.position || index + 1
  });
}

export async function searchSerperShopping(input, { q, page = 1 } = {}) {
  const apiKey = providerKey("SERPER_API_KEY", input);
  if (!apiKey) return [];
  const query = q || [conditionSearchTerm(input.condition || "any"), input.query].filter(Boolean).join(" ");
  const body = { q: query, gl: "us", hl: "en", num: 100 };
  if (page > 1) body.page = page;
  const data = await providerFetch("serper", "https://google.serper.dev/shopping", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }, [apiKey]);
  return (data.shopping || []).map((x, i) => googleShoppingOffer(x, "Store price search", i));
}

// Item pages on eBay, AliExpress and Mercari through ONE Serper web search
// ("site:A OR site:B ..."): real listing links, with price and condition read
// from Google's result. This is where most used listings come from, and it
// covers marketplaces Google Shopping often leaves out.
// Retailer product pages (new stock): real, linkable listings for every model,
// including ones Google Shopping only shows behind its own product pages.
const RETAIL_PAGE_SITES = [
  { id: "amazon", site: "amazon.com/dp", re: /(^|\.)amazon\.com$/, path: /\/(dp|gp\/product)\// },
  { id: "newegg", site: "newegg.com/p", re: /(^|\.)newegg\.com$/, path: /^\/(p\/|.*\/p\/)/ },
  { id: "bestbuy", site: "bestbuy.com/site", re: /(^|\.)bestbuy\.com$/, path: /^\/site\/.+\.p$/ },
  { id: "walmart", site: "walmart.com/ip", re: /(^|\.)walmart\.com$/, path: /^\/ip\// },
  { id: "microcenter", site: "microcenter.com/product", re: /(^|\.)microcenter\.com$/, path: /^\/product\// },
  { id: "bhphoto", site: "bhphotovideo.com/c/product", re: /(^|\.)bhphotovideo\.com$/, path: /^\/c\/product\// }
];

const ITEM_PAGE_SITES = [
  { id: "ebay", site: "ebay.com/itm", re: /(^|\.)ebay\.com$/, path: /^\/itm\// },
  { id: "aliexpress", site: "aliexpress.us/item", re: /(^|\.)aliexpress\.(us|com)$/, path: /^\/item\// },
  { id: "aliexpress", site: "aliexpress.com/item", re: null },
  { id: "mercari", site: "mercari.com/us/item", re: /(^|\.)mercari\.com$/, path: /^\/us\/item\// }
];

function organicPrice(x) {
  const fields = [x.price, x.priceRange, x.attributes?.Price, x.attributes?.price];
  for (const f of fields) { const n = parseMoney(f); if (n > 0) return n; }
  const text = [x.snippet, ...(x.sitelinks || []).map(l => l.title)].join(" ");
  const m = String(text).match(/(?:^|[\s:(])(?:US\s?)?\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)/);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

export async function searchSerperItemPages(input, { marketplaces = ["ebay", "aliexpress", "mercari"], retail = false } = {}) {
  const apiKey = providerKey("SERPER_API_KEY", input);
  if (!apiKey) return [];
  const table = retail ? RETAIL_PAGE_SITES : ITEM_PAGE_SITES;
  const sites = table.filter(x => marketplaces.includes(x.id));
  if (!sites.length) return [];
  const term = retail ? "" : { new: "brand new", used: "used", "open-box": "open box", refurbished: "refurbished", renewed: "refurbished" }[input.condition] || "";
  // Serper's free plan rejects site:/OR operators ("Query pattern not allowed
  // for free accounts"), so use plain-text queries and keep only results that
  // are real item pages on the wanted sites.
  const ids = [...new Set(sites.map(x => x.id))];
  const hint = retail ? "price" : ids.length === 1 ? marketplaceName(ids[0]) : ids.includes("ebay") ? "ebay" : marketplaceName(ids[0]);
  const q = [input.query, term, hint].filter(Boolean).join(" ");
  const data = await providerFetch("serper", "https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q, gl: "us", hl: "en", num: 100 })
  }, [apiKey]);
  const out = [];
  for (const x of data.organic || []) {
    let u;
    try { u = new URL(x.link); } catch { continue; }
    const site = table.find(s => s.re && s.re.test(u.hostname) && s.path.test(u.pathname));
    if (!site) continue;
    const snippet = String(x.snippet || "");
    const cond = snippet.match(/\b(brand new|new \(other\)|new other|open box|pre-owned|preowned|used|certified - refurbished|refurbished|for parts or not working|for parts)\b/i)?.[0] || "";
    const ship = /free (?:shipping|delivery)/i.test(snippet) ? { shipping: 0, shippingKnown: true } : { shipping: 0, shippingKnown: false };
    out.push(offer({
      provider: retail ? "Retailer pages (Serper web search)" : "Item pages (Serper web search)", marketplace: site.id, seller: marketplaceName(site.id),
      title: String(x.title || "").replace(/^Amazon\.com\s*:\s*/i, "").replace(/\s*[|\-–:]\s*(eBay|AliExpress|Mercari|Amazon\.com.*|Newegg\.com|Best Buy|Walmart\.com|Micro Center|B&H Photo.*)\s*$/i, "").trim(),
      url: u.href, itemPrice: organicPrice(x) || 0, ...ship,
      structuredCondition: cond, defaultCondition: MARKETPLACE_DEFAULT_CONDITION[site.id] || "unknown"
    }));
  }
  return out;
}
export const searchSerperEbayItems = input => searchSerperItemPages(input, { marketplaces: ["ebay"] });

async function searchApiRequest(input, engine, params) {
  const apiKey = providerKey("SEARCHAPI_API_KEY", input);
  if (!apiKey) return null;
  const qs = new URLSearchParams({ engine, api_key: apiKey, ...params });
  return providerFetch("searchapi", "https://www.searchapi.io/api/v1/search?" + qs.toString(), {}, [apiKey]);
}

function searchApiEbayCondition(condition) {
  if (condition === "new") return "new";
  if (condition === "used") return "pre_owned_excellent,used_very_good,used_good,used_acceptable,pre_owned_fair,like_new";
  if (condition === "open-box") return "new_opened";
  if (condition === "renewed" || condition === "refurbished") return "certified_refurbished,excellent_refurbished,very_good_refurbished,good_refurbished,seller_refurbished";
  // "Any" = every sellable condition; for-parts listings are never requested.
  return "new,new_opened,like_new,pre_owned_excellent,used_very_good,used_good,used_acceptable,pre_owned_fair,certified_refurbished,excellent_refurbished,very_good_refurbished,good_refurbished,seller_refurbished";
}

export async function searchSearchApiEbay(input) {
  const { query, condition = "any", postalCode, localOnly = false, distanceRadius = 50 } = input;
  const params = { q: query, num: "240", sort_by: localOnly ? "distance_nearest" : "best_match", buying_format: "buy_it_now" };
  const cond = searchApiEbayCondition(condition);
  if (cond) params.condition = cond;
  if (postalCode) { params.postal_code = String(postalCode); params.distance_radius = String(distanceRadius || 50); }
  if (localOnly) params.filters = "local_pickup";
  const data = await searchApiRequest(input, "ebay_search", params);
  if (!data) return [];
  const raw = [...(data.organic_results || [])];
  for (const section of data.sections || []) if (section?.has_items && Array.isArray(section.results)) raw.push(...section.results);
  return raw.map(x => {
    const range = x.extracted_price === undefined && x.extracted_price_range?.from !== undefined;
    const freeShip = /free/i.test(x.shipping || "");
    const shippingKnown = freeShip || (x.extracted_shipping !== undefined && x.extracted_shipping !== null);
    return offer({
      provider: "eBay (SearchAPI)",
      providerItemId: x.item_id || null,
      marketplace: "ebay",
      seller: x.seller?.name || "eBay seller",
      title: x.title || "",
      url: x.link || null,
      itemPrice: Number(x.extracted_price ?? x.extracted_price_range?.from ?? 0),
      shipping: freeShip ? 0 : Number(x.extracted_shipping || 0),
      shippingKnown,
      structuredCondition: x.condition || "",
      defaultCondition: "unknown",
      priceIsRange: range,
      sellerFeedback: Number(x.seller?.positive_feedback_percent || 0) || null,
      soldCount: Number(x.extracted_items_sold || 0) || 0,
      watchers: Number(x.extracted_watching || 0) || 0
    });
  });
}

export async function searchSearchApiAmazon(input) {
  const condition = input.condition || "any";
  const suffix = condition === "renewed" || condition === "refurbished" ? " renewed" : "";
  const data = await searchApiRequest(input, "amazon_search", { q: input.query + suffix, amazon_domain: "amazon.com" });
  if (!data) return [];
  return (data.organic_results || []).map(x => {
    const ship = parseShippingText(x.delivery?.text || x.delivery || x.shipping || "");
    return offer({
      provider: "Amazon (SearchAPI)",
      providerItemId: x.asin || null,
      marketplace: "amazon",
      seller: "Amazon",
      title: x.title || "",
      url: x.link || (x.asin ? "https://www.amazon.com/dp/" + x.asin : null),
      itemPrice: Number(x.extracted_price || parseMoney(x.price) || 0),
      shipping: ship.shipping,
      shippingKnown: ship.shippingKnown,
      defaultCondition: "new",
      rating: Number(x.rating || 0) || null,
      reviews: Number(x.reviews || 0) || null
    });
  });
}

export async function searchSearchApiWalmart(input) {
  const condition = input.condition || "any";
  const suffix = condition === "renewed" || condition === "refurbished" ? " restored" : "";
  const data = await searchApiRequest(input, "walmart_search", { q: input.query + suffix, sort_by: "best_match" });
  if (!data) return [];
  return (data.organic_results || []).map(x => offer({
    provider: "Walmart (SearchAPI)",
    providerItemId: x.id || x.product_id || null,
    marketplace: "walmart",
    seller: x.seller_name || "Walmart",
    title: x.title || "",
    url: x.link || null,
    itemPrice: Number(x.extracted_price || parseMoney(x.price) || 0),
    shipping: 0,
    shippingKnown: Boolean(x.is_free_shipping),
    structuredCondition: x.condition || "",
    defaultCondition: "new",
    rating: Number(x.rating || 0) || null,
    reviews: Number(x.reviews || 0) || null
  }));
}

export async function searchSearchApiBestBuy(input) {
  const data = await searchApiRequest(input, "bestbuy_search", { q: input.query, sort_by: "best_match" });
  if (!data) return [];
  const out = [];
  for (const x of data.organic_results || []) {
    const title = x.title || x.short_title || "";
    out.push(offer({
      provider: "Best Buy (SearchAPI)", providerItemId: x.product_id || null, marketplace: "bestbuy", seller: x.seller?.name || "Best Buy",
      title, url: x.link || null, itemPrice: Number(x.extracted_price || 0), defaultCondition: "new"
    }));
    for (const ob of x.open_box_options || []) {
      out.push(offer({
        provider: "Best Buy (SearchAPI)", providerItemId: x.product_id || null, marketplace: "bestbuy", seller: "Best Buy",
        title: title + " - Open Box " + (ob.condition || ""), url: ob.link || x.link || null,
        itemPrice: Number(ob.extracted_price || 0), structuredCondition: "open box"
      }));
    }
  }
  return out;
}

export async function searchSearchApiGoogleShopping(input, { q } = {}) {
  const query = q || [conditionSearchTerm(input.condition || "any"), input.query].filter(Boolean).join(" ");
  const data = await searchApiRequest(input, "google_shopping", { q: query, gl: "us", hl: "en" });
  if (!data) return [];
  return [...(data.shopping_results || []), ...(data.inline_shopping_results || [])].map((x, i) => googleShoppingOffer(x, "Store price search (SearchAPI)", i));
}

function structuredGooglePrice(x) {
  for (const value of [x.extracted_price, x.rich_snippet?.top?.detected_extensions?.price, x.rich_snippet?.bottom?.detected_extensions?.price, x.detected_extensions?.price]) {
    const n = typeof value === "number" ? value : parseMoney(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

const SITE_DOMAINS = { newegg: "newegg.com", mercari: "mercari.com", aliexpress: "aliexpress.us", bhphoto: "bhphotovideo.com", adorama: "adorama.com", microcenter: "microcenter.com" };

export async function searchSearchApiSiteMarketplace(input, marketplace) {
  const domain = SITE_DOMAINS[marketplace];
  if (!domain) return [];
  const q = ["site:" + domain, conditionSearchTerm(input.condition || "any"), input.query].filter(Boolean).join(" ");
  const data = await searchApiRequest(input, "google", { q, gl: "us", hl: "en" });
  if (!data) return [];
  return (data.organic_results || []).map(x => offer({
    provider: marketplaceName(marketplace) + " (site search)",
    marketplace,
    seller: marketplaceName(marketplace),
    title: x.title || "",
    url: x.link || null,
    itemPrice: structuredGooglePrice(x) || 0,
    structuredCondition: x.snippet && /refurb|open box|used|pre-owned/i.test(x.snippet) ? x.snippet : "",
    defaultCondition: MARKETPLACE_DEFAULT_CONDITION[marketplace] || "unknown"
  }));
}

export async function searchSerpApi(input) {
  const apiKey = env("SERPAPI_API_KEY");
  if (!apiKey) return [];
  const q = [conditionSearchTerm(input.condition || "any"), input.query].filter(Boolean).join(" ");
  const params = new URLSearchParams({ engine: "google_shopping", q, api_key: apiKey, gl: "us", hl: "en" });
  const data = await providerFetch("serpapi", "https://serpapi.com/search.json?" + params.toString(), {}, [apiKey]);
  return (data.shopping_results || []).map((x, i) => googleShoppingOffer(x, "Store price search (SerpApi)", i));
}

// eBay condition ids: 1000 new, 1500 open box, 2000-2500 refurbished,
// 3000 used. 7000 (for parts / not working) is never requested.
const EBAY_CONDITION_IDS = {
  any: "1000|1500|2000|2010|2020|2030|2500|3000",
  new: "1000", "open-box": "1500", used: "3000",
  refurbished: "2000|2010|2020|2030|2500", renewed: "2000|2010|2020|2030|2500"
};

export async function searchSerpApiEbay(input) {
  const apiKey = env("SERPAPI_API_KEY");
  if (!apiKey) return [];
  const params = new URLSearchParams({
    engine: "ebay", ebay_domain: "ebay.com", _nkw: input.query, _ipg: "200", LH_BIN: "1",
    LH_ItemCondition: EBAY_CONDITION_IDS[input.condition || "any"] || EBAY_CONDITION_IDS.any, api_key: apiKey
  });
  const data = await providerFetch("serpapi", "https://serpapi.com/search.json?" + params.toString(), {}, [apiKey]);
  return (data.organic_results || []).map(x => {
    const price = x.price?.extracted ?? x.price?.from?.extracted ?? parseMoney(x.price?.raw ?? x.price);
    const ship = parseShippingText(typeof x.shipping === "string" ? x.shipping : x.shipping?.raw || "");
    return offer({
      provider: "eBay (SerpApi)", providerItemId: x.product_id || x.item_id || null, marketplace: "ebay",
      seller: x.seller?.username || x.seller?.name || "eBay seller", title: x.title || "", url: x.link || null,
      itemPrice: Number(price || 0), shipping: ship.shipping, shippingKnown: ship.shippingKnown,
      structuredCondition: x.condition || "", priceIsRange: x.price?.extracted === undefined && x.price?.from !== undefined,
      soldCount: parseMoney(x.sold) || 0
    });
  });
}

async function bestBuyOpenBoxForSkus(skus) {
  const apiKey = env("BESTBUY_API_KEY");
  if (!skus.length || !apiKey) return [];
  const url = "https://api.bestbuy.com/beta/products/openBox(sku%20in(" + skus.slice(0, 100).join(",") + "))?apiKey=" + encodeURIComponent(apiKey);
  const data = await providerFetch("bestbuy", url, {}, [apiKey]);
  const out = [];
  for (const product of data.results || []) {
    for (const o of product.offers || []) {
      out.push(offer({
        provider: "Best Buy API", providerItemId: product.sku, marketplace: "bestbuy", seller: "Best Buy",
        title: product.names?.title || "", url: product.links?.web || null,
        itemPrice: Number(o.prices?.current || 0), structuredCondition: "open box " + (o.condition || "")
      }));
    }
  }
  return out;
}

export async function searchBestBuy(input) {
  const apiKey = env("BESTBUY_API_KEY");
  if (!apiKey) return [];
  const terms = normalizeListingText(input.query).split(" ").filter(Boolean).slice(0, 6).map(t => "search=" + encodeURIComponent(t)).join("&");
  const url = "https://api.bestbuy.com/v1/products(" + terms + "&active=true)?format=json&show=sku,name,salePrice,url,onlineAvailability,freeShipping,shippingCost&sort=salePrice.asc&pageSize=100&apiKey=" + encodeURIComponent(apiKey);
  const data = await providerFetch("bestbuy", url, {}, [apiKey]);
  const products = data.products || [];
  const newItems = products.map(p => offer({
    provider: "Best Buy API", providerItemId: p.sku, marketplace: "bestbuy", seller: "Best Buy",
    title: p.name || "", url: p.url || null, itemPrice: Number(p.salePrice || 0),
    shipping: p.freeShipping ? 0 : Number(p.shippingCost || 0), shippingKnown: p.freeShipping === true || Number.isFinite(Number(p.shippingCost)),
    defaultCondition: "new"
  }));
  const condition = input.condition || "any";
  const openBox = condition === "any" || condition === "open-box" ? await bestBuyOpenBoxForSkus(products.map(p => p.sku).filter(Boolean)) : [];
  return [...newItems, ...openBox];
}

let ebayTokenCache = { token: null, expiresAt: 0 };

async function getEbayToken() {
  if (!env("EBAY_CLIENT_ID") || !env("EBAY_CLIENT_SECRET")) return null;
  if (ebayTokenCache.token && Date.now() < ebayTokenCache.expiresAt - 60000) return ebayTokenCache.token;
  const credentials = Buffer.from(env("EBAY_CLIENT_ID") + ":" + env("EBAY_CLIENT_SECRET")).toString("base64");
  const data = await providerFetch("ebay", "https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: { "Authorization": "Basic " + credentials, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: EBAY_SCOPE })
  }, [env("EBAY_CLIENT_SECRET")]);
  ebayTokenCache = { token: data.access_token, expiresAt: Date.now() + Number(data.expires_in || 7200) * 1000 };
  return ebayTokenCache.token;
}

export async function searchEbay(input) {
  const token = await getEbayToken();
  if (!token) return [];
  const condition = input.condition || "any";
  const filters = ["buyingOptions:{FIXED_PRICE}"];
  if (condition === "new") filters.push("conditions:{NEW}");
  else if (condition === "used") filters.push("conditions:{USED}");
  else filters.push("conditionIds:{" + (EBAY_CONDITION_IDS[condition] || EBAY_CONDITION_IDS.any) + "}");
  const params = new URLSearchParams({ q: input.query, limit: "200", filter: filters.join(",") });
  const data = await providerFetch("ebay", "https://api.ebay.com/buy/browse/v1/item_summary/search?" + params.toString(), {
    headers: { "Authorization": "Bearer " + token, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" }
  }, [token]);
  return (data.itemSummaries || []).map(x => {
    const shipValue = x.shippingOptions?.[0]?.shippingCost?.value;
    const shippingKnown = shipValue !== undefined && shipValue !== null;
    return offer({
      provider: "eBay Browse API", providerItemId: x.itemId || null, marketplace: "ebay", seller: x.seller?.username || "eBay seller",
      title: x.title || "", url: x.itemWebUrl || null, itemPrice: Number(x.price?.value || 0),
      shipping: shippingKnown ? Number(shipValue) : 0, shippingKnown,
      structuredCondition: x.condition || "", sellerFeedback: Number(x.seller?.feedbackPercentage || 0) || null,
      freshness: x.itemCreationDate || null
    });
  });
}

// ---------------------------------------------------------------------------
// Qualification, de-duplication and diagnostics
// ---------------------------------------------------------------------------
export function listingIdentity(x) {
  let url;
  try { url = new URL(x.url); } catch { url = null; }
  const host = url ? url.hostname.replace(/^www\./, "") : "";
  const path = url ? url.pathname : "";
  if (host.endsWith("ebay.com")) { const id = path.match(/\/itm\/(?:[^/]+\/)?(\d{9,})/)?.[1]; if (id) return "ebay:" + id; }
  if (host.endsWith("amazon.com")) { const asin = path.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i)?.[1]; if (asin) return "amazon:" + asin.toUpperCase(); }
  if (host.endsWith("walmart.com")) { const id = path.match(/\/ip\/(?:[^/]+\/)?(\d{5,})/)?.[1]; if (id) return "walmart:" + id; }
  if (host.endsWith("bestbuy.com")) {
    const id = url.searchParams.get("skuId") || path.match(/\/(\d{6,8})\.p/)?.[1];
    if (id) return "bestbuy:" + id + ":" + x.condition + ":" + Math.round(x.itemPrice);
  }
  if (host.endsWith("newegg.com")) { const id = url.searchParams.get("Item") || path.match(/\/p\/([A-Z0-9-]+)/i)?.[1]; if (id) return "newegg:" + id.toUpperCase(); }
  if (host.endsWith("mercari.com")) { const id = path.match(/\/item\/(m\d+)/i)?.[1]; if (id) return "mercari:" + id; }
  if (host.includes("aliexpress.")) { const id = path.match(/\/item\/(\d+)/)?.[1]; if (id) return "aliexpress:" + id; }
  if (host && !/(^|\.)google\./.test(host)) return "url:" + host + path.replace(/\/+$/, "");
  return null;
}

function titlePriceKey(x) {
  return (x.marketplace || x.seller || "") + "|" + normalizeListingText(x.title) + "|" + Math.round(x.itemPrice);
}

// Direct marketplace data (structured condition, shipping, item ids) wins
// over the same listing seen through Google Shopping.
function providerPriority(provider) {
  if (/Store price search/.test(provider || "")) return 2;
  if (/site search/.test(provider || "")) return 3;
  return 1;
}

function dedupe(items) {
  const seenId = new Set();
  const seenTitle = new Map();
  const out = [];
  let duplicates = 0;
  for (const x of items.slice().sort((a, b) => providerPriority(a.provider) - providerPriority(b.provider))) {
    const id = listingIdentity(x);
    const tp = titlePriceKey(x);
    const sameTitleOtherProvider = seenTitle.has(tp) && seenTitle.get(tp) !== x.provider;
    if ((id && seenId.has(id)) || sameTitleOtherProvider) { duplicates++; continue; }
    if (id) seenId.add(id);
    if (!seenTitle.has(tp)) seenTitle.set(tp, x.provider);
    out.push(x);
  }
  return { items: out, duplicates };
}

function emptyStats(name) {
  return { name, status: "ok", raw: 0, priced: 0, kept: 0, duplicates: 0, dropped: {}, examples: [], message: null, cached: false };
}

// Turn raw provider offers into qualified listings and record, per provider,
// how many were dropped and why.
export function qualifyOffers(rawOffers, input, { selected = null, includeOtherMerchants = false, stats = new Map() } = {}) {
  const selectedSet = selected ? new Set(selected) : null;
  const accepted = [];
  for (const raw of rawOffers) {
    const s = stats.get(raw.provider) || stats.set(raw.provider, emptyStats(raw.provider)).get(raw.provider);
    s.raw++;
    const drop = (reason, detail) => {
      s.dropped[reason] = (s.dropped[reason] || 0) + 1;
      if (s.examples.length < 6 && !s.examples.some(e => e.reason === reason)) s.examples.push({ reason, detail: detail || null, title: String(raw.title || "").slice(0, 140), price: raw.itemPrice || null });
    };
    if (!(raw.itemPrice > 0) || !Number.isFinite(raw.totalPrice)) { drop("no-price"); continue; }
    s.priced++;
    const marketplace = raw.marketplace || marketplaceIdFromResult(raw.seller, raw.url);
    if (selectedSet && !(marketplace ? selectedSet.has(marketplace) : includeOtherMerchants)) {
      drop(marketplace ? "store-not-selected" : "store-not-in-list", raw.seller);
      continue;
    }
    if (!isTrustedMerchant(raw.seller, raw.url, marketplace)) { drop("untrusted-store", raw.seller); continue; }
    const verdict = evaluateListing({
      title: raw.title,
      query: input.query,
      category: input.category,
      structuredCondition: raw.structuredCondition,
      defaultCondition: raw.defaultCondition,
      requestedCondition: input.condition || "any"
    });
    if (!verdict.ok) { drop(verdict.reason, verdict.detail); continue; }
    const riskFlags = [];
    // Named retailers sell new stock unless the listing says otherwise; only
    // flag the assumption for stores where that is not a safe default.
    const trustedNewRetailer = marketplace && MARKETPLACE_DEFAULT_CONDITION[marketplace] === "new";
    if (verdict.conditionAssumed && !trustedNewRetailer) riskFlags.push("Condition not stated by the store; assumed " + verdict.condition + ".");
    if (raw.priceIsRange) riskFlags.push("Multi-variation listing; the price shown is its lowest option.");
    accepted.push({
      id: raw.provider + "|" + (listingIdentity({ ...raw, condition: verdict.condition }) || raw.providerItemId || titlePriceKey(raw)),
      source: marketplace ? marketplaceName(marketplace) : (raw.seller || "Other store"),
      marketplace: marketplace || "other",
      provider: raw.provider,
      sourceType: marketplace ? "marketplace" : "retailer",
      title: raw.title,
      condition: verdict.condition,
      conditionAssumed: verdict.conditionAssumed,
      itemPrice: raw.itemPrice,
      shipping: raw.shipping,
      shippingKnown: raw.shippingKnown,
      totalPrice: Math.round(raw.totalPrice * 100) / 100,
      seller: raw.seller,
      url: safeUrl(raw.url),
      sellerFeedback: raw.sellerFeedback || null,
      soldCount: raw.soldCount || 0,
      watchers: raw.watchers || 0,
      rating: raw.rating || null,
      reviews: raw.reviews || null,
      freshness: raw.freshness || null,
      image: raw.image || null,
      relevance: verdict.relevance,
      sourceRiskFlags: riskFlags
    });
  }
  const deduped = dedupe(accepted);
  const duplicates = deduped.duplicates;
  // Scam guard: with enough comps, a listing under 40% of the median price is
  // almost always fake, a box, or a bait listing — drop it.
  const prices = deduped.items.map(x => x.totalPrice).sort((a, b) => a - b);
  const mid = prices.length >= 6 ? prices[Math.floor(prices.length / 2)] : null;
  const items = [];
  for (const x of deduped.items) {
    // Launch-price floor: a "new RTX 5090" far below MSRP is fake, whatever
    // the other listings say (AliExpress listings get a stricter floor).
    const msrp = Number(input.msrp) || 0;
    const kindCore = /gpu|graphics|^cpu$|processor/i.test(String(input.category || ""));
    const msrpFloor = !msrp ? 0 : x.marketplace === "aliexpress" && kindCore ? 0.6 : x.condition === "new" || x.condition === "open-box" ? 0.5 : 0.3;
    if (msrpFloor && x.totalPrice < msrp * msrpFloor) {
      const st = stats.get(x.provider);
      if (st) {
        st.dropped["far-below-msrp"] = (st.dropped["far-below-msrp"] || 0) + 1;
        if (st.examples.length < 6 && !st.examples.some(e => e.reason === "far-below-msrp")) st.examples.push({ reason: "far-below-msrp", detail: "MSRP " + msrp, title: x.title.slice(0, 140), price: x.totalPrice });
      }
      continue;
    }
    if (mid && x.totalPrice < mid * 0.4) {
      const st = stats.get(x.provider);
      if (st) {
        st.dropped["too-good-to-be-true"] = (st.dropped["too-good-to-be-true"] || 0) + 1;
        if (st.examples.length < 6 && !st.examples.some(e => e.reason === "too-good-to-be-true")) st.examples.push({ reason: "too-good-to-be-true", detail: "median " + mid, title: x.title.slice(0, 140), price: x.totalPrice });
      }
      continue;
    }
    // Only real listings: a direct link to the item page or nothing.
    const link = listingLink(x.url);
    if (!link.url) {
      const st = stats.get(x.provider);
      if (st) {
        st.dropped["no-direct-link"] = (st.dropped["no-direct-link"] || 0) + 1;
        if (st.examples.length < 6 && !st.examples.some(e => e.reason === "no-direct-link")) st.examples.push({ reason: "no-direct-link", detail: x.seller, title: x.title.slice(0, 140), price: x.totalPrice });
      }
      continue;
    }
    x.url = link.url;
    x.linkType = link.linkType;
    items.push(x);
  }
  // Listing ids must be unique: the UI keys and re-orders cards by id.
  const usedIds = new Map();
  for (const x of items) {
    const n = usedIds.get(x.id) || 0;
    usedIds.set(x.id, n + 1);
    if (n) x.id += "#" + n;
  }
  const keptByProvider = new Map();
  for (const x of items) keptByProvider.set(x.provider, (keptByProvider.get(x.provider) || 0) + 1);
  const accByProvider = new Map();
  for (const x of accepted) accByProvider.set(x.provider, (accByProvider.get(x.provider) || 0) + 1);
  for (const [name, s] of stats) {
    s.kept = keptByProvider.get(name) || 0;
    s.duplicates = Math.max(0, (accByProvider.get(name) || 0) - s.kept - (s.dropped["too-good-to-be-true"] || 0) - (s.dropped["no-direct-link"] || 0) - (s.dropped["far-below-msrp"] || 0));
  }
  return { items, stats, duplicates };
}

// ---------------------------------------------------------------------------
// Market statistics and ranking
// ---------------------------------------------------------------------------
function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
}

function robustFilter(items) {
  if (items.length < 5) return items;
  const prices = items.map(x => x.totalPrice).sort((a, b) => a - b);
  const q1 = quantile(prices, .25);
  const q3 = quantile(prices, .75);
  const iqr = q3 - q1;
  return items.filter(x => x.totalPrice >= Math.max(0, q1 - 1.5 * iqr) && x.totalPrice <= q3 + 1.5 * iqr);
}

function median(values) {
  const a = values.slice().sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function conditionGroup(condition) {
  return condition === "renewed" ? "refurbished" : condition;
}

function simpleDedupe(items) {
  const seen = new Set();
  return items.filter(x => {
    const key = (listingIdentity(x) || "") + "|" + normalizeListingText(x.title) + "|" + Math.round(x.totalPrice * 100);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildMarket(items) {
  const relevant = simpleDedupe(items).filter(x => x.relevance >= 0.72 && Number.isFinite(x.totalPrice) && x.totalPrice > 0);
  const filtered = robustFilter(relevant);
  const prices = filtered.map(x => x.totalPrice);
  const byCondition = {};
  const bySource = {};
  const groups = {};
  for (const item of filtered) {
    byCondition[item.condition] = (byCondition[item.condition] || 0) + 1;
    bySource[item.source] = (bySource[item.source] || 0) + 1;
    (groups[conditionGroup(item.condition)] ||= []).push(item.totalPrice);
  }
  // Used and new listings price differently; compare like with like when
  // there are enough comps in that condition.
  const conditionMedians = {};
  for (const [group, values] of Object.entries(groups)) if (values.length >= 4) conditionMedians[group] = Math.round(median(values) * 100) / 100;
  const med = median(prices);
  return {
    median: med === null ? null : Math.round(med * 100) / 100,
    low: prices.length ? Math.round(quantile(prices.slice().sort((a, b) => a - b), .15) * 100) / 100 : null,
    high: prices.length ? Math.round(quantile(prices.slice().sort((a, b) => a - b), .85) * 100) / 100 : null,
    sampleSize: filtered.length,
    rawSampleSize: items.length,
    byCondition,
    bySource,
    conditionMedians,
    shippingKnownPct: filtered.length ? Math.round(filtered.filter(x => x.shippingKnown).length / filtered.length * 100) : 0,
    confidence: filtered.length >= 80 ? "Very high" : filtered.length >= 35 ? "High" : filtered.length >= 15 ? "Medium" : "Low",
    comps: filtered
  };
}

function weightedMedian(items, valueFn, weightFn) {
  if (!items.length) return null;
  const rows = items.map(x => ({ value: valueFn(x), weight: Math.max(1, weightFn(x)) }))
    .filter(x => Number.isFinite(x.value) && x.value > 0)
    .sort((a, b) => a.value - b.value);
  const total = rows.reduce((s, x) => s + x.weight, 0);
  let acc = 0;
  for (const row of rows) {
    acc += row.weight;
    if (acc >= total / 2) return row.value;
  }
  return rows[rows.length - 1]?.value || null;
}

export function buildSalesEvidence(items) {
  const qualifying = robustFilter(simpleDedupe(items).filter(x => x.relevance >= 0.72 && Number.isFinite(x.totalPrice) && x.totalPrice > 0 && Number(x.soldCount || 0) > 0));
  const medianPrice = weightedMedian(qualifying, x => x.totalPrice, x => Math.min(12, 1 + Math.log2(1 + Number(x.soldCount || 0))));
  const totalUnits = qualifying.reduce((s, x) => s + Number(x.soldCount || 0), 0);
  const prices = qualifying.map(x => x.totalPrice).sort((a, b) => a - b);
  return {
    median: medianPrice === null ? null : Math.round(medianPrice * 100) / 100,
    low: prices.length ? Math.round(quantile(prices, .20) * 100) / 100 : null,
    high: prices.length ? Math.round(quantile(prices, .80) * 100) / 100 : null,
    listingCount: qualifying.length,
    totalReportedUnitsSold: totalUnits,
    confidence: qualifying.length >= 15 ? "High" : qualifying.length >= 6 ? "Medium" : qualifying.length >= 2 ? "Low" : "Insufficient",
    listings: qualifying.sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0)).slice(0, 12),
    label: "Active asking price with prior units sold (not a completed-sale price)"
  };
}

function conditionQuality(condition) {
  if (condition === "new") return 1;
  if (condition === "open-box") return .92;
  if (condition === "renewed") return .88;
  if (condition === "refurbished") return .84;
  if (condition === "used") return .78;
  return .7;
}

function resaleAppeal(query, title) {
  const text = normalizeListingText(query + " " + title);
  let score = .6;
  if (/\brtx\s?(40|50)\d{2}/.test(text)) score += .18;
  if (/\brx\s?(7|8|9)\d{3}/.test(text)) score += .12;
  if (/\b(2tb|4tb)\b/.test(text) && /\bnvme\b/.test(text)) score += .08;
  return Math.min(1, score);
}

export function rankDeals(items, market, { query, partBudget, buildBudget, committed, sortBy = "best", msrp: launchMsrp = 0 }) {
  const overallMedian = market.median || 0;
  const remainingBefore = Math.max(0, Number(buildBudget || 0) - Number(committed || 0));
  const maxPart = Number(partBudget || 0);
  const sample = Number(market.sampleSize || 0);
  const evidenceCap = sample >= 35 ? 95 : sample >= 15 ? 88 : sample >= 8 ? 78 : sample >= 4 ? 65 : 50;

  // Every qualified listing is ranked; the robust-trimmed comps only set the
  // market reference, so unusually cheap valid listings stay visible.
  const scored = simpleDedupe(items).filter(x => Number.isFinite(x.totalPrice) && x.totalPrice > 0).map(item => {
    const group = conditionGroup(item.condition);
    const medianValue = market.conditionMedians?.[group] || overallMedian;
    // Value vs the live market for this condition, blended with value vs
    // launch MSRP when the model has one.
    const underMarket = medianValue ? (medianValue - item.totalPrice) / medianValue : 0;
    const msrp = Number(launchMsrp) || 0;
    const under = msrp ? underMarket * 0.6 + ((msrp - item.totalPrice) / msrp) * 0.4 : underMarket;
    const underScore = Math.max(0, Math.min(1, (under + .10) / .35));
    const budgetScore = maxPart ? Math.max(0, Math.min(1, 1 - (item.totalPrice / maxPart - 0.70))) : .55;
    const buildFit = remainingBefore ? Math.max(0, Math.min(1, (remainingBefore - item.totalPrice) / Math.max(remainingBefore, .01) + .35)) : .5;
    const conditionScore = conditionQuality(item.condition);
    const appeal = resaleAppeal(query, item.title);
    const shippingScore = item.shippingKnown ? 1 : .45;
    const relevance = Math.max(0, Math.min(1, Number(item.relevance || 0)));

    let raw = 100 * (.36 * underScore + .15 * budgetScore + .12 * buildFit + .09 * conditionScore + .10 * appeal + .08 * shippingScore + .10 * relevance);
    const riskFlags = [...(item.sourceRiskFlags || [])];
    if (under > .45) {
      raw -= 18;
      riskFlags.push("Price is >45% below the filtered market median — verify condition, completeness, and seller.");
    }
    if (!item.shippingKnown) {
      raw -= 5;
      riskFlags.push("Shipping cost is unknown.");
    }
    if (relevance < .72) {
      raw -= 8;
      riskFlags.push("Listing-title match is weaker than ideal.");
    }
    if (sample < 8) riskFlags.push("Market sample is small; score is capped.");
    if (item.condition === "unknown") riskFlags.push("Condition is not clearly identified.");

    const itemCap = Math.min(evidenceCap, item.shippingKnown ? 100 : 69, under > .45 ? 59 : 100, relevance < .72 ? 59 : 100, item.condition === "unknown" ? 69 : 100);
    const score = Math.max(0, Math.min(itemCap, Math.round(raw)));
    return {
      ...item,
      score,
      scoreCap: itemCap,
      riskFlags,
      evidenceSampleSize: sample,
      marketReference: medianValue,
      marketBasis: market.conditionMedians?.[group] ? group + " listings" : "all listings",
      percentVsMarket: medianValue ? Math.round((medianValue - item.totalPrice) / medianValue * 100) : 0,
      budgetLeft: remainingBefore - item.totalPrice,
      withinPartBudget: !maxPart || item.totalPrice <= maxPart
    };
  });
  return sortDeals(scored, sortBy);
}

// ---------------------------------------------------------------------------
// Provider call cache (raw offers), shared by every search path
// ---------------------------------------------------------------------------
const offerCache = new Map();
const offerInFlight = new Map();

function keyHash(input) {
  return createHash("sha256").update(JSON.stringify([
    providerKey("SERPER_API_KEY", input), providerKey("SEARCHAPI_API_KEY", input),
    env("SERPAPI_API_KEY"), env("BESTBUY_API_KEY"), env("EBAY_CLIENT_ID")
  ])).digest("hex").slice(0, 16);
}

async function cachedOffers(cacheKey, fn) {
  const hit = offerCache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return { offers: hit.offers, cached: true };
  if (!offerInFlight.has(cacheKey)) {
    offerInFlight.set(cacheKey, (async () => {
      const offers = await fn();
      offerCache.set(cacheKey, { at: Date.now(), offers });
      if (offerCache.size > 500) offerCache.delete(offerCache.keys().next().value);
      return { offers, cached: false };
    })().finally(() => offerInFlight.delete(cacheKey)));
  }
  return offerInFlight.get(cacheKey);
}

function callSpec(id, name, marketplaces, input, params, run) {
  const key = [id, keyHash(input), JSON.stringify(params)].join("|");
  return { id, name, marketplaces, params, run: () => cachedOffers(key, run) };
}

async function executeCalls(calls) {
  return Promise.all(calls.map(async call => {
    try {
      const { offers, cached } = await call.run();
      return { call, offers, cached };
    } catch (error) {
      const message = error instanceof ProviderError ? error.message : "failed: " + redact(error?.message || error);
      return { call, offers: [], error: message, skipped: Boolean(error?.skipped) };
    }
  }));
}

// ---------------------------------------------------------------------------
// Marketplace search used by Deal Scanner and Deal Hunt
// ---------------------------------------------------------------------------
const DIRECT_STORE_ENGINES = {
  amazon: { name: "Amazon (SearchAPI)", run: searchSearchApiAmazon, conditions: ["any", "new", "renewed", "refurbished"] },
  walmart: { name: "Walmart (SearchAPI)", run: searchSearchApiWalmart, conditions: ["any", "new", "renewed", "refurbished"] },
  bestbuy: { name: "Best Buy (SearchAPI)", run: searchSearchApiBestBuy, conditions: ["any", "new", "open-box"] }
};

// ---------------------------------------------------------------------------
// Real-link resolution. Google Shopping knows which store sells a part and at
// what price, but usually links to its own page. For each such offer, search
// that exact title on that store and keep the store's real item page; offers
// that cannot be resolved are not shown.
// ---------------------------------------------------------------------------
const STORE_DOMAINS = {
  amazon: "amazon.com", bestbuy: "bestbuy.com", walmart: "walmart.com", newegg: "newegg.com", ebay: "ebay.com",
  aliexpress: "aliexpress", mercari: "mercari.com", bhphoto: "bhphotovideo.com", adorama: "adorama.com", microcenter: "microcenter.com"
};
const PRODUCT_PATHS = {
  amazon: /\/(dp|gp\/product)\//, bestbuy: /^\/site\/.+\.p$/, walmart: /^\/ip\//, newegg: /\/p\//, ebay: /^\/itm\//,
  aliexpress: /^\/item\//, mercari: /^\/us\/item\//, bhphoto: /^\/c\/product\//, adorama: /\.html$|^\/[a-z0-9-]+\.html/, microcenter: /^\/product\//
};
const resolveCache = new Map();

function titleTokens(t) { return new Set(normalizeListingText(t).split(" ").filter(w => w.length > 1)); }
function titleSimilarity(a, b) {
  const A = titleTokens(a), B = titleTokens(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  return hit / Math.min(A.size, B.size);
}

function storeHostMatches(host, item) {
  const h = host.replace(/^www\./, "");
  if (item.marketplace && item.marketplace !== "other") return h.includes(STORE_DOMAINS[item.marketplace] || item.marketplace);
  const seller = String(item.seller || "").toLowerCase().replace(/\.com$/, "").replace(/[^a-z0-9]/g, "");
  return seller.length >= 3 && h.replace(/[^a-z0-9]/g, "").includes(seller);
}

function looksLikeProductPage(u, item) {
  const path = u.pathname.toLowerCase();
  if (/\/(sch|search|s|browse|category|categories|c|l|deals?)(\/|$)|searchpage|search_results/.test(path) && !/\/c\/product\//.test(path)) return false;
  if (u.search && /[?&](k|q|_nkw|st|keyword|ntt|query)=/.test(u.search)) return false;
  const re = PRODUCT_PATHS[item.marketplace];
  return re ? re.test(path) : path.split("/").filter(Boolean).length >= 1;
}

async function resolveOne(input, item) {
  const store = item.marketplace && item.marketplace !== "other" ? marketplaceName(item.marketplace) : item.seller;
  const key = (store + "|" + item.title).toLowerCase();
  if (resolveCache.has(key)) return resolveCache.get(key);
  const apiKey = providerKey("SERPER_API_KEY", input);
  let found = null;
  try {
    const data = await providerFetch("serper", "https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: item.title.slice(0, 110) + " " + store, gl: "us", hl: "en", num: 10 })
    }, [apiKey]);
    for (const r of data.organic || []) {
      let u;
      try { u = new URL(r.link); } catch { continue; }
      if (!storeHostMatches(u.hostname, item) || !looksLikeProductPage(u, item)) continue;
      if (titleSimilarity(item.title, r.title) < 0.6) continue;
      found = u.href;
      break;
    }
  } catch { found = null; }
  resolveCache.set(key, found);
  if (resolveCache.size > 3000) resolveCache.delete(resolveCache.keys().next().value);
  return found;
}

// Resolve Google-linked offers (cheapest first, up to `limit`); drop the rest.
async function resolveRealLinks(input, items, stats, limit) {
  const google = items.filter(x => x.linkType === "google").sort((a, b) => a.totalPrice - b.totalPrice);
  const toResolve = new Set(google.slice(0, limit));
  await Promise.all([...toResolve].map(async x => {
    const url = await resolveOne(input, x);
    if (url) { x.url = url; x.linkType = "listing"; x.provider = x.provider + " → store page"; }
  }));
  const out = [];
  for (const x of items) {
    if (x.linkType === "listing") { out.push(x); continue; }
    const name = x.provider.replace(/ → store page$/, "");
    const st = stats.get(name) || stats.set(name, emptyStats(name)).get(name);
    const reason = toResolve.has(x) ? "no-real-store-page" : "not-resolved";
    st.dropped[reason] = (st.dropped[reason] || 0) + 1;
    st.kept = Math.max(0, st.kept - 1);
  }
  return out;
}

// Google Shopping query variants. Shopping results default to new retail
// stock, so used/refurbished/open-box listings need their own queries.
function shoppingQueries(query, condition) {
  if (condition === "any") return [query, "used " + query, "refurbished " + query];
  return [[conditionSearchTerm(condition), query].filter(Boolean).join(" ")];
}

const STORE_QUERY_NAMES = { amazon: "amazon", walmart: "walmart", bestbuy: "best buy", newegg: "newegg", ebay: "ebay", mercari: "mercari", aliexpress: "aliexpress", bhphoto: "b&h photo", adorama: "adorama", microcenter: "micro center" };
const STORE_PRIORITY = ["ebay", "newegg", "amazon", "walmart", "bestbuy", "mercari", "aliexpress", "microcenter", "bhphoto", "adorama"];

function shoppingCall(input, has, q) {
  if (has.serper) return callSpec("serper", "Store price search", null, input, { q }, () => searchSerperShopping(input, { q }));
  if (has.serpapi) return callSpec("serpapi", "Store price search (SerpApi)", null, input, { q }, () => searchSerpApi({ ...input, query: q, condition: "any" }));
  if (has.searchapi) return callSpec("searchapi-gshop", "Store price search (SearchAPI)", null, input, { q }, () => searchSearchApiGoogleShopping(input, { q }));
  return null;
}

// Every scan is a full ("deep") scan: Google Shopping variants for every
// condition, a structured eBay source, then targeted queries for any selected
// store that still has no match. Exhausted providers are skipped, not retried.
// lite (browse grid): new + used Google Shopping queries and one item-page
// search for eBay/AliExpress/Mercari — no store-targeted follow-ups.
export async function searchMarketplaces(input, { includeOtherMerchants = false, lite = false } = {}) {
  const started = Date.now();
  const selected = [...new Set((input.marketplaces && input.marketplaces.length ? input.marketplaces : ALL_MARKETPLACES).filter(id => ALL_MARKETPLACES.includes(id)))];
  const has = availableProviders(input);
  // PSUs, cooling, monitors, drives etc. are new-only; used listings are only
  // searched and shown for GPUs, CPUs, RAM, SSDs and motherboards.
  const condition = allowsUsed(input.category) ? (input.condition || "any") : "new";
  const query = String(input.query || "").trim();
  const wants = id => selected.includes(id);
  const searchInput = { ...input, query, condition, deepScan: true };

  const round1 = shoppingQueries(query, condition).slice(0, lite ? 2 : 3).map(q => shoppingCall(searchInput, has, q)).filter(Boolean);
  const organicOk = !lite; // browse cards stay credit-light: Google Shopping + link resolution only
  const itemSites = ["ebay", "aliexpress", "mercari"].filter(wants);
  // Deep (non-lite) scans also read Google Shopping page 2 and run a
  // separate used-only item-page search, for many more listings per part.
  if (!lite && has.serper) {
    const q2 = shoppingQueries(query, condition)[0];
    round1.push(callSpec("serper", "Store price search", null, searchInput, { q: q2, page: 2 }, () => searchSerperShopping(searchInput, { q: q2, page: 2 })));
  }
  const retailSites = ["amazon", "newegg", "bestbuy", "walmart", "microcenter", "bhphoto"].filter(wants);
  if (organicOk && has.serper && retailSites.length) round1.push(callSpec("serper-retail", "Retailer pages (Serper web search)", retailSites, searchInput, { q: query, condition: "new", sites: retailSites }, () => searchSerperItemPages({ ...searchInput, condition: "new" }, { marketplaces: retailSites, retail: true })));
  if (organicOk && has.serper && itemSites.length) round1.push(callSpec("serper-items", "Item pages (Serper web search)", itemSites, searchInput, { q: query, condition, sites: itemSites }, () => searchSerperItemPages(searchInput, { marketplaces: itemSites })));
  if (!lite && has.serper && wants("aliexpress")) round1.push(callSpec("serper-items", "Item pages (Serper web search)", ["aliexpress"], searchInput, { q: query, condition, sites: ["aliexpress"] }, () => searchSerperItemPages(searchInput, { marketplaces: ["aliexpress"] })));
  if (!lite && has.serper && itemSites.length && condition === "any" && allowsUsed(input.category)) {
    const usedInput = { ...searchInput, condition: "used" };
    round1.push(callSpec("serper-items", "Item pages (Serper web search)", itemSites, searchInput, { q: query, condition: "used", sites: itemSites }, () => searchSerperItemPages(usedInput, { marketplaces: itemSites })));
  }
  if (wants("ebay") && !lite) {
    if (has.ebayApi) round1.push(callSpec("ebay-api", "eBay Browse API", ["ebay"], searchInput, { q: query, condition }, () => searchEbay(searchInput)));
    else if (has.serpapi) round1.push(callSpec("serpapi-ebay", "eBay (SerpApi)", ["ebay"], searchInput, { q: query, condition }, () => searchSerpApiEbay(searchInput)));
    else if (has.searchapi) round1.push(callSpec("searchapi-ebay", "eBay (SearchAPI)", ["ebay"], searchInput, { q: query, condition }, () => searchSearchApiEbay(searchInput)));
  }
  if (wants("bestbuy") && has.bestbuyApi && !lite) round1.push(callSpec("bestbuy-api", "Best Buy API", ["bestbuy"], searchInput, { q: query, condition }, () => searchBestBuy(searchInput)));

  const settled = await executeCalls(round1);
  let qualified = qualifyOffers(settled.flatMap(r => r.offers), searchInput, { selected, includeOtherMerchants, stats: new Map() });

  // Round 2: stores with no qualified listing yet get a direct store search
  // (SearchAPI, if it still has credits) or a store-targeted shopping query.
  const round2 = [];
  if (!lite && Date.now() - started < 20000) {
    const found = new Set(qualified.items.map(x => x.marketplace));
    const searchApiOk = has.searchapi && !settled.some(r => r.error && r.call.id.startsWith("searchapi"));
    const missing = STORE_PRIORITY.filter(id => wants(id) && !found.has(id));
    let targeted = 0;
    for (const id of missing) {
      const engine = DIRECT_STORE_ENGINES[id];
      if (searchApiOk && engine && engine.conditions.includes(condition)) {
        round2.push(callSpec("searchapi-" + id, engine.name, [id], searchInput, { q: query, condition }, () => engine.run(searchInput)));
      } else if (has.serper && targeted < 3) {
        const q = [conditionSearchTerm(condition), query, STORE_QUERY_NAMES[id]].filter(Boolean).join(" ");
        round2.push(callSpec("serper", "Store price search", [id], searchInput, { q }, () => searchSerperShopping(searchInput, { q })));
        targeted++;
      }
    }
  }
  const settled2 = round2.length ? await executeCalls(round2) : [];
  const all = [...settled, ...settled2];
  if (settled2.length) qualified = qualifyOffers(all.flatMap(r => r.offers), searchInput, { selected, includeOtherMerchants, stats: new Map() });

  // Only real store listings are shown: resolve Google-linked offers to the
  // store's own item page (Google Shopping stays a background source).
  if (has.serper) qualified.items = await resolveRealLinks(searchInput, qualified.items, qualified.stats, lite ? 4 : 12);
  else qualified.items = qualified.items.filter(x => x.linkType === "listing");
  const providers = summarizeProviders(all, qualified.stats);
  const errors = providers.filter(p => p.status === "error" || p.status === "skipped").map(p => ({ provider: p.name, message: p.message }));
  const market = buildMarket(qualified.items);
  const ranked = rankDeals(qualified.items, market, { ...input, sortBy: input.sortBy || "lowest" });
  const storeCounts = Object.fromEntries(selected.map(id => [id, ranked.filter(x => x.marketplace === id).length]));
  return {
    items: qualified.items,
    market,
    ranked,
    errors,
    providers,
    coverage: marketplaceCoverage(selected, has, all, storeCounts, condition),
    storeCounts,
    observedAt: new Date().toISOString(),
    cached: all.length > 0 && all.every(r => r.cached),
    stale: false
  };
}

function summarizeProviders(results, stats) {
  const byName = new Map();
  for (const r of results) {
    const name = r.call.name;
    const entry = byName.get(name) || { name, calls: 0, cachedCalls: 0, errors: [], skipped: false };
    entry.calls++;
    if (r.cached) entry.cachedCalls++;
    if (r.error) entry.errors.push(r.error);
    if (r.skipped) entry.skipped = true;
    byName.set(name, entry);
  }
  return [...byName.values()].map(entry => {
    const s = stats.get(entry.name) || emptyStats(entry.name);
    const failedAll = entry.errors.length === entry.calls;
    return {
      name: entry.name,
      status: failedAll ? (entry.skipped ? "skipped" : "error") : "ok",
      message: entry.errors[0] || null,
      calls: entry.calls,
      cachedCalls: entry.cachedCalls,
      raw: s.raw,
      priced: s.priced,
      kept: s.kept,
      duplicates: s.duplicates,
      dropped: s.dropped,
      examples: s.examples
    };
  });
}

function marketplaceCoverage(selected, has, results, storeCounts, condition) {
  const queried = new Set(results.filter(r => !r.error && r.call.id !== "serper").flatMap(r => r.call.marketplaces || []));
  const targeted = new Set(results.filter(r => !r.error && r.call.id === "serper").flatMap(r => r.call.marketplaces || []));
  const broad = results.some(r => !r.error && !r.call.marketplaces);
  return selected.map(id => {
    const direct = queried.has(id);
    let note;
    if (direct) note = "Searched directly";
    else if (targeted.has(id)) note = "Store price search + store-targeted query";
    else if (broad) note = "Searched via store price search";
    else note = "Not searched: no working provider";
    if (!direct && id in DIRECT_STORE_ENGINES && !DIRECT_STORE_ENGINES[id].conditions.includes(condition)) note += "; store search has no " + condition + " filter";
    if (!direct && ["newegg", "mercari", "aliexpress", "bhphoto", "adorama", "microcenter"].includes(id)) note += " (no public listing API)";
    return { id, name: marketplaceName(id), listings: storeCounts[id] || 0, direct, note };
  });
}

// Deal Hunt entry point (kept for the existing API and tests).
export async function searchPartsSniper(input) {
  return searchMarketplaces(input, { includeOtherMerchants: false });
}

// ---------------------------------------------------------------------------
// PC analyzer component/complete-PC searches (credit-light provider choice)
// ---------------------------------------------------------------------------
const searchCache = new Map();
const inFlight = new Map();

function cacheKey(input) {
  return [
    normalizeListingText(input.query),
    String(input.postalCode || ""), String(input.distanceRadius || 50), Boolean(input.localOnly),
    keyHash(input),
    String(input.category || "").toLowerCase(),
    input.condition || "any",
    input.deepScan ? "deep" : "fast",
    input.componentEstimate ? "component" : "direct"
  ].join("|");
}

function chooseProviders(input) {
  const has = availableProviders(input);
  const condition = input.condition || "any";
  const providers = [];
  if (input.localOnly) return has.searchapi ? [["eBay local (SearchAPI)", () => searchSearchApiEbay(input)]] : [];

  if (input.componentEstimate) {
    const cat = String(input.category || "").toLowerCase();
    if (condition === "used" && has.searchapi && (cat === "gpu" || cat === "cpu")) return [["eBay (SearchAPI)", () => searchSearchApiEbay(input)]];
    if (has.serper) return [["Store price search", () => searchSerperShopping(input)]];
  }

  if (condition === "used" || condition === "renewed" || condition === "refurbished") {
    if (has.searchapi) providers.push(["eBay (SearchAPI)", () => searchSearchApiEbay(input)]);
    else if (has.ebayApi && condition === "used") providers.push(["eBay Browse API", () => searchEbay(input)]);
    if (has.serper) providers.push(["Store price search", () => searchSerperShopping(input)]);
    else if (!providers.length && has.serpapi) providers.push(["Store price search (SerpApi)", () => searchSerpApi(input)]);
    return providers;
  }

  if (condition === "open-box") {
    if (has.searchapi) {
      providers.push(["Best Buy (SearchAPI)", () => searchSearchApiBestBuy(input)]);
      providers.push(["eBay (SearchAPI)", () => searchSearchApiEbay(input)]);
    } else if (has.bestbuyApi) providers.push(["Best Buy API", () => searchBestBuy(input)]);
    else if (has.ebayApi) providers.push(["eBay Browse API", () => searchEbay(input)]);
    else if (has.serper) providers.push(["Store price search", () => searchSerperShopping(input)]);
    return providers;
  }

  if (has.serper) providers.push(["Store price search", () => searchSerperShopping(input)]);
  else if (has.serpapi) providers.push(["Store price search (SerpApi)", () => searchSerpApi(input)]);
  if ((input.deepScan || (!has.serper && !has.serpapi)) && has.searchapi) {
    providers.push(["Walmart (SearchAPI)", () => searchSearchApiWalmart(input)]);
    providers.push(["Best Buy (SearchAPI)", () => searchSearchApiBestBuy(input)]);
    if (condition === "any") providers.push(["eBay (SearchAPI)", () => searchSearchApiEbay(input)]);
  } else if (!has.serper && !has.serpapi) {
    if (has.bestbuyApi) providers.push(["Best Buy API", () => searchBestBuy(input)]);
    if (has.ebayApi) providers.push(["eBay Browse API", () => searchEbay(input)]);
  }
  return providers;
}

async function fetchMarket(input, key, hit) {
  const providers = chooseProviders(input);
  const settled = await Promise.all(providers.map(async ([name, run]) => {
    try { return { name, offers: await run() }; }
    catch (error) { return { name, error: error instanceof ProviderError ? error.message : "failed: " + redact(error?.message || error) }; }
  }));
  const errors = settled.filter(x => x.error).map(x => ({ provider: x.name, message: x.error }));
  if (providers.length && errors.length === providers.length && hit && Date.now() - hit.savedAt < 60 * 60 * 1000) return { ...hit.value, errors, stale: true };
  const { items, stats } = qualifyOffers(settled.flatMap(x => x.offers || []), input, {});
  const value = { items, market: buildMarket(items), errors, providers: [...stats.values()], observedAt: new Date().toISOString(), stale: false };
  // Short negative cache avoids hammering failed/quota-limited providers.
  searchCache.set(key, { savedAt: Date.now(), ttl: errors.length ? 30000 : CACHE_MS, value });
  if (searchCache.size > 150) searchCache.delete(searchCache.keys().next().value);
  return value;
}

export async function liveSearch(input) {
  const key = cacheKey(input);
  const hit = searchCache.get(key);
  let base;
  const cached = Boolean(hit && Date.now() - hit.savedAt < hit.ttl);
  if (cached) base = hit.value;
  else {
    if (!inFlight.has(key)) inFlight.set(key, fetchMarket(input, key, hit).finally(() => inFlight.delete(key)));
    base = await inFlight.get(key);
  }
  return { ...base, cached, ranked: rankDeals(base.items, base.market, input) };
}

export async function searchLocalEbay(input) {
  if (!providerKey("SEARCHAPI_API_KEY", input) || !input.postalCode) return { items: [], market: buildMarket([]), errors: [] };
  return liveSearch({ ...input, localOnly: true, distanceRadius: input.distanceRadius || 50 });
}

// Account check that does not spend search credits (best effort).
export async function searchApiAccount(input) {
  const apiKey = providerKey("SEARCHAPI_API_KEY", input);
  if (!apiKey) return null;
  return providerFetch("searchapi-account", "https://www.searchapi.io/api/v1/me?api_key=" + encodeURIComponent(apiKey), {}, [apiKey]);
}
