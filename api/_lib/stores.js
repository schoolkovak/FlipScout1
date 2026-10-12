// Which merchants FlipScout trusts, and how to build a working link when a
// provider returns a listing without one.

// Reputable US retailers / marketplaces seen in Google Shopping results.
// Anything else (unknown web shops, foreign drop-shippers) is dropped: those
// are where the "brand new RX 5700 XT for $54" listings come from.
const TRUSTED_OTHER = [
  "target", "costco", "sam s club", "samsclub", "antonline", "central computer", "centralcomputer",
  "office depot", "officedepot", "staples", "gamestop", "dell", "hp com", "lenovo", "nvidia",
  "amd com", "asus", "msi", "corsair", "zotac", "pny", "evga", "gigabyte", "crucial", "western digital",
  "westerndigital", "seagate", "samsung", "kingston", "teamgroup", "g skill", "gskill", "noctua", "nzxt",
  "lian li", "fractal", "be quiet", "thermaltake", "cooler master", "arctic", "back market", "backmarket",
  "swappa", "jawa", "provantage", "cdw", "zones", "insight", "tigerdirect", "abt", "bjs", "kohls",
  "quill", "sweetwater", "monoprice", "visiontek", "sapphire", "xfx", "powercolor", "asrock", "intel",
  "logitech", "razer", "steelseries", "hyperx", "acer", "lg", "alienware", "secretlab", "best buy",
  "micro center", "newegg", "walmart", "amazon", "ebay", "mercari", "aliexpress", "adorama", "b h"
];

function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function isTrustedMerchant(seller, url, marketplace) {
  if (marketplace && marketplace !== "other") return true;
  const s = " " + norm(seller) + " ";
  let host = "";
  try { host = new URL(url).hostname.toLowerCase(); } catch {}
  if (host && !/(^|\.)google\./.test(host)) {
    // Non-US country-code domains are almost always drop-shippers or scams.
    if (/\.(eu|uk|de|fr|es|it|nl|pl|ru|cn|in|br|mx|au|nz|co\.uk|ca)$/.test(host)) return false;
    const h = " " + norm(host.replace(/^www\./, "")) + " ";
    if (TRUSTED_OTHER.some(t => h.includes(" " + t + " ") || h.includes(" " + t.replace(/ /g, "") + " "))) return true;
  }
  return TRUSTED_OTHER.some(t => s.includes(" " + t + " "));
}

// Google wraps many shopping links in redirects; unwrap to the store page.
function unwrapGoogle(u) {
  if (!/(^|\.)google\./.test(u.hostname)) return u;
  const target = u.searchParams.get("url") || u.searchParams.get("q") || u.searchParams.get("adurl");
  try { return target ? new URL(target) : u; } catch { return u; }
}

// Only real listings: returns the direct item/product page on the store, or
// null. Search-result pages and Google Shopping pages are not listings.
export function listingLink(url) {
  let parsed = null;
  try { parsed = unwrapGoogle(new URL(url)); } catch {}
  if (!parsed || !["http:", "https:"].includes(parsed.protocol)) return { url: null, linkType: "none" };
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  if (/(^|\.)google\./.test(host)) return { url: null, linkType: "none" };
  const isSearch = /\/(sch|search|s|w)(\/|$)|searchpage|search_results|\/pl$|\/l\/?$/.test(path) || /[?&](k|_nkw|st|keyword|ntt|searchinfo|d)=/.test(parsed.search) && !/\/(dp|itm|ip|p|item|site|product)\//.test(path);
  if (isSearch) return { url: null, linkType: "none" };
  return { url: parsed.href, linkType: "listing" };
}
