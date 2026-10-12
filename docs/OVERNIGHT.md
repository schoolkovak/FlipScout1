# Overnight changes (Oct 12, 2026)

Restore point: branch `tomato` (commit 56d201c). Say "tomato" to return the site to it.

- Removed Google Shopping from the site UI: no "Google" in buttons, labels, source names or coverage notes. It runs only in the background to find which stores carry a part; every listing shown links to a real store item page.

## eBay live check + 1660 search
- Every eBay link found through Google is opened server-side before it is shown. Sold, ended, removed ("We looked everywhere"), for-parts and auction-only listings are hidden, and the price shown is the live page price. Pages that can't be checked are hidden.
- Mercari pages are hidden: they can't be checked live and are usually already sold.
- When a Google Shopping offer is matched to a store page, the page must have about the same price (within 20%).
- Check one eBay link yourself: `/api/debug/providers?ebay=https://www.ebay.com/itm/<id>`.
- New series: GTX 16 (1660 / Super / Ti, 1650, 1630), GTX 10, RX 5000/500, RTX 3050 6GB, RTX 3060 8GB. Searches like "1660 ti" or "5700xt" open the right model.
