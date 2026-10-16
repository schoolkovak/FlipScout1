import { fetchAmazonSearch, amazonOffers } from "../../scripts/amazon.mjs";
import { fetchNeweggSearch, neweggOffers, neweggCombos } from "../../scripts/newegg.mjs";

// GET /api/stores/amazon?q=… and /api/stores/newegg?q=…[&combos=1]: one store
// search page, fetched from Vercel (both stores block GitHub's runners),
// returned as raw offers for the background builder. Fixed store search URLs
// only — not a proxy.
export default async function handler(req, res) {
  const store = String(req.query?.store || "");
  const q = String(req.query?.q || "").trim().slice(0, 100);
  if (!q || !["amazon", "newegg"].includes(store)) return res.status(400).json({ error: "store (amazon|newegg) and q required" });
  try {
    let body;
    if (store === "amazon") body = { ok: true, offers: amazonOffers(await fetchAmazonSearch(q, { timeoutMs: 15000 })) };
    else {
      const state = await fetchNeweggSearch(q, { timeoutMs: 15000 });
      body = { ok: true, offers: neweggOffers(state), combos: req.query?.combos === "1" ? neweggCombos(state) : undefined };
    }
    res.setHeader?.("Cache-Control", "public, s-maxage=1800");
    res.status(200).json(body);
  } catch (error) {
    res.setHeader?.("Cache-Control", "no-store");
    res.status(200).json({ ok: false, error: String(error?.message || error).slice(0, 160) });
  }
}
