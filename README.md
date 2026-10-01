# FlipScout

FlipScout is a PC-flipping and hardware deal-analysis app.

## Current features
- Complete-PC deal analyzer with deterministic fallback valuation
- Parts Deal Scanner interface
- Live provider status panel
- Live Google Shopping search when `SERPAPI_API_KEY` is configured
- Current market median from live listings
- Basic outlier trimming
- Deal scoring based on market discount and remaining budget

## Planned live sources
- SerpApi / Google Shopping for broad new-retail coverage
- Best Buy product/open-box API
- eBay Browse API for live new/used listings after production approval

For Facebook Marketplace, Mercari, OfferUp, and Craigslist, FlipScout should use pasted listing URLs/text/screenshots rather than unauthorized scraping.

## Run in Codespaces or locally
1. Run `npm install`
2. Copy `.env.example` to `.env`
3. Add provider credentials
4. Run `npm run dev`

Frontend: React + Vite
Backend: Express

## Security
Never commit API keys. Store them in GitHub Codespaces secrets or environment variables.
