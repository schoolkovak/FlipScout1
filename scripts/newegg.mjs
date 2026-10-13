// Newegg listings for the background builder (scripts/build-snapshots.mjs).
//
// Newegg has no public search API, but its search page carries the results as
// JSON (window.__initialState__) and robots.txt allows it. The builder runs
// on GitHub Actions, reads one page per model at most every few hours, and
// saves the result — visitors never trigger a Newegg request and nothing
// costs credits.
import { qualifyOffers } from "../api/_lib/market.js";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
export const NEWEGG_PROVIDER = "Newegg (store page)";

export function neweggState(html) {
  const m = String(html || "").match(/window\.__initialState__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

// Product links exactly as Newegg's own search page writes them:
//   Newegg-sold "14-932-658"   → /<slug>/p/N82E16814932658
//   catalog item "2AM-009W-00096" → /<slug>/p/2AM-009W-00096
//   marketplace offer "9SI…" of parent P → /<slug>/p/<P>?Item=9SI…
function neweggPathId(id) {
  id = String(id || "").trim();
  if (/^\d{2}-\d{3}-\d{3,4}$/.test(id)) return "N82E168" + id.replace(/-/g, "");
  return /^[A-Z0-9-]{6,24}$/i.test(id) ? id : null;
}
export function neweggItemUrl(item, parent, slug) {
  const base = "https://www.newegg.com/" + (slug ? encodeURIComponent(slug) + "/" : "") + "p/";
  const own = neweggPathId(item);
  if (!own) return null;
  const par = /^9SI/i.test(own) ? neweggPathId(parent) : null;
  return par ? base + par + "?Item=" + own : base + own;
}

function neweggImage(c) {
  const name = c.Image?.ItemCellImageName || c.Image?.Normal?.ImageName || c.NewImage?.ImageName;
  if (!name) return null;
  const pattern = (c.Image?.ImagePathPattern || []).find(p => p.Size === 180)?.PathPattern || "https://c1.neweggimages.com/NeweggImage/ProductImageCompressAll200/{ImageName}";
  return pattern.replace("{ImageName}", name).replace("{Size}", "200");
}

// Raw offers (same shape the site's provider adapters return) from one
// Newegg search page. Out-of-stock items, combos, bundles and items shipped
// from outside the US are skipped.
export function neweggOffers(state) {
  const out = [];
  for (const p of state?.Products || []) {
    const c = p.ItemCell;
    if (!c || p.IsCombo || p.ComboCell || p.IsGroupItem) continue;
    if (!c.Instock || c.Active === "0") continue;
    if (c.ShipFromCountryName && c.ShipFromCountryName !== "United States") continue;
    const price = Number(c.FinalPrice);
    const url = neweggItemUrl(c.Item, c.ParentItem, c.Description?.UrlKeywords);
    if (!(price > 0) || !url) continue;
    const f = c.Feature || {};
    const condition = f.IsRefurbished ? "refurbished" : f.IsOpenBoxed ? "open box" : f.IsNew === false ? "used" : "new";
    // Newegg stores 0.01 as a placeholder; only a real dollar amount counts
    // as stated shipping (otherwise the site's shipping rules apply).
    const ship = Number(c.ShippingCharge);
    const shippingKnown = Number.isFinite(ship) && ship >= 0.5;
    out.push({
      provider: NEWEGG_PROVIDER, providerItemId: c.Item, marketplace: "newegg",
      seller: c.Seller?.SellerName || "Newegg",
      title: c.Description?.Title || "", url,
      itemPrice: price, shipping: shippingKnown ? ship : 0, shippingKnown,
      totalPrice: price + (shippingKnown ? ship : 0),
      structuredCondition: condition, defaultCondition: "new",
      rating: Number(c.Review?.RatingOneDecimal || 0) || null,
      reviews: Number(c.Review?.HumanRating || 0) || null,
      image: neweggImage(c),
      freeGift: !!c.AnyFreeGift
    });
  }
  return out;
}

export async function fetchNeweggSearch(query, { fetchImpl = fetch, timeoutMs = 20000 } = {}) {
  const r = await fetchImpl("https://www.newegg.com/p/pl?d=" + encodeURIComponent(query), {
    headers: { "User-Agent": UA, "Accept": "text/html", "Accept-Language": "en-US,en;q=0.9" },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!r.ok) throw new Error("Newegg HTTP " + r.status);
  const state = neweggState(await r.text());
  if (!state) throw new Error("Newegg page had no results data");
  return state;
}

// Qualified listings for one catalog model, filtered exactly like every
// other store's listings (wrong model, accessories, laptops, bundles...).
export async function neweggListings(item, opts = {}) {
  const state = await fetchNeweggSearch(item.query, opts);
  const raw = neweggOffers(state);
  const { items } = qualifyOffers(raw, { query: item.query, category: item.category, msrp: item.msrp || 0, condition: "any" });
  return items;
}

// ---- Combo deals -----------------------------------------------------------
// Newegg combos bundle 2+ items at a discount (sometimes with a free gift).
// Bought separately the items cost the sum of their own prices; the combo
// costs that minus ComboDiscountAmount. Only combos with a real discount and
// at least one PC part a flipper buys are kept.
export const COMBO_QUERIES = ["cpu motherboard combo", "amd ryzen motherboard combo", "power supply combo", "cpu combo", "graphics card combo", "case power supply combo", "memory combo", "ssd combo"];
const PART_KIND = [
  // Thermal paste, coolers and brackets mention "processor"/"CPU" but aren't one.
  ["other", /\b(?:thermal (?:paste|compound|pad)|paste|compound|spreader|contact frame|sealing frame|bracket|cable|fan|cooler|aio|heatsink|workstation|enclosure|adapter|dock|docking|caddy|reader)\b/i],
  ["cpu", /\b(?:ryzen \d|core i[3579]|core ultra \d)\b.*\b(?:processor|cpu)\b|\bprocessor\b.*\b(?:ryzen|core)\b/i],
  ["gpu", /\b(?:geforce|radeon rx|rtx \d{4}|graphics card|video card|arc [ab]\d{3})\b/i],
  ["motherboard", /\bmotherboard\b|\b[abxzh]\d{3}[a-z]?\b.*\b(?:atx|am[45]|lga ?\d{4})\b/i],
  ["psu", /\bpower suppl(?:y|ies)\b|\bpsu\b/i],
  ["ram", /\bddr[45]\b.*\b(?:memory|ram|dimm)\b|\bmemory kit\b/i],
  ["ssd", /\b(?:ssd|nvme)\b/i],
  ["case", /\b(?:pc case|computer case|mid[- ]tower|full tower)\b/i]
];
export function comboPartKind(title) {
  const t = String(title || "");
  return PART_KIND.find(([, re]) => re.test(t))?.[0] || "other";
}

export function neweggCombos(state) {
  const out = [];
  for (const p of state?.Products || []) {
    const c = p.ComboCell;
    if (!c || !Array.isArray(c.Items) || c.Items.length < 2 || !c.StockForCombo) continue;
    const items = c.Items.map(it => {
      const ii = it.ItemInfo || {};
      const count = Math.max(1, Number(it.Count) || 1);
      const gift = !!it.IsGift || it.ZeroPriceMark === "1";
      const price = Number(ii.FinalPrice) || 0;
      return {
        item: it.ItemNumber, title: ii.Description?.Title || "", kind: comboPartKind(ii.Description?.Title),
        price, count, gift, inStock: ii.Instock !== false,
        image: ii.Image?.ItemCellImageName ? "https://c1.neweggimages.com/NeweggImage/ProductImageCompressAll200/" + ii.Image.ItemCellImageName : null,
        url: neweggItemUrl(it.ItemNumber, ii.ParentItem, ii.Description?.UrlKeywords)
      };
    });
    if (items.some(x => !x.inStock || !(x.price > 0 || x.gift))) continue;
    const separate = Math.round(items.reduce((s, x) => s + x.price * x.count, 0) * 100) / 100;
    const discount = Number(c.ComboDiscountAmount) || 0;
    const giftValue = Math.round(items.filter(x => x.gift).reduce((s, x) => s + x.price * x.count, 0) * 100) / 100;
    const comboPrice = Math.round((separate - discount - giftValue) * 100) / 100;
    const savings = Math.round((separate - comboPrice) * 100) / 100;
    if (!(comboPrice > 0) || savings < 5) continue;
    const ship = Number(c.ShippingCharge);
    out.push({
      id: "newegg-combo:" + c.ComboID, comboId: String(c.ComboID),
      url: "https://www.newegg.com/Product/ComboDealDetails?ItemList=Combo." + c.ComboID,
      title: c.SolutionDescription || items.map(x => x.title).join(" + "),
      image: c.SolutionImage ? "https://c1.neweggimages.com/productimage/nb300/" + c.SolutionImage : items[0].image,
      items, kinds: [...new Set(items.filter(x => !x.gift).map(x => x.kind))],
      separate, comboPrice, savings, savingsPct: Math.round(savings / separate * 100),
      freeGift: items.some(x => x.gift) || c.GiftItemMark === "1",
      shipping: Number.isFinite(ship) && ship >= 0.5 ? ship : 0,
      promo: c.PromotionText || null
    });
  }
  return out;
}

// All current combos from a few Newegg searches (one page each, politely).
export async function fetchNeweggCombos({ fetchImpl = fetch, gapMs = 1500 } = {}) {
  const seen = new Map();
  for (const q of COMBO_QUERIES) {
    try {
      const state = await fetchNeweggSearch(q, { fetchImpl });
      for (const c of neweggCombos(state)) if (!seen.has(c.comboId)) seen.set(c.comboId, c);
    } catch (e) { console.log("newegg combos " + q + ": " + e.message); }
    if (gapMs) await new Promise(r => setTimeout(r, gapMs));
  }
  return [...seen.values()];
}
