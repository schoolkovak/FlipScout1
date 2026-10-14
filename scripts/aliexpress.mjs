// AliExpress listings for the background builder (scripts/build-snapshots.mjs).
//
// www.aliexpress.com search pages carry their results as JSON ("itemList").
// The builder reads one page per model, filtered to items shipped from US
// warehouses (fast delivery, no import fees), a few models per run, seconds
// apart — never per visitor and never with API credits. Search results show a
// listing's lowest variant price, so each one is flagged as such and runs
// through the same filters (and launch-price / too-good-to-be-true floors)
// as every other store.
import { qualifyOffers } from "../api/_lib/market.js";

export const ALIEXPRESS_PROVIDER = "AliExpress (store page)";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9",
  "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Site": "none", "Sec-Fetch-Dest": "document", "Upgrade-Insecure-Requests": "1"
};

// The JSON array that follows "itemList":{"content": — cut out by bracket
// matching (it sits inside a larger script that isn't plain JSON).
export function aliexpressItems(html) {
  const page = String(html || "");
  const start = page.indexOf('"itemList":{"content":[');
  if (start < 0) return [];
  let i = page.indexOf("[", start), depth = 0, inStr = false, esc = false;
  const from = i;
  for (; i < page.length; i++) {
    const ch = page[i];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === "[") depth++;
    else if (ch === "]" && --depth === 0) break;
  }
  try { return JSON.parse(page.slice(from, i + 1)); } catch { return []; }
}

export function aliexpressOffers(items) {
  const out = [];
  for (const x of items || []) {
    const id = String(x?.productId || "");
    const title = String(x?.title?.displayTitle || "").trim();
    const sale = x?.prices?.salePrice;
    const price = Number(sale?.minPrice);
    if (!/^\d{10,20}$/.test(id) || !title || !(price > 0) || (sale?.currencyCode && sale.currencyCode !== "USD")) continue;
    if (x.productType && x.productType !== "natural") continue; // skip ads
    const img = x?.image?.imgUrl ? String(x.image.imgUrl).replace(/^\/\//, "https://") : null;
    out.push({
      provider: ALIEXPRESS_PROVIDER, providerItemId: id, marketplace: "aliexpress", seller: "AliExpress seller",
      title, url: "https://www.aliexpress.com/item/" + id + ".html",
      itemPrice: price, shipping: 0, shippingKnown: false, totalPrice: price,
      structuredCondition: "", defaultCondition: "new", priceIsRange: true,
      image: img && /^https:\/\/[\w.-]*(alicdn|aliexpress-media)\.com\//.test(img) ? img : null
    });
  }
  return out;
}

export async function fetchAliexpressSearch(query, { fetchImpl = fetch, timeoutMs = 25000 } = {}) {
  const slug = String(query).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const r = await fetchImpl("https://www.aliexpress.com/w/wholesale-" + slug + ".html?shipFromCountry=US", { headers: HEADERS, signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new Error("AliExpress HTTP " + r.status);
  const html = await r.text();
  if (/punish|x5sec|slide to verify/i.test(html.slice(0, 20000)) && !html.includes('"itemList"')) throw new Error("AliExpress asked for a captcha");
  return html;
}

export async function aliexpressListings(item, opts = {}) {
  const raw = aliexpressOffers(aliexpressItems(await fetchAliexpressSearch(item.query, opts)));
  const { items } = qualifyOffers(raw, { query: item.query, category: item.category, msrp: item.msrp || 0, condition: "any" });
  return items;
}
