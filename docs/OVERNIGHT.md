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
