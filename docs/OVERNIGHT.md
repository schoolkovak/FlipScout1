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
