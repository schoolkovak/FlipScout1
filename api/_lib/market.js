const EBAY_SCOPE = "https://api.ebay.com/oauth/api_scope";

function env(name) {
  return process.env[name] || "";
}

export function providerStatus() {
  return [
    {
      id:"serpapi",
      name:"Google Shopping",
      status: env("SERPAPI_API_KEY") ? "Connected" : "Missing credentials",
      coverage:"New retail + some second-hand offers surfaced by Google Shopping"
    },
    {
      id:"ebay",
      name:"eBay",
      status: env("EBAY_CLIENT_ID") && env("EBAY_CLIENT_SECRET") ? "Connected" : "Missing credentials / production approval",
      coverage:"Live new and used asking prices"
    }
  ];
}

function parseMoney(text) {
  if (typeof text === "number") return text;
  if (!text) return null;
  const m=String(text).replace(/,/g,"").match(/\$?\s*([0-9]+(?:\.[0-9]+)?)/);
  return m ? Number(m[1]) : null;
}

function normalizeCondition(value) {
  const s=String(value||"").toLowerCase();
  if (s.includes("open") || s.includes("certified") || s.includes("excellent")) return "open-box";
  if (s.includes("new")) return "new";
  if (s.includes("used") || s.includes("pre-owned") || s.includes("second")) return "used";
  return "unknown";
}

