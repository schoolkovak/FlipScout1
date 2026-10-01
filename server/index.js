import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 8787;

function sourceStatus() {
  return [
    { name:"Google Shopping (SerpApi)", status: process.env.SERPAPI_API_KEY ? "Connected" : "Missing credentials" },
    { name:"Best Buy", status: process.env.BESTBUY_API_KEY ? "Connected" : "Missing credentials" },
    { name:"eBay", status: process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET ? "Connected" : "Requires production approval / credentials" }
  ];
}

app.get("/api/sources",(req,res)=>res.json({sources:sourceStatus()}));

async function searchSerpApi(query) {
  if (!process.env.SERPAPI_API_KEY) return [];
  const params = new URLSearchParams({
    engine:"google_shopping",
    q:query,
    api_key:process.env.SERPAPI_API_KEY,
    gl:"us",
    hl:"en"
  });
  const response = await fetch("https://serpapi.com/search.json?" + params.toString());
  if (!response.ok) throw new Error("SerpApi request failed");
  const data = await response.json();
  return (data.shopping_results || []).slice(0,50).map(function(x){
    const itemPrice = Number(x.extracted_price || 0);
    return {
      source:"Google Shopping",
      title:x.title || "Untitled listing",
      condition:"New / retailer",
      itemPrice:itemPrice,
      shipping:0,
      totalPrice:itemPrice,
      seller:x.source || "Unknown retailer",
      url:x.link || null
    };
  }).filter(function(x){ return x.totalPrice > 0; });
}

function median(nums) {
  const a = nums.slice().sort(function(x,y){ return x-y; });
  if (!a.length) return null;
  const m = Math.floor(a.length/2);
  return a.length % 2 ? a[m] : (a[m-1] + a[m]) / 2;
}

function trimmed(values) {
  const a = values.slice().sort(function(x,y){ return x-y; });
  if (a.length < 5) return a;
  const cut = Math.floor(a.length * 0.1);
  return a.slice(cut, a.length - cut);
}

app.post("/api/deals/search", async function(req,res){
  const body = req.body || {};
  const query = body.query || "";
  const partBudget = Number(body.partBudget || 0);
  const buildBudget = Number(body.buildBudget || 0);
  const committed = Number(body.committed || 0);

  const results = [];
  try {
    const serp = await searchSerpApi(query);
    results.push.apply(results, serp);
  } catch (error) {
    console.error(error);
  }

  if (!results.length) {
    return res.json({
      available:false,
      message:"Add at least one live provider key. SerpApi is currently the quickest live source. eBay and Best Buy can be added when their credentials are available."
    });
  }

  const compPrices = trimmed(results.map(function(x){ return x.totalPrice; }));
  const med = median(compPrices);
  const low = compPrices.length ? Math.min.apply(null, compPrices) : null;
  const high = compPrices.length ? Math.max.apply(null, compPrices) : null;
  const remainingBefore = buildBudget - committed;

  const enriched = results.map(function(x){
    const pct = med ? Math.round((med - x.totalPrice) / med * 100) : 0;
    const budgetFit = partBudget ? Math.max(0, 1 - x.totalPrice / partBudget) : 0;
    const score = Math.max(0, Math.min(100, Math.round(55 + pct * 1.5 + budgetFit * 20)));
    return Object.assign({}, x, {
      percentVsMarket:pct,
      score:score,
      budgetLeft:remainingBefore - x.totalPrice
    });
  }).sort(function(a,b){ return b.score - a.score; }).slice(0,25);

  return res.json({
    available:true,
    market:{
      median:Math.round(med),
      low:Math.round(low),
      high:Math.round(high),
      sampleSize:compPrices.length,
      confidence:compPrices.length >= 20 ? "High" : compPrices.length >= 8 ? "Medium" : "Low"
    },
    results:enriched
  });
});

app.listen(port,function(){
  console.log("FlipScout API running on port " + port);
});
