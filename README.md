# FlipScout

FlipScout is a PC-flipping and hardware deal-analysis app built around **live comparable listings**, not static AI guesses.

## What works now

- Complete-PC deal analyzer
- Fallback valuation only when live comps are unavailable
- Live parts scanner for GPU, CPU, SSD/storage, RAM, motherboard, PSU, case, cooler and complete PCs
- Real listing links
- Delivered-cost calculations when shipping is known
- Current asking-market median and trimmed price range
- Outlier removal and title relevance filtering
- Build-budget impact
- Deal Score
- Sort by Best Deal, Lowest Price, Most Under Market, Best for Flip, or Best Fit for Budget
- Provider health/status panel
- Automatic GitHub CI build checks

## Live data providers

FlipScout is designed to combine hundreds of current listings where the connected providers allow it:

- **Google Shopping via SerpApi** — broad current retail coverage
- **Best Buy Products + Buying Options APIs** — near-real-time new prices and official Open Box offers
- **eBay Browse API** — live new/used marketplace listings after production approval

Unsupported marketplaces such as Facebook Marketplace, Mercari, OfferUp and Craigslist should be handled later through pasted listing URLs, listing text or screenshots instead of prohibited scraping.

## Environment variables

Never commit real credentials.

```
SERPAPI_API_KEY=
BESTBUY_API_KEY=
EBAY_CLIENT_ID=
EBAY_CLIENT_SECRET=
```

## Development

```bash
npm install
npm run dev
```

Frontend: React + Vite  
Backend: Express locally, Vercel Functions when deployed  
Runtime: Node 24

## Hosting / preview

The repo is prepared for Vercel. Once the GitHub repository is imported into Vercel, every push to `main` automatically creates a fresh production deployment and Git branches can receive preview deployments.

Repository: https://github.com/schoolkovak/FlipScout1

## Security

API keys belong only in local environment variables, GitHub Codespaces secrets, or Vercel Environment Variables. Never paste them into source code or commit them to GitHub.
