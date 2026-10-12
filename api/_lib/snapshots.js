// Saved listings ("snapshots"), PCTechSniper-style: a scheduled GitHub Action
// (scripts/build-snapshots.mjs) refreshes listings in the background and
// commits them to the repo's `data` branch. Pages read those files, so a
// visitor never triggers a paid search and every page loads instantly.
const OWNER = process.env.VERCEL_GIT_REPO_OWNER || "schoolkovak";
const SLUG = process.env.VERCEL_GIT_REPO_SLUG || "FlipScout1";
export const SNAPSHOT_BASE = (process.env.SNAPSHOT_BASE_URL || `https://raw.githubusercontent.com/${OWNER}/${SLUG}/data`).replace(/\/$/, "");

const cache = new Map(); // path -> { at, data }
const TTL = 120 * 1000;

export const modelSlug = name => String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const seriesPath = (groupId, seriesId) => `series/${groupId}__${seriesId}.json`;
export const modelPath = name => `models/${modelSlug(name)}.json`;

export async function readSnapshot(path, { fetchImpl = fetch, timeoutMs = 3500 } = {}) {
  if (process.env.SNAPSHOTS_OFF === "1") return null;
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  let data = null;
  try {
    const r = await fetchImpl(SNAPSHOT_BASE + "/" + path, { signal: AbortSignal.timeout(timeoutMs) });
    if (r.ok) data = await r.json();
  } catch { data = null; }
  cache.set(path, { at: Date.now(), data });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return data;
}

export const ageHours = iso => iso ? (Date.now() - Date.parse(iso)) / 3600000 : Infinity;
export function clearSnapshotCache() { cache.clear(); }
