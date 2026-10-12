import { FLIPPER_SECTIONS, flipperSection } from "../_lib/flipper.js";

// GET /api/flipper?section=ddr4 (or section=all): computed from saved
// listings only, so it never spends API credits.
export default async function handler(req, res) {
  const id = String(req.query?.section || "all");
  const ids = id === "all" ? Object.keys(FLIPPER_SECTIONS) : [id];
  if (!ids.every(x => FLIPPER_SECTIONS[x])) return res.status(400).json({ error: "Unknown section", sections: Object.keys(FLIPPER_SECTIONS) });
  try {
    const sections = await Promise.all(ids.map(x => flipperSection(x)));
    res.setHeader?.("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    res.status(200).json(id === "all" ? { sections } : sections[0]);
  } catch (error) {
    res.setHeader?.("Cache-Control", "no-store");
    res.status(200).json({ error: String(error?.message || error).slice(0, 200), sections: [] });
  }
}