function normalizeText(value) {
  return String(value||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}

function importantTokens(query) {
  const q=normalizeText(query);
  const stop=new Set(["gb","tb","ssd","nvme","gpu","cpu","graphics","card","gaming","pc","desktop","new","used"]);
  return q.split(" ").filter(t=>t.length>1 && !stop.has(t));
}

function relevanceScore(title, query, category) {
  const t=normalizeText(title);
  const q=normalizeText(query);
  if (!t || !q) return 0;
  const tokens=importantTokens(q);
  let matched=0;
  for (const token of tokens) if (t.includes(token)) matched++;
  let score=tokens.length ? matched/tokens.length : (t.includes(q)?1:0.5);

  const cat=String(category||"").toLowerCase();
  if (cat==="gpu") {
    if (/\b(laptop|notebook|gaming pc|desktop pc|prebuilt|complete pc|computer system)\b/.test(t)) score-=0.45;
    if (/\b(graphics card|gpu|geforce|radeon|rtx|rx)\b/.test(t)) score+=0.15;
  }
  if (cat==="cpu") {
    if (/\b(laptop|notebook|desktop pc|prebuilt|complete pc)\b/.test(t)) score-=0.4;
    if (/\b(processor|cpu|ryzen|intel|core)\b/.test(t)) score+=0.12;
  }
  if (cat.includes("ssd") || cat.includes("storage")) {
    if (/\b(enclosure|case|adapter|heatsink|cable)\b/.test(t)) score-=0.5;
    if (/\b(ssd|nvme|solid state)\b/.test(t)) score+=0.12;
  }
  return Math.max(0,Math.min(1,score));
}

function parseShippingFromSerp(result) {
  const delivery=result.delivery || result.shipping || "";
  if (!delivery) return {shipping:0,shippingKnown:false};
  if (/free/i.test(delivery)) return {shipping:0,shippingKnown:true};
  const value=parseMoney(delivery);
  return {shipping:value||0,shippingKnown:value!==null};
}

export async function searchSerpApi({query,category,condition}) {
  if (!env("SERPAPI_API_KEY")) return [];
  const params=new URLSearchParams({
    engine:"google_shopping",
    q:query,
    api_key:env("SERPAPI_API_KEY"),
    gl:"us",
    hl:"en"
  });
  const response=await fetch("https://serpapi.com/search.json?"+params.toString());
  if (!response.ok) throw new Error("SerpApi returned "+response.status);
  const data=await response.json();
  return (data.shopping_results||[]).map((x,index)=>{
    const itemPrice=Number(x.extracted_price||0);
    const ship=parseShippingFromSerp(x);
    const inferredCondition=x.second_hand_condition ? "used" : normalizeCondition(x.condition||"new");
    return {
      id:"serp-"+(x.product_id||index)+"-"+itemPrice,
      source:"Google Shopping",
      sourceType:"retail-aggregator",
      title:x.title||"Untitled listing",
      condition:inferredCondition,
      itemPrice,
      shipping:ship.shipping,
      shippingKnown:ship.shippingKnown,
      totalPrice:itemPrice+ship.shipping,
      seller:x.source||"Unknown retailer",
      url:x.product_link||x.link||null,
      freshness:null,
      relevance:relevanceScore(x.title,query,category)
    };
  }).filter(x=>x.itemPrice>0 && (condition==="any" || x.condition===condition));
}

let ebayTokenCache={token:null,expiresAt:0};

async function getEbayToken() {
  if (!env("EBAY_CLIENT_ID") || !env("EBAY_CLIENT_SECRET")) return null;
  if (ebayTokenCache.token && Date.now()<ebayTokenCache.expiresAt-60000) return ebayTokenCache.token;
  const credentials=Buffer.from(env("EBAY_CLIENT_ID")+":"+env("EBAY_CLIENT_SECRET")).toString("base64");
  const response=await fetch("https://api.ebay.com/identity/v1/oauth2/token",{
    method:"POST",
    headers:{
      "Authorization":"Basic "+credentials,
      "Content-Type":"application/x-www-form-urlencoded"
    },
    body:new URLSearchParams({grant_type:"client_credentials",scope:EBAY_SCOPE})
  });
  if (!response.ok) {
    const body=await response.text();
    throw new Error("eBay OAuth failed ("+response.status+"): "+body.slice(0,180));
  }
  const data=await response.json();
  ebayTokenCache={token:data.access_token,expiresAt:Date.now()+Number(data.expires_in||7200)*1000};
  return ebayTokenCache.token;
}

function ebayConditionFilter(condition) {
  if (condition==="new") return "conditions:{NEW}";
  if (condition==="used") return "conditions:{USED}";
  return null;
}

export async function searchEbay({query,category,condition}) {
  const token=await getEbayToken();
  if (!token) return [];
  const params=new URLSearchParams({q:query,limit:"200"});
  const cond=ebayConditionFilter(condition);
  if (cond) params.set("filter",cond);
  const response=await fetch("https://api.ebay.com/buy/browse/v1/item_summary/search?"+params.toString(),{
    headers:{
      "Authorization":"Bearer "+token,
      "X-EBAY-C-MARKETPLACE-ID":"EBAY_US"
    }
  });
  if (!response.ok) {
    const body=await response.text();
    throw new Error("eBay Browse failed ("+response.status+"): "+body.slice(0,220));
  }
  const data=await response.json();
  return (data.itemSummaries||[]).map((x,index)=>{
    const itemPrice=Number(x.price?.value||0);
    const shipValue=x.shippingOptions?.[0]?.shippingCost?.value;
    const shippingKnown=shipValue!==undefined && shipValue!==null;
    const shipping=shippingKnown ? Number(shipValue) : 0;
    return {
      id:"ebay-"+(x.itemId||index),
      source:"eBay",
      sourceType:"marketplace",
      title:x.title||"Untitled eBay listing",
      condition:normalizeCondition(x.condition),
      itemPrice,
      shipping,
      shippingKnown,
      totalPrice:itemPrice+shipping,
      seller:x.seller?.username||"eBay seller",
      url:x.itemWebUrl||null,
      freshness:x.itemCreationDate||null,
      relevance:relevanceScore(x.title,query,category)
    };
  }).filter(x=>x.itemPrice>0 && (condition==="any" || x.condition===condition));
}

function quantile(sorted,q) {
  if (!sorted.length) return null;
  const pos=(sorted.length-1)*q;
  const base=Math.floor(pos);
  const rest=pos-base;
  return sorted[base+1]!==undefined ? sorted[base]+rest*(sorted[base+1]-sorted[base]) : sorted[base];
}

function robustFilter(items) {
  if (items.length<5) return items;
  const prices=items.map(x=>x.totalPrice).sort((a,b)=>a-b);
  const q1=quantile(prices,.25);
  const q3=quantile(prices,.75);
  const iqr=q3-q1;
  const low=Math.max(0,q1-1.5*iqr);
  const high=q3+1.5*iqr;
  return items.filter(x=>x.totalPrice>=low && x.totalPrice<=high);
}

function median(values) {
  const a=values.slice().sort((a,b)=>a-b);
  if (!a.length) return null;
  const mid=Math.floor(a.length/2);
  return a.length%2?a[mid]:(a[mid-1]+a[mid])/2;
}

function dedupe(items) {
  const seen=new Set();
  return items.filter(x=>{
    const key=(x.url||"")+"|"+normalizeText(x.title)+"|"+Math.round(x.totalPrice*100);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildMarket(items) {
  const relevant=items.filter(x=>x.relevance>=0.58);
  const filtered=robustFilter(relevant);
  const prices=filtered.map(x=>x.totalPrice);
  const byCondition={};
  const bySource={};
  for (const item of filtered) {
    byCondition[item.condition]=(byCondition[item.condition]||0)+1;
    bySource[item.source]=(bySource[item.source]||0)+1;
  }
  const shippingKnown=filtered.filter(x=>x.shippingKnown).length;
  const med=median(prices);
  return {
    median:med===null?null:Math.round(med*100)/100,
    low:prices.length?Math.round(quantile(prices,.15)*100)/100:null,
    high:prices.length?Math.round(quantile(prices,.85)*100)/100:null,
    sampleSize:filtered.length,
    rawSampleSize:items.length,
    byCondition,
    bySource,
    shippingKnownPct:filtered.length?Math.round(shippingKnown/filtered.length*100):0,
    confidence:filtered.length>=80?"Very high":filtered.length>=35?"High":filtered.length>=15?"Medium":"Low",
    comps:filtered
  };
}

function conditionQuality(condition) {
  if (condition==="new") return 1;
  if (condition==="open-box") return .92;
  if (condition==="used") return .78;
  return .7;
}

function resaleAppeal(query,title) {
  const text=normalizeText(query+" "+title);
  let score=.6;
  if (/\brtx\s?(40|50)\d{2}\b/.test(text)) score+=.18;
  if (/\brx\s?(7|8|9)\d{3}\b/.test(text)) score+=.12;
  if (/\b(2tb|4tb)\b/.test(text) && /\bnvme\b/.test(text)) score+=.08;
  return Math.min(1,score);
}

export function rankDeals(items,market,{query,partBudget,buildBudget,committed,sortBy="best"}) {
  const medianValue=market.median||0;
  const remainingBefore=Math.max(0,Number(buildBudget||0)-Number(committed||0));
  const maxPart=Number(partBudget||0);
  const scored=market.comps.map(item=>{
    const under=medianValue ? (medianValue-item.totalPrice)/medianValue : 0;
    const underScore=Math.max(0,Math.min(1,(under+.15)/.45));
    const budgetScore=maxPart ? Math.max(0,Math.min(1,1-(item.totalPrice/maxPart-0.65))) : .5;
    const buildFit=remainingBefore ? Math.max(0,Math.min(1,(remainingBefore-item.totalPrice)/Math.max(remainingBefore,.01)+.4)) : .5;
    const conditionScore=conditionQuality(item.condition);
    const appeal=resaleAppeal(query,item.title);
    const shippingScore=item.shippingKnown?1:.55;
    const score=Math.round(100*(.38*underScore+.18*budgetScore+.14*buildFit+.10*conditionScore+.14*appeal+.06*shippingScore));
    return {
      ...item,
      score,
      percentVsMarket:medianValue?Math.round((medianValue-item.totalPrice)/medianValue*100):0,
      budgetLeft:remainingBefore-item.totalPrice,
      withinPartBudget:!maxPart || item.totalPrice<=maxPart
    };
  });
  const sorts={
    best:(a,b)=>b.score-a.score,
    lowest:(a,b)=>a.totalPrice-b.totalPrice,
    under:(a,b)=>b.percentVsMarket-a.percentVsMarket,
    flip:(a,b)=>(b.percentVsMarket+b.score/10)-(a.percentVsMarket+a.score/10),
    budget:(a,b)=>(Number(b.withinPartBudget)-Number(a.withinPartBudget)) || Math.abs(b.budgetLeft)-Math.abs(a.budgetLeft)
  };
  return scored.sort(sorts[sortBy]||sorts.best);
}

export async function liveSearch(input) {
  const jobs=[
    searchSerpApi(input).catch(error=>({__error:true,provider:"Google Shopping",message:error.message})),
    searchEbay(input).catch(error=>({__error:true,provider:"eBay",message:error.message}))
  ];
  const settled=await Promise.all(jobs);
  const errors=[];
  let items=[];
  for (const result of settled) {
    if (Array.isArray(result)) items.push(...result);
    else if (result?.__error) errors.push({provider:result.provider,message:result.message});
  }
  items=dedupe(items).filter(x=>x.relevance>=0.4);
  const market=buildMarket(items);
  const ranked=rankDeals(items,market,input);
  return {items,market,ranked,errors};
}
