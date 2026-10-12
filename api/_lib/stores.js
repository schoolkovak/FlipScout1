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

const SEARCH_URLS = {
  ebay: q => "https://www.ebay.com/sch/i.html?LH_BIN=1&_nkw=" + q,
  amazon: q => "https://www.amazon.com/s?k=" + q,
  bestbuy: q => "https://www.bestbuy.com/site/searchpage.jsp?st=" + q,
  walmart: q => "https://www.walmart.com/search?q=" + q,
  newegg: q => "https://www.newegg.com/p/pl?d=" + q,
  mercari: q => "https://www.mercari.com/search/?keyword=" + q,
  aliexpress: q => "https://www.aliexpress.us/w/wholesale-" + q + ".html",
  bhphoto: q => "https://www.bhphotovideo.com/c/search?q=" + q,
  adorama: q => "https://www.adorama.com/l/?searchinfo=" + q,
  microcenter: q => "https://www.microcenter.com/search/search_results.aspx?Ntt=" + q
};

// A direct listing link when we have one; otherwise a search for the exact
// title on that store (flagged so the UI says "Find on eBay", not "View").
export function listingLink(url, marketplace, title) {
  let parsed = null;
  try { parsed = new URL(url); } catch {}
  if (parsed && ["http:", "https:"].includes(parsed.protocol) && !/(^|\.)google\./.test(parsed.hostname)) {
    return { url: parsed.href, linkType: "listing" };
  }
  const q = encodeURIComponent(String(title || "").replace(/\s+/g, " ").trim().slice(0, 120));
  if (!q) return { url: null, linkType: "none" };
  const build = SEARCH_URLS[marketplace];
  if (build) return { url: build(q), linkType: "store-search" };
  if (parsed && /(^|\.)google\./.test(parsed.hostname)) return { url: parsed.href, linkType: "google" };
  return { url: "https://www.google.com/search?tbm=shop&q=" + q, linkType: "google" };
}
