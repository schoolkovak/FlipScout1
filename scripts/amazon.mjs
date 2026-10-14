// Amazon listings for the background builder (scripts/build-snapshots.mjs).
//
// Amazon's search page (allowed by its robots.txt) is read politely: a few
// models per run, seconds apart, from GitHub Actions — never by visitors and
// never with API credits. Each result is a real product page (amazon.com/dp/
// ASIN) with Amazon's own current price and photo; results without a price
// (unavailable / only "other buying options") are skipped.
import { qualifyOffers } from "../api/_lib/market.js";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
export const AMAZON_PROVIDER = "Amazon (store page)";

const decode = s => String(s || "")
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ").trim();

// Split the page into search-result blocks and read each one.
export function amazonOffers(html) {
  const out = [];
  const page = String(html || "");
  const starts = [...page.matchAll(/<div[^>]+data-component-type="s-search-result"[^>]*>/g)];
  for (let i = 0; i < starts.length; i++) {
    const open = starts[i][0];
    const block = page.slice(starts[i].index, starts[i + 1]?.index ?? starts[i].index + 60000);
    const asin = open.match(/data-asin="([A-Z0-9]{10})"/)?.[1];
    if (!asin) continue;
    // Title: the product name inside the result's <h2>.
    const h2 = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1] || "";
    const title = decode(h2.replace(/<[^>]+>/g, " "));
    // Price: the first a-offscreen inside an a-price that isn't a strike-through list price.
    const priceM = block.match(/<span class="a-price"(?![^>]*a-text-price)[^>]*>\s*<span class="a-offscreen">\$([\d,]+\.\d{2})<\/span>/);
    const price = priceM ? Number(priceM[1].replace(/,/g, "")) : 0;
    if (!title || !(price > 0)) continue;
    const image = block.match(/<img[^>]+class="s-image"[^>]+src="([^"]+)"/)?.[1] || block.match(/<img[^>]+src="([^"]+)"[^>]+class="s-image"/)?.[1] || null;
    const sponsored = /\bSponsored\b/.test(block.slice(0, 4000)) && /puis-sponsored|s-sponsored|Sponsored Ad/.test(block);
    const renewed = /\b(?:renewed|refurbished)\b/i.test(title);
    // "FREE delivery" stated → free; otherwise Amazon's usual rule applies later.
    const freeShip = /FREE delivery|Free Shipping/i.test(block);
    const shipM = block.match(/\$([\d,]+\.\d{2})\s+delivery/i);
    const shippingKnown = freeShip || !!shipM;
    const shipping = shipM && !freeShip ? Number(shipM[1].replace(/,/g, "")) : 0;
    out.push({
      provider: AMAZON_PROVIDER, providerItemId: asin, marketplace: "amazon", seller: "Amazon",
      title, url: "https://www.amazon.com/dp/" + asin,
      itemPrice: price, shipping, shippingKnown, totalPrice: price + shipping,
      structuredCondition: renewed ? "renewed" : "", defaultCondition: "new",
      image: image && /^https:\/\/m\.media-amazon\.com\//.test(image) ? image : null,
      sponsored
    });
  }
  return out;
}

export async function fetchAmazonSearch(query, { fetchImpl = fetch, timeoutMs = 20000 } = {}) {
  const r = await fetchImpl("https://www.amazon.com/s?k=" + encodeURIComponent(query), {
    headers: { "User-Agent": UA, "Accept": "text/html", "Accept-Language": "en-US,en;q=0.9" },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!r.ok) throw new Error("Amazon HTTP " + r.status);
  const html = await r.text();
  if (/validateCaptcha|api-services-support@amazon\.com/.test(html)) throw new Error("Amazon asked for a captcha");
  // A results page without any result blocks is Amazon's soft block ("Sorry!
  // Something went wrong"), not "no listings": keep the saved ones.
  if (!/data-component-type="s-search-result"/.test(html)) throw new Error("Amazon returned no results page (blocked)");
  return html;
}

export async function amazonListings(item, opts = {}) {
  const raw = amazonOffers(await fetchAmazonSearch(item.query, opts));
  const { items } = qualifyOffers(raw, { query: item.query, category: item.category, msrp: item.msrp || 0, condition: "any" });
  return items;
}
