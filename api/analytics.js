import { readSnapshot } from "./_lib/snapshots.js";

// GET /api/analytics: the analytics summary the background builder saves
// after each refresh (analytics.json). Saved data only — no API credits.
export default async function handler(req, res) {
  const data = await readSnapshot("analytics.json");
  if (!data) {
    res.setHeader?.("Cache-Control", "no-store");
    return res.status(200).json({ available: false, message: "Analytics appear after the next background update." });
  }
  res.setHeader?.("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  res.status(200).json({ available: true, ...data });
}
