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
- Sort by Best Deal, Lowest Price, Most Under Market, Best for Flip, or Best Fit for Budget
- 10-minute server-side market cache to conserve free API credits
- Automatic GitHub CI checks and Vercel deployment

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

## Development

```bash
npm install
npm run dev
```

Frontend: React + Vite  
Backend: Express locally, Vercel Functions when deployed  
Runtime: Node 24

## Security

Never commit API keys. Store them in Vercel Environment Variables, local environment variables, or GitHub Codespaces secrets.
