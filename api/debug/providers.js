// Provider check: one small Serper Shopping and one Serper web search, and a
// summary of what came back (status, fields, link types, prices). Open
// /api/debug/providers in a browser to see why results are thin. Uses ~2
// Serper credits; never returns API keys.

function shape(results, priceKeys) {
  return results.slice(0, 6).map(x => {
    let host = null, path = null;
    try { const u = new URL(x.link); host = u.hostname; path = u.pathname.slice(0, 40); } catch {}
    const prices = Object.fromEntries(priceKeys.map(k => [k, x[k] ?? null]).filter(([, v]) => v !== null));
    return { title: String(x.title || "").slice(0, 80), source: x.source || null, linkHost: host, linkPath: path, ...prices, snippet: x.snippet ? String(x.snippet).slice(0, 120) : undefined, fields: Object.keys(x) };
  });
}

async function call(path, body, key) {
  const started = Date.now();
  try {
    const r = await fetch("https://google.serper.dev/" + path, { method: "POST", headers: { "X-API-KEY": key, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(12000) });
    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}
    return { status: r.status, ms: Date.now() - started, error: r.ok ? null : String(data?.message || data?.error || text).slice(0, 200), data };
  } catch (error) {
    return { status: null, ms: Date.now() - started, error: String(error?.message || error) };
  }
}

export default async function handler(req, res) {
  const key = process.env.SERPER_API_KEY || "";
  if (!key) return res.status(200).json({ serperConfigured: false, message: "SERPER_API_KEY is not set on the server." });
  const q = String(req.query?.q || "RTX 4060").slice(0, 80);
  const [shopping, organic] = await Promise.all([
    call("shopping", { q, gl: "us", hl: "en", num: 10 }, key),
    call("search", { q: q + " ebay", gl: "us", hl: "en", num: 10 }, key)
  ]);
  const shop = shopping.data?.shopping || [];
  const org = organic.data?.organic || [];
  res.status(200).json({
    serperConfigured: true,
    query: q,
    credits: shopping.data?.credits ?? organic.data?.credits ?? null,
    shopping: {
      status: shopping.status, error: shopping.error, ms: shopping.ms, count: shop.length,
      directLinks: shop.filter(x => { try { return !/(^|\.)google\./.test(new URL(x.link).hostname); } catch { return false; } }).length,
      googleLinks: shop.filter(x => /google\./.test(x.link || "")).length,
      noLink: shop.filter(x => !x.link).length,
      sample: shape(shop, ["price", "delivery", "productId"])
    },
    webSearch: {
      status: organic.status, error: organic.error, ms: organic.ms, count: org.length,
      withPriceField: org.filter(x => x.price || x.priceRange || x.attributes).length,
      sample: shape(org, ["price", "priceRange", "attributes", "rating"])
    }
  });
}
