import { FLIPPER_SECTIONS } from "../_lib/flipper.js";

// GET /api/flipper?section=ddr4 — cached at Vercel's edge for hours, so the
// Flipper Deals page costs credits at most a few times a day.
export default async function handler(req, res) {
  const id = String(req.query?.section || "");
  const section = FLIPPER_SECTIONS[id];
  if (!section) return res.status(400).json({ error: "Unknown section", sections: Object.keys(FLIPPER_SECTIONS) });
  if (!process.env.SERPER_API_KEY) return res.status(200).json({ id, title: section.title, listings: [], message: "No data provider configured." });
  try {
    const out = await section.run({});
    if (out.listings.length) res.setHeader("Cache-Control", "public, s-maxage=" + section.ttl + ", stale-while-revalidate=86400");
    else res.setHeader("Cache-Control", "public, s-maxage=600");
    res.status(200).json({ id, title: section.title, searchedAt: new Date().toISOString(), listings: out.listings, errors: out.errors.slice(0, 3) });
  } catch (error) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ id, title: section.title, listings: [], errors: [String(error?.message || error).slice(0, 200)] });
  }
}
