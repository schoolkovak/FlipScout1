# Overnight changes (Oct 12, 2026)

Restore point: branch `tomato` (commit 56d201c). Say "tomato" to return the site to it.

- Removed Google Shopping from the site UI: no "Google" in buttons, labels, source names or coverage notes. It runs only in the background to find which stores carry a part; every listing shown links to a real store item page.

## eBay live check + 1660 search
- Every eBay link found through Google is opened server-side before it is shown. Sold, ended, removed ("We looked everywhere"), for-parts and auction-only listings are hidden, and the price shown is the live page price. Pages that can't be checked are hidden.
- Mercari pages are hidden: they can't be checked live and are usually already sold.
- When a Google Shopping offer is matched to a store page, the page must have about the same price (within 20%).
- Check one eBay link yourself: `/api/debug/providers?ebay=https://www.ebay.com/itm/<id>`.
- New series: GTX 16 (1660 / Super / Ti, 1650, 1630), GTX 10, RX 5000/500, RTX 3050 6GB, RTX 3060 8GB. Searches like "1660 ti" or "5700xt" open the right model.

## Saved listings (PCTechSniper-style)
- A GitHub Action (`.github/workflows/snapshots.yml`, every 3 hours) runs `scripts/build-snapshots.mjs`. It asks the live site for fresh listings (`/api/deals/search?...&live=1`), saves them to the `data` branch, and pages read those saved files. A visitor never triggers a paid search.
- Paid credits: at most `SNAPSHOT_DAILY_CREDITS` per day (repo variable, default 60), flipper-favorite models first, then the oldest. Store-page matches are saved in `links.json` and reused for free.
- eBay and Best Buy official APIs (free) refresh every model on every run once their keys are in Vercel (`EBAY_CLIENT_ID`/`EBAY_CLIENT_SECRET`, `BESTBUY_API_KEY`).
- Models that haven't been saved yet show "QUEUED" with a "Search it now" button (one light search, cached 12 h).
- Browse and model pages keep your last results on screen across visits and refresh quietly in the background.
- eBay items found through Google are no longer shown: eBay blocks server checks (HTTP 403), so their status and price can't be confirmed. eBay listings come only from the official API.

## Flipper Deals
- New "Flipper Deals" tab: DDR4 8GB sticks (3000MHz+, under $65 per 2×8GB), 500GB NVMe, cases ≤ $52, PSUs (550/650 first, Bronze/Gold first), Ryzen and GPU "appeal per $100".
- Built only from saved listings, so it costs no credits. New catalog entries feed it: 8GB DDR4 3200, 16GB DDR4 3600, Case group (ATX mid tower, Micro ATX, Mini ITX).
- Intel 10th / 11th Gen series (i7-11700K, i5-11600K, i5-11400F, i7-10700K, i7-10700, i5-10400F).
- Matcher test corpus: +23 cases (AM4 CPUs, PSUs, 500GB SSDs, DDR4). Fixed: "PSU extension cable kit for 650W power supply" was shown as a PSU.
- Phones: the Browse sidebar folds into a "Series, models & filters" drawer so price cards come first; fixed browse content overflowing the screen width on phones.
- Friendlier messages on model pages (credits used up, service slow, nothing matching) instead of raw provider errors.
- Background refresh now runs hourly (GitHub was skipping the 3-hourly schedule); it still only spends credits on stale models within the daily cap, and skips publishing when nothing changed.
- The `data` branch now tells Vercel not to deploy it (each data update was creating a failed Vercel deployment).
- Model pages show the lowest-price history from saved updates (no extra searches).
- Deal Hunt: targets matching a model saved in the last 24 h are answered from saved listings (0 credits); live targets get a 45 s budget each and a slow one returns a message instead of breaking the whole hunt.
- Note: GitHub has not fired the scheduled listing refresh yet (workflow is active; manual runs work). If it still hasn't by tomorrow, run "Refresh listings" from the Actions tab or see the summary for options.

