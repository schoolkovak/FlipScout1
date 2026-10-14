import { fetchAmazonSearch, amazonOffers } from "../../scripts/amazon.mjs";

// GET /api/stores/amazon?q=<part>: one Amazon search page, fetched from
// Vercel (Amazon blocks GitHub's runners), returned as raw offers for the
// background builder's slow lane. Fixed Amazon search URL only — not a proxy.
export default async function handler(req, res) {
  const q = String(req.query?.q || "").trim().slice(0, 100);
  if (!q) return res.status(400).json({ error: "q required" });
  try {
    const offers = amazonOffers(await fetchAmazonSearch(q, { timeoutMs: 15000 }));
    res.setHeader?.("Cache-Control", "public, s-maxage=1800");
    res.status(200).json({ ok: true, offers });
  } catch (error) {
    res.setHeader?.("Cache-Control", "no-store");
    res.status(200).json({ ok: false, error: String(error?.message || error).slice(0, 160) });
  }
}
