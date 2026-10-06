import { parseListingText } from "../../src/listingParser.js";
import { createHash } from "node:crypto";
import { resolveCatalogPart } from "../../shared/catalog.js";
import { SNIPER_CATEGORIES } from "../../shared/sniper.js";
const EBAY_SCOPE = "https://api.ebay.com/oauth/api_scope";
const searchCache=new Map();
const CACHE_MS=10*60*1000;
const inFlight=new Map();
async function providerFetch(url,options={}){
  for(let attempt=0;attempt<2;attempt++){
    const response=await fetch(url,{...options,signal:AbortSignal.timeout(12000)});
    if(response.status>=500 && attempt===0){await response.body?.cancel();continue;}
    return response;
  }
}
function safeUrl(value){try{const u=new URL(value);return ["https:","http:"].includes(u.protocol)?u.href:null;}catch{return null;}}


function env(name) {
  return process.env[name] || "";
}

function providerKey(name,input={}) {
  return input?.providerKeys?.[name] || env(name);
}

export function providerStatus(providerKeys={}) {
  const scoped={providerKeys};

  return [
    {
      id:"serper",
      name:"Serper Shopping",
      status: providerKey("SERPER_API_KEY",scoped) ? "Connected" : "Missing credentials",
      coverage:"Recommended free starter: 2,500 real-time Google Shopping queries",
      signupUrl:"https://serper.dev/",
      freeAllowance:"2,500 free queries"
    },
    {
      id:"searchapi",
      name:"SearchAPI",
      status: providerKey("SEARCHAPI_API_KEY",scoped) ? "Connected" : "Missing credentials",
      coverage:"Direct eBay, Walmart and Best Buy public search results; use sparingly on free credits",
      signupUrl:"https://www.searchapi.io/",
      freeAllowance:"100 free requests"
    },
    {
      id:"serpapi",
      name:"SerpApi Google Shopping",
      status: env("SERPAPI_API_KEY") ? "Connected" : "Missing credentials",
      coverage:"Optional Google Shopping provider; 250 free searches/month",
      signupUrl:"https://serpapi.com/",
      freeAllowance:"250 searches/month"
    },
    {
      id:"bestbuy",
      name:"Best Buy",
      status: env("BESTBUY_API_KEY") ? "Connected" : "Missing credentials",
      coverage:"Near-real-time new pricing plus official Open Box offers",
      signupUrl:"https://developer.bestbuy.com/",
      freeAllowance:"50,000 calls/day if approved"
    },
    {
      id:"ebay",
      name:"eBay",
      status: env("EBAY_CLIENT_ID") && env("EBAY_CLIENT_SECRET") ? "Connected" : "Missing credentials / production approval",
      coverage:"Live new and used asking prices",
      signupUrl:"https://developer.ebay.com/",
      freeAllowance:"Developer registration is free; production Buy API approval required"
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
  if (s.includes("renewed")) return "renewed";
  if (s.includes("refurb")) return "refurbished";
  if (s.includes("open box") || s.includes("open-box") || s.includes("new opened") || s.includes("like new")) return "open-box";
  if (s.includes("new")) return "new";
  if (s.includes("used") || s.includes("pre-owned") || s.includes("preowned") || s.includes("second hand")) return "used";
  return "unknown";
}

function conditionMatches(actual,requested){
  if(requested==="any") return true;
  if(actual===requested) return true;
  if(requested==="renewed" && actual==="refurbished") return true;
  return false;
}

function conditionSearchTerm(condition){
  return condition==="open-box"?"open box":condition==="any"?"":condition;
}

function normalizeText(value) {
  return String(value||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}

function importantTokens(query) {
  const q=normalizeText(query);
  const stop=new Set(["ssd","nvme","gpu","cpu","graphics","card","gaming","pc","desktop","new","used","preowned","pre","owned"]);
  return q.split(" ").filter(t=>t.length>1 && !stop.has(t));
}

function capacities(text) {
  const raw=String(text||"").toLowerCase();
  const values=[];
  const re=/(\d+(?:\.\d+)?)\s*(tb|gb)\b/g;
  let m;
  while((m=re.exec(raw))){
    const n=Number(m[1]);
    values.push(m[2]==="tb"?n*1024:n);
  }
  return values;
}

function primaryCapacity(text) {
  const values=capacities(text);
  return values.length?Math.max(...values):null;
}

function variantPenalty(q,t) {
  let penalty=0;
  const variants=["ti","super","xt","xtx","x3d"];
  for(const v of variants){
    const qHas=new RegExp("\\b"+v+"\\b").test(q) || (v==="x3d"&&q.includes("x3d"));
    const tHas=new RegExp("\\b"+v+"\\b").test(t) || (v==="x3d"&&t.includes("x3d"));
    if(qHas!==tHas) penalty+=.22;
  }
  return Math.min(.55,penalty);
}

export function relevanceScore(title, query, category) {
  const t=normalizeText(title);
  const q=normalizeText(query);
  if (!t || !q) return 0;
  const tokens=importantTokens(q);
  let matched=0;
  for (const token of tokens) if (t.includes(token)) matched++;
  let score=tokens.length ? matched/tokens.length : (t.includes(q)?1:0.5);

  const cat=String(category||"").toLowerCase();
  if(["gpu","cpu"].includes(cat)){
    const expected=resolveCatalogPart(cat,query);
    const identified=parseListingText(title)[cat];
    if(expected.item && identified!==expected.canonical)return 0;
    const model=String(query).match(/\b(?:\d{3,5}[a-z]*|[ab]\d{3})\b/i)?.[0];
    if(model && !t.replace(/\s+/g,"").includes(model.toLowerCase()))return 0;
    if(/\b(laptop|notebook|mobile|waterblock|water block|replacement fan|empty box|box only|riser|adapter|for parts|parts only|not working|broken|untested|repair|as is|gaming pc|desktop pc|prebuilt|bundle|motherboard combo)\b/.test(t))return 0;
    if(variantPenalty(q,t)>0)return 0;
    if(cat==="gpu" && expected.item){
      const caps=capacities(title);
      if(caps.length && !caps.includes(expected.item.vram))return 0;
    }
  }
  const broken=/\b(for parts|parts only|not working|broken|untested|repair|as is)\b/.test(t);
  if(broken) score-=.7;

  if (cat==="gpu") {
    if (/\b(laptop|notebook|gaming pc|desktop pc|prebuilt|complete pc|computer system)\b/.test(t)) score-=.55;
    if (/\b(water ?block|heatsink|backplate|replacement fan|cooler only|empty box|box only|riser|vertical mount)\b/.test(t)) score-=.7;
    if (/\b(graphics card|gpu|geforce|radeon|rtx|rx|arc)\b/.test(t)) score+=.15;
    score-=variantPenalty(q,t);
  }

  if (cat==="cpu") {
    if (/\b(laptop|notebook|desktop pc|prebuilt|complete pc|motherboard combo|bundle)\b/.test(t)) score-=.5;
    if (/\b(processor|cpu|ryzen|intel|core)\b/.test(t)) score+=.12;
    score-=variantPenalty(q,t);
  }

  if (cat.includes("ssd") || cat.includes("storage") || cat==="ssd / nvme") {
    if (/\b(enclosure|adapter|heatsink|cable|duplicator|dock|case only)\b/.test(t)) score-=.65;
    if (/\b(ssd|nvme|solid state|m 2|m2)\b/.test(t)) score+=.14;
  }

  if (cat==="ram") {
    if (/\b(laptop|sodimm|so dimm)\b/.test(t) && !/\b(sodimm|so dimm)\b/.test(q)) score-=.5;
    if (/\b(memory|ram|ddr4|ddr5)\b/.test(t)) score+=.12;
  }

  if (cat==="motherboard") {
    if (/\b(combo|bundle|with cpu|cpu included)\b/.test(t)) score-=.55;
    if (/\b(motherboard|mainboard|b550|b650|b850|x570|x670|x870|b760|z790|b860|z890)\b/.test(t)) score+=.12;
  }

  if (cat==="psu") {
    if (/\b(cable only|replacement cable|extension cable|adapter)\b/.test(t)) score-=.7;
    if (/\b(power supply|psu|80 plus|atx 3)\b/.test(t)) score+=.12;
  }

  if (cat==="case") {
    if (/\b(case fan|fan only|side panel|front panel|replacement panel)\b/.test(t)) score-=.6;
    if (/\b(pc case|computer case|chassis|mid tower|atx case)\b/.test(t)) score+=.12;
  }

  if (cat.includes("cooler")) {
    if (/\b(bracket only|mounting kit|retention kit|replacement fan)\b/.test(t)) score-=.65;
    if (/\b(cooler|aio|liquid cooling|air cooler|heatsink)\b/.test(t)) score+=.12;
  }

  if (cat==="complete pc") {
    const expected=parseListingText(query),actual=parseListingText(title);
    if((expected.cpu && expected.cpu!==actual.cpu)||(expected.gpu && expected.gpu!==actual.gpu))return 0;
    if (/\b(gaming pc|gaming desktop|desktop computer|prebuilt|computer)\b/.test(t)) score+=.15;
    if (/\b(laptop|notebook|parts only|case only)\b/.test(t)) score-=.65;
  }

  if (["gpu","ram","ram / memory","nvme ssd","sata ssd","ssd / nvme","ssd / storage","storage","hard drive / hdd"].includes(cat)) {
    const qCap=primaryCapacity(query);
    const tCap=primaryCapacity(title);
    if(qCap&&tCap&&Math.abs(qCap-tCap)/qCap>.12) score-=.38;
  }

  const sniperProfile=SNIPER_CATEGORIES.find(x=>x.name.toLowerCase()===cat);
  if(sniperProfile){
    const excluded=(sniperProfile.exclude||[]).some(term=>t.includes(normalizeText(term)));
    if(excluded) score-=.72;
    const included=(sniperProfile.include||[]).some(term=>t.includes(normalizeText(term)));
    if(included) score+=.12;
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
  const response=await providerFetch("https://serpapi.com/search.json?"+params.toString());
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
  }).filter(x=>x.itemPrice>0 && conditionMatches(x.condition,condition));
}


export async function searchSerperShopping(input) {
  const {query,category,condition}=input;
  const apiKey=providerKey("SERPER_API_KEY",input);
  if (!apiKey) return [];
  const q=condition==="used" ? "used "+query : condition==="open-box" ? "open box "+query : query;
  const response=await providerFetch("https://google.serper.dev/shopping",{
    method:"POST",
    headers:{
      "X-API-KEY":apiKey,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({q,gl:"us",hl:"en",num:100})
  });
  if(!response.ok) throw new Error("Serper Shopping returned "+response.status);
  const data=await response.json();
  return (data.shopping||[]).map((x,index)=>{
    const itemPrice=parseMoney(x.price);
    const ship=parseShippingFromSerp({delivery:x.delivery});
    let inferredCondition=normalizeCondition((x.title||"")+" "+(x.condition||""));
    let conditionAssumed=false;
    if(inferredCondition==="unknown" && condition!=="any"){inferredCondition=condition;conditionAssumed=true;}
    return {
      id:"serper-"+(x.productId||index)+"-"+itemPrice,
      source:"Google Shopping",
      sourceType:"retail-aggregator",
      title:x.title||"Untitled shopping result",
      condition:inferredCondition,
      conditionAssumed,
      itemPrice:itemPrice||0,
      shipping:ship.shipping,
      shippingKnown:ship.shippingKnown,
      totalPrice:(itemPrice||0)+ship.shipping,
      seller:x.source||"Unknown merchant",
      url:x.link||null,
      freshness:null,
      relevance:relevanceScore(x.title,query,category)
    };
  }).filter(x=>x.itemPrice>0 && conditionMatches(x.condition,condition));
}

function searchApiCondition(condition){
  if(condition==="new") return "new";
  if(condition==="used") return "pre_owned_excellent,used_very_good,used_good,used_acceptable,pre_owned_fair";
  if(condition==="open-box") return "new_opened,like_new";
  if(condition==="renewed" || condition==="refurbished") return "certified_refurbished,excellent_refurbished,very_good_refurbished,good_refurbished,seller_refurbished";
  return null;
}

async function searchSearchApiEngine(engine,query,extra={},providerKeys={}){
  const apiKey=providerKeys?.SEARCHAPI_API_KEY || env("SEARCHAPI_API_KEY");
  if(!apiKey) return null;
  const params=new URLSearchParams({engine,q:query,api_key:apiKey,...extra});
  const response=await providerFetch("https://www.searchapi.io/api/v1/search?"+params.toString());
  if(!response.ok) throw new Error("SearchAPI "+engine+" returned "+response.status);
  return response.json();
}

function mapSearchApiEbayResult(x,index,{query,category}) {
  const itemPrice=Number(x.extracted_price ?? x.extracted_price_range?.from ?? 0);
  const shippingKnown=x.extracted_shipping!==undefined || /free/i.test(x.shipping||"");
  const shipping=/free/i.test(x.shipping||"")?0:Number(x.extracted_shipping||0);
  return {
    id:"searchapi-ebay-"+(x.item_id||index),
    source:"eBay",
    sourceType:"marketplace",
    title:x.title||"Untitled eBay listing",
    condition:normalizeCondition(x.condition),
    itemPrice,
    shipping,
    shippingKnown,
    totalPrice:itemPrice+shipping,
    seller:x.seller?.name||"eBay seller",
    sellerFeedback:Number(x.seller?.positive_feedback_percent||0)||null,
    soldCount:Number(x.extracted_items_sold||0)||0,
    watchers:Number(x.extracted_watching||0)||0,
    url:x.link||null,
    freshness:null,
    relevance:relevanceScore(x.title,query,category)
  };
}

export async function searchSearchApiEbay(input) {
  const {query,category,condition,postalCode,localOnly=false,distanceRadius=50,providerKeys={}}=input;
  const extra={num:"240",sort_by:localOnly?"distance_nearest":"best_match",buying_format:"buy_it_now"};
  const cond=searchApiCondition(condition);
  if(cond) extra.condition=cond;
  if(postalCode){
    extra.postal_code=String(postalCode);
    extra.distance_radius=String(distanceRadius||50);
  }
  if(localOnly) extra.filters="local_pickup";
  const data=await searchSearchApiEngine("ebay_search",query,extra,providerKeys);
  if(!data) return [];

  const raw=[...(data.organic_results||[])];
  for(const section of (data.sections||[])){
    if(section?.has_items && Array.isArray(section.results)) raw.push(...section.results);
  }

  return raw.map((x,index)=>mapSearchApiEbayResult(x,index,{query,category}))
    .filter(x=>x.itemPrice>0 && conditionMatches(x.condition,condition));
}

export async function searchSearchApiBestBuy(input) {
  const {query,category,condition,providerKeys={}}=input;
  const data=await searchSearchApiEngine("bestbuy_search",query,{sort_by:"best_match"},providerKeys);
  if(!data) return [];
  const out=[];
  for(const [index,x] of (data.organic_results||[]).entries()){
    const itemPrice=Number(x.extracted_price||0);
    if(itemPrice>0 && (condition==="any"||condition==="new")){
      out.push({
        id:"searchapi-bestbuy-new-"+(x.product_id||index),
        source:"Best Buy",
        sourceType:"retailer",
        title:x.title||x.short_title||"Best Buy item",
        condition:"new",
        itemPrice,
        shipping:0,
        shippingKnown:false,
        totalPrice:itemPrice,
        seller:x.seller?.name||"Best Buy",
        url:x.link||null,
        freshness:null,
        relevance:relevanceScore(x.title,query,category)
      });
    }
    if(condition==="any"||condition==="open-box"){
      for(const [j,offer] of (x.open_box_options||[]).entries()){
        const openPrice=Number(offer.extracted_price||0);
        if(!openPrice) continue;
        out.push({
          id:"searchapi-bestbuy-open-"+(x.product_id||index)+"-"+j,
          source:"Best Buy",
          sourceType:"retailer",
          title:(x.title||x.short_title||"Best Buy item")+" - Open Box "+(offer.condition||""),
          condition:"open-box",
          itemPrice:openPrice,
          shipping:0,
          shippingKnown:false,
          totalPrice:openPrice,
          seller:"Best Buy",
          url:offer.link||x.link||null,
          freshness:null,
          relevance:relevanceScore(x.title,query,category)
        });
      }
    }
  }
  return out;
}

export async function searchSearchApiWalmart(input) {
  const {query,category,condition,providerKeys={}}=input;
  if(condition==="used"||condition==="open-box") return [];
  const data=await searchSearchApiEngine("walmart_search",query,{sort_by:"best_match"},providerKeys);
  if(!data) return [];
  return (data.organic_results||[]).map((x,index)=>{
    const itemPrice=Number(x.extracted_price||0);
    const shippingKnown=Boolean(x.is_free_shipping);
    return {
      id:"searchapi-walmart-"+(x.id||index),
      source:"Walmart",
      sourceType:"retailer-marketplace",
      title:x.title||"Walmart item",
      condition:"new",
      itemPrice,
      shipping:0,
      shippingKnown,
      totalPrice:itemPrice,
      seller:x.seller_name||"Walmart",
      url:x.link||null,
      freshness:null,
      relevance:relevanceScore(x.title,query,category)
    };
  }).filter(x=>x.itemPrice>0);
}


function marketplaceIdFromResult(seller,url){
  const s=String(seller||"").toLowerCase();
  let host="";
  try{host=new URL(url||"").hostname.toLowerCase();}catch{}
  const hay=s+" "+host;
  if(hay.includes("amazon")) return "amazon";
  if(hay.includes("newegg")) return "newegg";
  if(hay.includes("ebay")) return "ebay";
  if(hay.includes("mercari")) return "mercari";
  return null;
}

function marketplaceName(id){
  return id==="amazon"?"Amazon":id==="newegg"?"Newegg":id==="ebay"?"eBay":id==="mercari"?"Mercari":id||"Marketplace";
}

export async function searchSerperMarketplaces(input){
  const {query,category,condition,marketplaces=[]}=input;
  const apiKey=providerKey("SERPER_API_KEY",input);
  if(!apiKey) return [];
  const selected=new Set(marketplaces.length?marketplaces:["amazon","newegg","ebay","mercari"]);
  const conditionTerm=conditionSearchTerm(condition);
  const q=[conditionTerm,query].filter(Boolean).join(" ");
  const response=await providerFetch("https://google.serper.dev/shopping",{
    method:"POST",
    headers:{"X-API-KEY":apiKey,"Content-Type":"application/json"},
    body:JSON.stringify({q,gl:"us",hl:"en",num:100})
  });
  if(!response.ok) throw new Error("Serper Shopping returned "+response.status);
  const data=await response.json();
  return (data.shopping||[]).map((x,index)=>{
    const itemPrice=parseMoney(x.price);
    const ship=parseShippingFromSerp({delivery:x.delivery,shipping:x.shipping});
    const marketplace=marketplaceIdFromResult(x.source,x.link);
    let normalized=normalizeCondition((x.title||"")+" "+(x.condition||""));
    let conditionAssumed=false;
    if(normalized==="unknown" && condition!=="any"){normalized=condition;conditionAssumed=true;}
    return {
      id:"serper-market-"+(x.productId||index)+"-"+itemPrice,
      source:marketplaceName(marketplace),
      provider:"Serper Shopping",
      marketplace,
      sourceType:"marketplace-search",
      title:x.title||"Untitled shopping result",
      condition:normalized,
      conditionAssumed,
      itemPrice:itemPrice||0,
      shipping:ship.shipping,
      shippingKnown:ship.shippingKnown,
      totalPrice:(itemPrice||0)+ship.shipping,
      seller:x.source||marketplaceName(marketplace),
      url:x.link||null,
      freshness:null,
      relevance:relevanceScore(x.title,query,category)
    };
  }).filter(x=>x.marketplace && selected.has(x.marketplace) && x.itemPrice>0 && conditionMatches(x.condition,condition));
}

export async function searchSearchApiAmazon(input){
  const {query,category,condition,providerKeys={}}=input;
  const q=[conditionSearchTerm(condition),query].filter(Boolean).join(" ");
  const data=await searchSearchApiEngine("amazon_search",q,{amazon_domain:"amazon.com"},providerKeys);
  if(!data) return [];
  return (data.organic_results||[]).map((x,index)=>{
    const itemPrice=Number(x.extracted_price||parseMoney(x.price)||0);
    const ship=parseShippingFromSerp({delivery:x.delivery,shipping:x.shipping});
    let normalized=normalizeCondition((x.title||"")+" "+(x.condition||""));
    let conditionAssumed=false;
    if(normalized==="unknown" && condition!=="any"){normalized=condition;conditionAssumed=true;}
    return {
      id:"searchapi-amazon-"+(x.asin||index),
      source:"Amazon",
      provider:"SearchAPI Amazon",
      marketplace:"amazon",
      sourceType:"retailer-marketplace",
      title:x.title||"Amazon item",
      condition:normalized,
      conditionAssumed,
      itemPrice,
      shipping:ship.shipping,
      shippingKnown:ship.shippingKnown,
      totalPrice:itemPrice+ship.shipping,
      seller:"Amazon",
      url:x.link||null,
      rating:Number(x.rating||0)||null,
      reviews:Number(x.reviews||0)||null,
      freshness:null,
      relevance:relevanceScore(x.title,query,category)
    };
  }).filter(x=>x.itemPrice>0 && conditionMatches(x.condition,condition));
}

function structuredGooglePrice(x){
  const candidates=[
    x.extracted_price,
    x.rich_snippet?.top?.detected_extensions?.price,
    x.rich_snippet?.bottom?.detected_extensions?.price,
    x.detected_extensions?.price
  ];
  for(const value of candidates){
    const n=typeof value==="number"?value:parseMoney(value);
    if(Number.isFinite(n)&&n>0)return n;
  }
  return null;
}

export async function searchSearchApiSiteMarketplace(input,marketplace){
  const {query,category,condition,providerKeys={}}=input;
  const domain=marketplace==="newegg"?"newegg.com":marketplace==="mercari"?"mercari.com":null;
  if(!domain)return [];
  const q=["site:"+domain,conditionSearchTerm(condition),query].filter(Boolean).join(" ");
  const data=await searchSearchApiEngine("google",q,{gl:"us",hl:"en",link:"resolved"},providerKeys);
  if(!data)return [];
  return (data.organic_results||[]).map((x,index)=>{
    const itemPrice=structuredGooglePrice(x);
    let normalized=normalizeCondition((x.title||"")+" "+(x.snippet||""));
    let conditionAssumed=false;
    if(normalized==="unknown" && condition!=="any"){normalized=condition;conditionAssumed=true;}
    return {
      id:"searchapi-"+marketplace+"-"+index+"-"+itemPrice,
      source:marketplaceName(marketplace),
      provider:"SearchAPI Google",
      marketplace,
      sourceType:"marketplace-web",
      title:x.title||marketplaceName(marketplace)+" listing",
      condition:normalized,
      conditionAssumed,
      itemPrice:itemPrice||0,
      shipping:0,
      shippingKnown:false,
      totalPrice:itemPrice||0,
      seller:marketplaceName(marketplace),
      url:x.link||null,
      freshness:x.date||null,
      relevance:relevanceScore(x.title,query,category)
    };
  }).filter(x=>x.itemPrice>0 && conditionMatches(x.condition,condition));
}

function bestBuySearchTerms(query) {
  const tokens=normalizeText(query).split(" ").filter(Boolean).slice(0,6);
  return tokens.map(t=>"search="+encodeURIComponent(t)).join("&");
}

async function bestBuyOpenBoxForSkus(skus,{query,category}) {
  if (!skus.length || !env("BESTBUY_API_KEY")) return [];
  const list=skus.slice(0,100).join(",");
  const url="https://api.bestbuy.com/beta/products/openBox(sku%20in("+list+"))?apiKey="+encodeURIComponent(env("BESTBUY_API_KEY"));
  const response=await providerFetch(url);
  if (!response.ok) throw new Error("Best Buy Open Box returned "+response.status);
  const data=await response.json();
  const out=[];
  for (const product of data.results||[]) {
    for (let i=0;i<(product.offers||[]).length;i++) {
      const offer=product.offers[i];
      const itemPrice=Number(offer.prices?.current||0);
      if (!itemPrice) continue;
      out.push({
        id:"bestbuy-openbox-"+product.sku+"-"+i+"-"+itemPrice,
        source:"Best Buy",
        sourceType:"retailer",
        title:product.names?.title||"Best Buy Open Box item",
        condition:"open-box",
        itemPrice,
        shipping:0,
        shippingKnown:false,
        totalPrice:itemPrice,
        seller:"Best Buy",
        url:product.links?.web||null,
        freshness:null,
        relevance:relevanceScore(product.names?.title,query,category)
      });
    }
  }
  return out;
}

export async function searchBestBuy({query,category,condition}) {
  if (!env("BESTBUY_API_KEY")) return [];
  const terms=bestBuySearchTerms(query);
  const searchUrl="https://api.bestbuy.com/v1/products("+terms+"&active=true)?format=json&show=sku,name,salePrice,url,onlineAvailability&sort=salePrice.asc&pageSize=100&apiKey="+encodeURIComponent(env("BESTBUY_API_KEY"));
  const response=await providerFetch(searchUrl);
  if (!response.ok) throw new Error("Best Buy Products returned "+response.status);
  const data=await response.json();
  const products=data.products||[];

  const newItems=products.map((p,index)=>{
    const itemPrice=Number(p.salePrice||0);
    return {
      id:"bestbuy-new-"+(p.sku||index),
      source:"Best Buy",
      sourceType:"retailer",
      title:p.name||"Best Buy item",
      condition:"new",
      itemPrice,
      shipping:0,
      shippingKnown:false,
      totalPrice:itemPrice,
      seller:"Best Buy",
      url:p.url||null,
      freshness:null,
      relevance:relevanceScore(p.name,query,category)
    };
  }).filter(x=>x.itemPrice>0);

  let openBox=[];
  if (condition==="any" || condition==="open-box") {
    openBox=await bestBuyOpenBoxForSkus(products.map(p=>p.sku).filter(Boolean),{query,category});
  }

  if (condition==="new") return newItems;
  if (condition==="open-box") return openBox;
  if (condition==="used") return [];
  return [...newItems,...openBox];
}

let ebayTokenCache={token:null,expiresAt:0};

async function getEbayToken() {
  if (!env("EBAY_CLIENT_ID") || !env("EBAY_CLIENT_SECRET")) return null;
  if (ebayTokenCache.token && Date.now()<ebayTokenCache.expiresAt-60000) return ebayTokenCache.token;
  const credentials=Buffer.from(env("EBAY_CLIENT_ID")+":"+env("EBAY_CLIENT_SECRET")).toString("base64");
  const response=await providerFetch("https://api.ebay.com/identity/v1/oauth2/token",{
    method:"POST",
    headers:{
      "Authorization":"Basic "+credentials,
      "Content-Type":"application/x-www-form-urlencoded"
    },
    body:new URLSearchParams({grant_type:"client_credentials",scope:EBAY_SCOPE})
  });
  if (!response.ok) {
    const body=await response.text();
    throw new Error("eBay authentication failed ("+response.status+")");
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
  const response=await providerFetch("https://api.ebay.com/buy/browse/v1/item_summary/search?"+params.toString(),{
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
  const relevant=dedupe(items).filter(x=>x.relevance>=0.72 && Number.isFinite(x.totalPrice) && x.totalPrice>0);
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


function weightedMedian(items,valueFn,weightFn){
  if(!items.length) return null;
  const rows=items.map(x=>({value:valueFn(x),weight:Math.max(1,weightFn(x))}))
    .filter(x=>Number.isFinite(x.value)&&x.value>0)
    .sort((a,b)=>a.value-b.value);
  const total=rows.reduce((s,x)=>s+x.weight,0);
  let acc=0;
  for(const row of rows){
    acc+=row.weight;
    if(acc>=total/2) return row.value;
  }
  return rows[rows.length-1]?.value||null;
}

export function buildSalesEvidence(items){
  const qualifying=robustFilter(dedupe(items).filter(x=>x.relevance>=0.72 && Number.isFinite(x.totalPrice) && x.totalPrice>0 && Number(x.soldCount||0)>0));
  const medianPrice=weightedMedian(
    qualifying,
    x=>x.totalPrice,
    x=>Math.min(12,1+Math.log2(1+Number(x.soldCount||0)))
  );
  const totalUnits=qualifying.reduce((s,x)=>s+Number(x.soldCount||0),0);
  const prices=qualifying.map(x=>x.totalPrice).sort((a,b)=>a-b);
  return {
    median:medianPrice===null?null:Math.round(medianPrice*100)/100,
    low:prices.length?Math.round(quantile(prices,.20)*100)/100:null,
    high:prices.length?Math.round(quantile(prices,.80)*100)/100:null,
    listingCount:qualifying.length,
    totalReportedUnitsSold:totalUnits,
    confidence:qualifying.length>=15?"High":qualifying.length>=6?"Medium":qualifying.length>=2?"Low":"Insufficient",
    listings:qualifying.sort((a,b)=>(b.soldCount||0)-(a.soldCount||0)).slice(0,12),
    label:"Active asking price with prior units sold (not a completed-sale price)"
  };
}

export async function searchLocalEbay(input){
  if(!providerKey("SEARCHAPI_API_KEY",input) || !input.postalCode) return {items:[],market:buildMarket([]),errors:[]};
  return liveSearch({...input,localOnly:true,distanceRadius:input.distanceRadius||50});
}

function conditionQuality(condition) {
  if (condition==="new") return 1;
  if (condition==="open-box") return .92;
  if (condition==="renewed") return .88;
  if (condition==="refurbished") return .84;
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
  const sample=Number(market.sampleSize||0);
  const evidenceCap=sample>=35?95:sample>=15?88:sample>=8?78:sample>=4?65:50;

  const scored=market.comps.map(item=>{
    const under=medianValue ? (medianValue-item.totalPrice)/medianValue : 0;
    const underScore=Math.max(0,Math.min(1,(under+.10)/.35));
    const budgetScore=maxPart ? Math.max(0,Math.min(1,1-(item.totalPrice/maxPart-0.70))) : .55;
    const buildFit=remainingBefore ? Math.max(0,Math.min(1,(remainingBefore-item.totalPrice)/Math.max(remainingBefore,.01)+.35)) : .5;
    const conditionScore=conditionQuality(item.condition);
    const appeal=resaleAppeal(query,item.title);
    const shippingScore=item.shippingKnown?1:.45;
    const relevance=Math.max(0,Math.min(1,Number(item.relevance||0)));

    let raw=100*(.36*underScore+.15*budgetScore+.12*buildFit+.09*conditionScore+.10*appeal+.08*shippingScore+.10*relevance);
    const riskFlags=[];

    if(under>.45){
      raw-=18;
      riskFlags.push("Price is >45% below the filtered market median — verify condition, completeness, and seller.");
    }
    if(!item.shippingKnown){
      raw-=5;
      riskFlags.push("Shipping cost is unknown.");
    }
    if(relevance<.72){
      raw-=8;
      riskFlags.push("Listing-title match is weaker than ideal.");
    }
    if(sample<8) riskFlags.push("Market sample is small; score is capped.");
    if(item.condition==="unknown") riskFlags.push("Condition is not clearly identified.");

    const itemCap=Math.min(evidenceCap,item.shippingKnown?100:69,under>.45?59:100,relevance<.72?59:100,item.condition==="unknown"?69:100);
    const score=Math.max(0,Math.min(itemCap,Math.round(raw)));
    return {
      ...item,
      score,
      scoreCap:itemCap,
      riskFlags,
      evidenceSampleSize:sample,
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

function cacheKey(input){
  return [
    normalizeText(input.query),
    String(input.postalCode||""),String(input.distanceRadius||50),Boolean(input.localOnly),
    createHash("sha256").update(JSON.stringify([providerKey("SERPER_API_KEY",input),providerKey("SEARCHAPI_API_KEY",input),env("SERPAPI_API_KEY"),env("BESTBUY_API_KEY"),env("EBAY_CLIENT_ID")])).digest("hex"),
    String(input.category||"").toLowerCase(),
    input.condition||"any",
    input.deepScan?"deep":"fast",
    input.componentEstimate?"component":"direct",
    providerKey("SERPER_API_KEY",input)?"serper":"no-serper",
    providerKey("SEARCHAPI_API_KEY",input)?"searchapi":"no-searchapi"
  ].join("|");
}

function chooseProviders(input){
  const hasOfficialEbay=Boolean(env("EBAY_CLIENT_ID")&&env("EBAY_CLIENT_SECRET"));
  const hasSerper=Boolean(providerKey("SERPER_API_KEY",input));
  const hasSearchApi=Boolean(providerKey("SEARCHAPI_API_KEY",input));
  const condition=input.condition||"any";
  const providers=[];

  if(input.componentEstimate){
    const cat=String(input.category||"").toLowerCase();
    if(condition==="used"&&hasSearchApi&&(cat==="gpu"||cat==="cpu")){
      providers.push(["SearchAPI eBay",()=>searchSearchApiEbay(input)]);
      return providers;
    }
    if(hasSerper){
      providers.push(["Serper Shopping",()=>searchSerperShopping(input)]);
      return providers;
    }
  }

  if(condition==="used" || condition==="renewed" || condition==="refurbished"){
    if(hasSearchApi) providers.push(["SearchAPI eBay",()=>searchSearchApiEbay(input)]);
    else if(hasOfficialEbay && condition==="used") providers.push(["eBay",()=>searchEbay(input)]);
    if(hasSerper) providers.push(["Serper Shopping",()=>searchSerperShopping(input)]);
    else if(!providers.length && env("SERPAPI_API_KEY")) providers.push(["Google Shopping",()=>searchSerpApi(input)]);
    return providers;
  }

  if(condition==="open-box"){
    if(hasSearchApi) {
      providers.push(["SearchAPI Best Buy",()=>searchSearchApiBestBuy(input)]);
      providers.push(["SearchAPI eBay",()=>searchSearchApiEbay(input)]);
    } else if(env("BESTBUY_API_KEY")) {
      providers.push(["Best Buy",()=>searchBestBuy(input)]);
    } else if(hasOfficialEbay) {
      providers.push(["eBay",()=>searchEbay(input)]);
    } else if(hasSerper) {
      providers.push(["Serper Shopping",()=>searchSerperShopping(input)]);
    }
    return providers;
  }

  if(hasSerper) providers.push(["Serper Shopping",()=>searchSerperShopping(input)]);
  else if(env("SERPAPI_API_KEY")) providers.push(["Google Shopping",()=>searchSerpApi(input)]);

  if(input.deepScan&&hasSearchApi){
    providers.push(["SearchAPI Walmart",()=>searchSearchApiWalmart(input)]);
    providers.push(["SearchAPI Best Buy",()=>searchSearchApiBestBuy(input)]);
    if(condition==="any") providers.push(["SearchAPI eBay",()=>searchSearchApiEbay(input)]);
  } else if(!hasSerper&&!env("SERPAPI_API_KEY")){
    if(hasSearchApi){
      providers.push(["SearchAPI Walmart",()=>searchSearchApiWalmart(input)]);
      providers.push(["SearchAPI Best Buy",()=>searchSearchApiBestBuy(input)]);
      if(condition==="any") providers.push(["SearchAPI eBay",()=>searchSearchApiEbay(input)]);
    } else {
      if(env("BESTBUY_API_KEY")) providers.push(["Best Buy",()=>searchBestBuy(input)]);
      if(hasOfficialEbay) providers.push(["eBay",()=>searchEbay(input)]);
    }
  }

  return providers;
}

async function fetchMarket(input,key,hit){
  const providers=input.localOnly?[["Local eBay",()=>searchSearchApiEbay(input)]]:chooseProviders(input);
  const settled=await Promise.all(providers.map(async([name,run])=>{
    try{return {items:await run(),name};}
    catch(error){return {name,error:error.name==="TimeoutError"?"Provider timed out":String(error.message).replace(/https?:\/\/\S+/g,"[provider]")};}
  }));
  const errors=settled.filter(x=>x.error).map(x=>({provider:x.name,message:x.error}));
  if(providers.length && errors.length===providers.length && hit && Date.now()-hit.savedAt<60*60*1000)return {...hit.value,errors,stale:true};
  const items=dedupe(settled.flatMap(x=>x.items||[])).filter(x=>x.relevance>=.72 && Number.isFinite(x.totalPrice) && x.totalPrice>0).map(x=>({...x,url:safeUrl(x.url)}));
  const value={items,market:buildMarket(items),errors,observedAt:new Date().toISOString(),stale:false};
  // Short negative cache avoids hammering failed/quota-limited providers.
  searchCache.set(key,{savedAt:Date.now(),ttl:errors.length?30000:CACHE_MS,value});
  if(searchCache.size>150)searchCache.delete(searchCache.keys().next().value);
  return value;
}

export async function liveSearch(input){
  const key=cacheKey(input);
  const hit=searchCache.get(key);
  let base;
  const cached=Boolean(hit && Date.now()-hit.savedAt<hit.ttl);
  if(cached)base=hit.value;
  else{
    if(!inFlight.has(key))inFlight.set(key,fetchMarket(input,key,hit).finally(()=>inFlight.delete(key)));
    base=await inFlight.get(key);
  }
  return {...base,cached,ranked:rankDeals(base.items,base.market,input)};
}

export async function searchPartsSniper(input){
  const selected=[...new Set((input.marketplaces||["amazon","newegg","ebay","mercari"]).filter(Boolean))];
  const key="sniper|"+cacheKey({...input,marketplaces:selected});
  const hit=searchCache.get(key);
  if(hit && Date.now()-hit.savedAt<hit.ttl)return {...hit.value,cached:true};

  const hasSerper=Boolean(providerKey("SERPER_API_KEY",input));
  const hasSearchApi=Boolean(providerKey("SEARCHAPI_API_KEY",input));
  const providers=[];

  if(hasSerper) providers.push(["Retail marketplace search",()=>searchSerperMarketplaces({...input,marketplaces:selected})]);

  if(selected.includes("ebay")&&hasSearchApi){
    providers.push(["eBay",async()=> (await searchSearchApiEbay(input)).map(x=>({...x,marketplace:"ebay",provider:"SearchAPI eBay"}))]);
  }

  if(selected.includes("amazon")&&hasSearchApi&&(input.deepScan||!hasSerper)){
    providers.push(["Amazon",()=>searchSearchApiAmazon(input)]);
  }

  if(!hasSerper&&hasSearchApi){
    for(const marketplace of ["newegg","mercari"]){
      if(selected.includes(marketplace))providers.push([marketplaceName(marketplace),()=>searchSearchApiSiteMarketplace(input,marketplace)]);
    }
  }

  const settled=await Promise.all(providers.map(async([name,run])=>{
    try{return {name,items:await run()};}
    catch(error){return {name,error:error.name==="TimeoutError"?"Provider timed out":String(error.message||error).replace(/https?:\/\/\S+/g,"[provider]")};}
  }));
  const errors=settled.filter(x=>x.error).map(x=>({provider:x.name,message:x.error}));
  const items=dedupe(settled.flatMap(x=>x.items||[]))
    .filter(x=>selected.includes(x.marketplace||marketplaceIdFromResult(x.seller,x.url)))
    .map(x=>{
      const marketplace=x.marketplace||marketplaceIdFromResult(x.seller,x.url);
      const extraRisks=[];
      if(x.conditionAssumed)extraRisks.push("Condition inferred from the requested filter; verify the listing.");
      return {...x,marketplace,source:marketplaceName(marketplace),url:safeUrl(x.url),sniperRiskFlags:extraRisks};
    })
    .filter(x=>x.relevance>=.58 && Number.isFinite(x.totalPrice) && x.totalPrice>0);

  const market=buildMarket(items);
  const ranked=rankDeals(items,market,input).map(x=>({
    ...x,
    riskFlags:[...(x.riskFlags||[]),...(x.sniperRiskFlags||[])]
  }));
  const value={items,market,ranked,errors,observedAt:new Date().toISOString(),stale:false,cached:false};
  searchCache.set(key,{savedAt:Date.now(),ttl:errors.length?30000:CACHE_MS,value});
  return value;
}