## Keys added (2026-10-13)
- eBay Browse API keys and a new Serper key were added in Vercel; this commit redeploys production so they take effect.
- eBay Browse API connected (keyset exempted from account-deletion notifications). First full refresh: all 199 models have live eBay Buy It Now listings at 0 Serper credits; Flipper Deals sections all populated.
- eBay item links are stored without search-tracking parameters so one listing found by several searches is shown once.
- Shipping: eBay searches now use delivery ZIP 32832 (override with env EBAY_SHIP_TO_ZIP) so eBay returns calculated shipping; shipping that's still unknown is estimated by part type (GPU ~$15, CPU ~$8, RAM/SSD ~$6, PSU ~$15, case ~$25…) and shown as "~$15 ship (est.)" instead of being treated as free. Big retailers still ship free over $35.
- Tax defaults to Florida (changeable in the Tax picker).
- Buy It Now only: eBay auctions are skipped, including auctions that also offer Buy It Now.
- Refresh workflow has a "force_free" option to re-check every model on the free APIs immediately.
- 500GB NVMe now also listed under "NVMe SSD" and 500GB SATA under "SATA SSD / HDD"; searching "500gb nvme" / "500gb sata" opens the right model.
- eBay listings now show the seller's own photo (no photo → no image, never a stock image).
- GPU filter: laptops (Razer Blade, ROG Strix SCAR, MSI Raider…), whole PCs (system RAM / SSD sizes / laptop CPUs / screen specs) and bare PCBs ("PCB", "no cooler") are rejected.
- Out-of-stock/sold check: opening a model page (or a Deal Hunt saved target) asks eBay, in one call, whether the 20 cheapest saved listings are still for sale; sold/ended/out-of-stock ones are hidden and live prices + shipping are used.
- eBay listings are re-checked every ~2 hours (was 2.5).
- Flipper Deals now only lists real deals: each listing is compared with that model's current used-market price (median of its saved listings) and must be ≥10% under it; the % and market price are shown.
  - GPUs: ranked by buyer appeal² ÷ price (newer, popular cards like the RTX 5060 rank above older cheaper cards; very expensive cards can't justify themselves).
  - Ryzen CPUs: never above $65; ranked by appeal per dollar.
  - Cases: RGB required, Micro-ATX or larger, no open-air / test bench / Mini-ITX. Added "RGB ATX mid tower" and "RGB Micro ATX" case models.
  - DDR4: no ECC/server RAM; NVMe: no SATA M.2 drives.
- Matcher: GPU heatsinks/fans/parts ("For ASUS TUF RX 6700 XT … Heatsink") and laptop RAM by part number (Samsung M471…, SK hynix …GS, Crucial CT…SF…) are rejected.
- Duplicates: the same store + title + price is shown once (sellers listing several identical units), and saved eBay items are merged by item ID.
- The refresh re-checks all ~200 models in one run (6 at a time) and applies the shipping rules to older saved store listings too.
- eBay: US-located sellers only and USD prices only (foreign listings showed converted prices without import charges, e.g. a CA$101.99 RX 580 shown as $51). GPU fan sets "for" a card are rejected.
- PSUs: desktop units only. Rejects chargers, office/OEM pulls (Dell/HP/Lenovo…), server/redundant units, "replacement PC power supply" and peak-rated "650W-MAX" boxes; needs a known PSU brand or an 80 Plus rating, and 700W+ needs an 80 Plus rating (White or better).
- Browse sidebar: a "New / Used" box is always shown under "Show" (Only Used is disabled, with a note, on new-only part types).
- eBay searches are limited to eBay's own category for the part (Graphics Cards, CPUs, Memory, Motherboards, Power Supplies, SSDs, Cases, Monitors), so accessories, laptops and whole PCs mostly never come back; if a category returns nothing the search retries without it.
- GPU filter also rejects NVLink/SLI bridges, risers, sag brackets, eGPU boxes ("Gaming Box", external graphics) and cable/adapter listings without a VRAM spec.
- Case pages: filter rows for Size (ATX / Micro ATX / Mini ITX), Lighting (ARGB / RGB / No RGB) and Color (White / Black), read from titles. Case models are now broad searches (ATX mid tower, Micro ATX, Mini ITX, RGB, ARGB, White), and a model only keeps cases matching its size/lighting/color.
- Monitor pages: filter rows for Size, Resolution, Panel (IPS/VA/OLED/TN) and Refresh rate; added 24", 27", 1440p and 144Hz gaming monitor models.
- Deal alerts: after each refresh, Flipper-type listings ≥15% under their model's used-market price are pushed to the phone via the free ntfy app (topic in snapshots.yml, overridable with secret NTFY_TOPIC). Each alert: price incl. shipping, used market value, % under, estimated profit (market − price), and a tap-to-open link. Each deal is sent once; max 6 per run. No API credits.
- Browse sidebar: "Sort cards" renamed "Sort models". The builder re-checks kept older listings against today's filters.
- Newegg listings (free): the builder reads Newegg's search page for each model about every 6 h (≤45 models/run, 1.5 s apart). New, open-box and refurbished stock goes through the same filters as every store; out-of-stock, overseas, combo and bundle items are skipped. Links are Newegg's own product links. Each model keeps up to 40 non-eBay listings beyond its 200 cheapest, so new store stock isn't crowded out by used eBay listings.
- Newegg combo deals: a new Flipper section from combos.json (refreshed ~6 h): bundles with a real combo discount that include a flip part, showing the parts, price bought separately, savings, free gift and total after FL tax.
- Alerts: each eBay listing is re-checked live with eBay right before sending (sold-out, ended, zero quantity or price went up → not sent). No alerts for anything above its model's launch MSRP. Quiet hours 3–8am Eastern; deals then go out at 8am. Threshold now ≥10% under used market (same as Flipper Deals), up to 10 per run.
- Box-only listings removed: titles ending in "Box" without "with/in/open/no" (e.g. "RTX 3070 FTW3 Ultra … PCIe 4.0 Box"), "Box for …", "just the box", "box and contents shown". eBay's live check also drops listings whose description says the sale is for the box ("This auction is for the box and the contents shown in the picture").
- Fix: eBay's bulk getItems call returns 403 for this keyset, so the "still for sale?" check had never actually run. It now uses one getItem / getItemByLegacyId call per listing (15-min cache; 8 cheapest per model page, 20 per alert batch). The builder also live-checks the top 10 eBay listings of every Flipper section each run and removes sold-out / ended / box-only ones from the saved data.
- Cases: RGB case-fan packs ("120mm PC Computer Case Fans RGB") no longer count as cases. Combos: every paid item must be a flip part (no thermal paste / brackets / workstation cards), saving at least $10.
- Amazon listings (free): the builder reads Amazon's search page (allowed by Amazon's robots.txt) for ~25 models per run, 4 s apart, so every model is refreshed about every 8 h; it stops at the first captcha. Real amazon.com/dp/ASIN links, Amazon's current price (not the strike-through list price), stated delivery cost, product photo; results without a price are skipped; "Renewed" is marked refurbished. Same filters as every store.
- Mercari (Cloudflare bot wall, 403) and AliExpress (refuses connections from GitHub's servers) can't be read for free; AliExpress needs its free affiliate API key, Mercari stays hidden.
- Alerts: an MSRP under 25% of the used-market price is treated as a data error and ignored (it can't block a real deal).
- Fix: GitHub's hourly cron for "Refresh listings" had fired only twice ever (every other refresh was started by hand), so overnight nothing refreshed and no alerts went out. Each refresh run now starts the next one ~45 min after it finishes (job "next", skipped if another refresh is already queued or running); the cron stays as a backup.
- Data audit (overnight 1): 18,238 saved listings (eBay 16,627 · Newegg 1,499 · Amazon 76 after its first pass · a few Walmart/Micro Center). Re-running today's filters over everything flags only 3 (two case-fan packs and a case shelf under case models), which the next refresh drops.
- Overnight 2: refresh chain confirmed (runs 07:33, 08:23, 09:13 UTC; one sold-out Flipper listing caught and removed). Sampled one model per part type (GPU, CPU, RAM, SSD, motherboard, PSU, cooling, case, monitor): no missing shipping info, all links direct, all with photos, ~no duplicates. Fixed the misfits found: "SATA … NOT NVMe" drives under NVMe models, CAMM/LPCAMM laptop memory under desktop RAM, rackmount cases / test benches / open-air frames under case models, and portable USB-C monitors under gaming monitors.
- eBay call budget: free eBay refresh now every 2.5 h (was 1.9 h) — about 2,000 search calls/day plus ~30 live stock checks per hourly run and page views, comfortably under eBay's 5,000/day.
- Overnight 3: alerts were held 3–8am ET as intended. Before the 8am batch: alerts now need a used-market price built from ≥5 used listings (Flipper rows carry `usedComps`), and the cases section no longer alerts — its "market" mixed every case model, so any cheap new case looked ~50% under. Combos: SSD enclosures / adapters / docks no longer count as flip parts. 8am queue: 45 deals (GPUs, Ryzen, 500GB NVMe, DDR4), each live-checked on eBay before sending, max 10 per run.
- AliExpress listings (free): www.aliexpress.com search pages (US-warehouse filter) are read for each model about daily. Real item links, USD sale price, photo; each flagged "lowest option" (search shows a listing's cheapest variant) and never pushed as an alert. AliExpress shows a captcha after ~5 quick searches, so it is never rushed — no captcha solving or proxy tricks, just one search every few minutes.
- Amazon fix: Amazon started answering 503 to quick repeat searches, and a blocked page was being saved as "0 results", wiping saved Amazon listings. Blocked/empty pages now count as errors (saved listings kept), and Amazon moved to the same slow lane as AliExpress.
- Slow lane: the refresh chain's ~45-minute wait between runs now reads Amazon and AliExpress alternately (each about one search per 4 minutes, ~10 models per store per hour), publishes, then starts the next refresh (still at least ~45 minutes apart).
- Browse: the cards' cheapest eBay listings are now live-checked too (sold out / ended / box-only dropped) — before, only model pages were. New "Store" box beside New / Used (All, eBay, Amazon, Newegg, AliExpress, Other) with listing counts for the subsection, e.g. "Amazon (13)"; cards keep the cheapest 3 per store so each store filter has something to show.
- Analytics page (nav, after Watchlist): tiles (listings tracked, models, great deals now, alerts sent), listings by store and by part type, price-history chart per popular model (typical used / lowest new vs launch MSRP, with hover crosshair and a table view), biggest price moves (24 h / 7 d), best flip spreads (cheapest non-bait used listing vs typical used price), and top deals. The builder saves analytics.json after each refresh (/api/analytics reads it — no credits). History points now also record the used median so price moves aren't swung by one odd listing.
