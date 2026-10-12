# FlipScout

FlipScout is a PC-flipping and hardware deal-analysis app built around live comparable listings, sales-backed evidence, part validation, and build-budget fit.

## What works now

- Complete-PC analyzer with CPU/GPU typo normalization
- Unknown/fake CPU or GPU detection: unrecognized parts receive no trusted valuation or normal Flip Score
- Compatibility checks for CPU socket, RAM generation, and PSU wattage
- Online likely resale estimate
- Local likely resale estimate from nearby eBay local-pickup comps when a ZIP is supplied
- Sales-backed eBay evidence using active listings that report prior units sold
- Full evidence links and reported sold counts
- Complete-PC comparable listings
- Component-level live market checks
- Parts Deal Scanner for GPUs, CPUs, SSD/NVMe, HDD, RAM, motherboards, PSUs, cases, coolers, fans, networking and complete PCs
- Outlier removal, title relevance filtering, capacity matching, and Ti/Super/XT/XTX/X3D variant checks
- Build-budget impact and Deal Score
- Sort by Best Deal, Lowest Total Price, Most Under Market, Best for Flip, or Best Fit for Budget — re-sorts loaded results instantly without a new search
- 10-minute server-side market cache to conserve free API credits
- Automatic GitHub CI checks and Vercel deployment

## Marketplace coverage

FlipScout only uses legitimate provider access. Credentials are read from environment variables (or keys the owner enters in the browser settings panel); none are stored in the code.

Every scan is a full multi-source scan (there is no separate "Deep Scan"):

| Source | What it covers | Needs |
|---|---|---|
| Google Shopping via Serper (main source) | New, used and refurbished queries per search; Amazon, Best Buy, Walmart, Newegg, eBay, AliExpress, Mercari, B&H, Adorama, Micro Center and other stores. Stores still missing get a store-targeted query. | `SERPER_API_KEY` |
| eBay, structured | Real eBay condition data, condition-filtered at the source (for-parts listings are never requested). Uses the official eBay Browse API if configured, otherwise SerpApi's eBay engine (250 free searches/month), otherwise SearchAPI. | `EBAY_CLIENT_ID`/`EBAY_CLIENT_SECRET`, or `SERPAPI_API_KEY`, or `SEARCHAPI_API_KEY` |
| Direct Amazon / Walmart / Best Buy search | Only for selected stores Google Shopping missed, and only while SearchAPI has credits (an exhausted key is skipped automatically). | `SEARCHAPI_API_KEY` (optional) |

Newegg, Mercari, AliExpress, B&H, Adorama and Micro Center have no public listing API and are reached through Google Shopping only.

Every search reports, per provider, how many listings came back, how many were kept, and why the rest were filtered (wrong model or VRAM, broken/for parts, accessory, laptop part, condition, duplicate). Open **Sources searched** under the results to see it.

Listings are kept when they are new, open box, refurbished/renewed or used, and rejected when they are for parts/not working, incomplete (box only, missing parts), an accessory, a laptop/mobile part, a prebuilt or combo, or a different model/variant/capacity.

### Credit use per search

- Serper: 3 shopping queries for "Any condition" (1 for a specific condition) plus up to 3 store-targeted queries — 2 credits each, so roughly 6–12 credits per part searched.
- eBay: 1 request per part (SerpApi or SearchAPI), or 1 free Browse API call.
- Responses are cached for 10 minutes. Sorting and filtering results never re-queries.

## Recommended free data setup

### 1. Serper — recommended first
Environment variable:

`SERPER_API_KEY`

Serper provides 2,500 free real-time Google search queries with no credit card. FlipScout uses its Shopping endpoint for broad current retail/component pricing.

Sign up: https://serper.dev/

### 2. SearchAPI — recommended second
Environment variable:

`SEARCHAPI_API_KEY`

SearchAPI provides 100 free requests with no credit card. FlipScout reserves these smaller credits for data that adds special value:

- Direct eBay search
- eBay listings with reported units sold
- Nearby eBay local-pickup comps by ZIP/radius
- Direct Walmart search during Deep Scan
- Direct Best Buy and Open Box search during Deep Scan

Sign up: https://www.searchapi.io/

## Optional providers

```
SERPAPI_API_KEY=
BESTBUY_API_KEY=
EBAY_CLIENT_ID=
EBAY_CLIENT_SECRET=
```

Best Buy's developer signup can reject free-email and .edu registrations, so FlipScout does not depend on it.

eBay's official Browse API can provide live active inventory. eBay's Marketplace Insights API is the official source for historical sales data, but eBay currently describes it as restricted / not open to new users.

## Important sold-data distinction

As of July 23, 2026, eBay requires signing in to view sold/completed listings, so public SERP providers can no longer retrieve the old completed-items result pages.

FlipScout therefore distinguishes:

- **Sales-backed evidence**: active eBay listings that publicly report real prior units sold. The displayed price is the listing's current price.
- **Historical sold transactions**: only available if a provider/account has legitimate access to eBay Marketplace Insights or another licensed sold-history source.
- **Current asking comps**: active listings; never labeled as sold value.

The UI says which evidence type was used.

## Local resale

Enter a ZIP code in the PC Analyzer. With SearchAPI configured, FlipScout searches eBay local-pickup listings within the selected radius and produces a local likely-sale range from real nearby asking comps. If there are too few comps, it returns unavailable instead of fabricating a local number.

## Live provider audit

`scripts/live-audit.mjs` runs a fixed set of real searches through the production pipeline and prints, for each provider and store, raw vs. kept listings, drop reasons with example titles, and the cheapest qualified listings with links. It uses real credits.

```bash
SERPER_API_KEY=... SEARCHAPI_API_KEY=... npm run audit:live            # fast scans
```

## Development

```bash
npm install
npm run dev
```

Frontend: React + Vite  
Backend: Express locally, Vercel Functions when deployed  
Runtime: Node 24

## Security

Never commit API keys. Store them in Vercel Environment Variables (Production and Preview), local environment variables, or GitHub Codespaces secrets. Without them the live search reports "No market data provider is configured".
