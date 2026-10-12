// Live check of marketplace item pages before they are shown.
//
// Google's index of eBay item pages is often days old: the listing may have
// sold, ended, been pulled ("We looked everywhere!") or changed price. Every
// eBay link not served by a live eBay API is therefore opened server-side
// (no API credits) and kept only if the page is still a live Buy It Now
// listing that is not "for parts"; the price shown is the page's own price.
// Pages that cannot be checked (blocked, timeout) are hidden, not guessed.
import { normalizeListingText } from "./matching.js";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
const cache = new Map(); // url -> { at, result }
const TTL = 20 * 60 * 1000;

export function ebayItemId(url) {
  try {
    const u = new URL(url);
    if (!/(^|\.)ebay\.com$/.test(u.hostname)) return null;
    return u.pathname.match(/\/itm\/(?:[^/]+\/)?(\d{9,15})/)?.[1] || null;
  } catch { return null; }
}

function money(s) {
  const n = Number(String(s || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function decode(s) {
  return String(s || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").trim();
}

// Pure parser (tested with saved page snippets).
export function parseEbayItemPage(html, status = 200) {
  const h = String(html || "");
  if (status === 404 || /We looked everywhere|this page is missing|The item you selected is no longer available|item(?:'|&#39;)s no longer available/i.test(h)) return { live: false, reason: "listing-removed" };
  if (/Pardon Our Interruption|captcha|Access Denied|splashui\/challenge/i.test(h) && !/x-price-primary|itemprop="price"/i.test(h)) return { live: null, reason: "check-blocked" };
  if (/This listing (?:was ended|has ended|sold on|ended on)|This item sold on|Bidding has ended|The seller has ended this listing|listing is no longer available|This item is out of stock|class="[^"]*\bd-quantity__availability[^"]*"[^>]*>[^<]*Out of stock/i.test(h)) return { live: false, reason: "sold-or-ended" };
  const condition = decode(
    h.match(/x-item-condition-text[\s\S]{0,400}?<span class="ux-textspans">([^<]{2,60})<\/span>/i)?.[1] ||
    h.match(/"conditionDisplayName"\s*:\s*"([^"]{2,60})"/)?.[1] || ""
  );
  if (/for parts|not working/i.test(condition)) return { live: false, reason: "for-parts", condition };
  const hasBin = /Buy It Now|binBtn|x-bin-action/i.test(h);
  if (/Place bid|x-bid-action/i.test(h) && !hasBin) return { live: false, reason: "auction-only" };
  const primary = h.match(/x-price-primary[\s\S]{0,300}?<span class="ux-textspans">([^<]+)<\/span>/i)?.[1] || "";
  const range = /\bto\b/i.test(primary);
  const price = range ? null : money(primary) ||
    money(h.match(/itemprop="price"\s+content="([\d.]+)"/i)?.[1]) ||
    money(h.match(/"price"\s*:\s*\{\s*"value"\s*:\s*"?([\d.]+)/)?.[1]);
  const rangeLow = range ? money(primary.split(/\bto\b/i)[0]) : null;
  const rangeHigh = range ? money(primary.split(/\bto\b/i)[1]) : null;
  if (!price && !range) return { live: null, reason: "no-price-on-page" };
  const title = decode(h.match(/<h1[^>]*x-item-title[\s\S]{0,200}?<span class="ux-textspans[^"]*">([^<]+)<\/span>/i)?.[1] ||
    h.match(/<meta property="og:title" content="([^"]+)"/i)?.[1] || "").replace(/\s*\|\s*eBay\s*$/i, "");
  const freeShip = /x-shipping[\s\S]{0,600}?\bFree\b/i.test(h) || /"shippingCost"\s*:\s*\{[^}]*"value"\s*:\s*"?0(?:\.0+)?"?/.test(h);
  return { live: true, price, range: range ? [rangeLow, rangeHigh] : null, condition, title, freeShipping: freeShip };
}

async function fetchPage(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9" }, redirect: "follow", signal: ctrl.signal });
    const html = await res.text();
    return { status: res.status, html, finalUrl: res.url };
  } finally { clearTimeout(t); }
}

export async function checkEbayListing(url, { timeoutMs = 7000, fetchImpl } = {}) {
  const id = ebayItemId(url);
  if (!id) return { live: false, reason: "not-an-item-page" };
  const canonical = "https://www.ebay.com/itm/" + id;
  const hit = cache.get(canonical);
  if (hit && Date.now() - hit.at < TTL) return hit.result;
  let result;
  try {
    const page = await (fetchImpl || fetchPage)(canonical, timeoutMs);
    // A removed item usually redirects to a search or the homepage.
    if (page.finalUrl && !/\/itm\//.test(page.finalUrl)) result = { live: false, reason: "listing-removed" };
    else result = parseEbayItemPage(page.html, page.status);
  } catch {
    result = { live: null, reason: "check-failed" };
  }
  result = { ...result, url: canonical };
  cache.set(canonical, { at: Date.now(), result });
  if (cache.size > 4000) cache.delete(cache.keys().next().value);
  return result;
}

const LIVE_EBAY_PROVIDERS = /SearchAPI|SerpApi|Browse API/;
export const needsLiveCheck = x => x.marketplace === "ebay" && !LIVE_EBAY_PROVIDERS.test(x.provider || "");

// Mercari pages can't be checked server-side and are very often already sold,
// so indexed Mercari pages are not shown.
export const unverifiable = x => x.marketplace === "mercari" && !LIVE_EBAY_PROVIDERS.test(x.provider || "");

async function pool(items, size, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const x = items[i++]; await fn(x); }
  }));
}

// Checks eBay items in place (cheapest first, up to `limit`). Returns the items
// that passed; `drop(item, reason)` is called for the rest.
export async function verifyListings(items, { limit = 16, concurrency = 6, recheck, drop = () => {}, fetchImpl } = {}) {
  const toCheck = items.filter(needsLiveCheck).sort((a, b) => a.totalPrice - b.totalPrice);
  const checked = new Set(toCheck.slice(0, limit));
  const results = new Map();
  await pool([...checked], concurrency, async x => { results.set(x, await checkEbayListing(x.url, { fetchImpl })); });
  const out = [];
  for (const x of items) {
    if (unverifiable(x)) { drop(x, "mercari-unverifiable"); continue; }
    if (!needsLiveCheck(x)) { out.push(x); continue; }
    if (!checked.has(x)) { drop(x, "ebay-not-checked"); continue; }
    const r = results.get(x);
    if (!r.live) { drop(x, r.live === null ? "ebay-check-blocked" : "ebay-" + r.reason); continue; }
    let price = r.price;
    if (!price && r.range) {
      // Multi-variation listing: keep the indexed price only if the page offers it.
      if (x.itemPrice >= r.range[0] - 0.01 && x.itemPrice <= r.range[1] + 0.01) price = x.itemPrice;
      else { drop(x, "ebay-price-changed"); continue; }
    }
    x.url = r.url;
    if (r.title && normalizeListingText(r.title)) x.title = r.title;
    if (r.condition) x.pageCondition = r.condition;
    x.itemPrice = Math.round(price * 100) / 100;
    if (r.freeShipping) { x.shipping = 0; x.shippingKnown = true; }
    x.totalPrice = Math.round((x.itemPrice + (Number(x.shipping) || 0)) * 100) / 100;
    x.verified = true;
    if (recheck && !recheck(x)) { drop(x, "ebay-page-mismatch"); continue; }
    out.push(x);
  }
  return out;
}
