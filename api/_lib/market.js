const EBAY_SCOPE = "https://api.ebay.com/oauth/api_scope";\nconst searchCache=new Map();\nconst CACHE_MS=10*60*1000;

function env(name) {
  return process.env[name] || "";
}

export function providerStatus() {
  return [
    {
      id:"serper",
      name:"Serper Shopping",
      status: env("SERPER_API_KEY") ? "Connected" : "Missing credentials",
      coverage:"Recommended free starter: 2,500 real-time Google Shopping queries",
      signupUrl:"https://serper.dev/",
      freeAllowance:"2,500 free queries"
    },
    {
      id:"searchapi",
      name:"SearchAPI",
      status: env("SEARCHAPI_API_KEY") ? "Connected" : "Missing credentials",
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

function relevanceScore(title, query, category) {
  const t=normalizeText(title);
  const q=normalizeText(query);
  if (!t || !q) return 0;
  const tokens=importantTokens(q);
  let matched=0;
  for (const token of tokens) if (t.includes(token)) matched++;
  let score=tokens.length ? matched/tokens.length : (t.includes(q)?1:0.5);

  const cat=String(category||"").toLowerCase();
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
    if (/\b(gaming pc|gaming desktop|desktop computer|prebuilt|computer)\b/.test(t)) score+=.15;
    if (/\b(laptop|notebook|parts only|case only)\b/.test(t)) score-=.65;
  }

  if (["gpu","ram","ssd / nvme","ssd / storage","storage"].includes(cat)) {
    const qCap=primaryCapacity(query);
    const tCap=primaryCapacity(title);
    if(qCap&&tCap&&Math.abs(qCap-tCap)/qCap>.12) score-=.38;
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


export async function searchSerperShopping({query,category,condition}) {
  if (!env("SERPER_API_KEY")) return [];
  const q=condition==="used" ? "used "+query : condition==="open-box" ? "open box "+query : query;
  const response=await fetch("https://google.serper.dev/shopping",{
    method:"POST",
    headers:{
      "X-API-KEY":env("SERPER_API_KEY"),
      "Content-Type":"application/json"
    },
    body:JSON.stringify({q,gl:"us",hl:"en",num:100})
  });
  if(!response.ok) throw new Error("Serper Shopping returned "+response.status);
  const data=await response.json();
  return (data.shopping||[]).map((x,index)=>{
    const itemPrice=parseMoney(x.price);
    const ship=parseShippingFromSerp({delivery:x.delivery});
    const inferredCondition=condition==="any" ? normalizeCondition((x.title||"")+" "+(x.source||"")) : condition;
    return {
      id:"serper-"+(x.productId||index)+"-"+itemPrice,
      source:"Google Shopping",
      sourceType:"retail-aggregator",
      title:x.title||"Untitled shopping result",
      condition:inferredCondition==="unknown"?"new":inferredCondition,
      itemPrice:itemPrice||0,
      shipping:ship.shipping,
      shippingKnown:ship.shippingKnown,
      totalPrice:(itemPrice||0)+ship.shipping,
      seller:x.source||"Unknown merchant",
      url:x.link||null,
      freshness:null,
      relevance:relevanceScore(x.title,query,category)
    };
  }).filter(x=>x.itemPrice>0 && (condition==="any" || x.condition===condition));
}

function searchApiCondition(condition){
  if(condition==="new") return "new";
  if(condition==="used") return "pre_owned_excellent,used_very_good,used_good,used_acceptable,pre_owned_fair";
  if(condition==="open-box") return "new_opened,like_new";
  return null;
}

async function searchSearchApiEngine(engine,query,extra={}){
  if(!env("SEARCHAPI_API_KEY")) return null;
  const params=new URLSearchParams({engine,q:query,api_key:env("SEARCHAPI_API_KEY"),...extra});
  const response=await fetch("https://www.searchapi.io/api/v1/search?"+params.toString());
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

export async function searchSearchApiEbay({query,category,condition,postalCode,localOnly=false,distanceRadius=50}) {
  const extra={num:"240",sort_by:localOnly?"distance_nearest":"best_match",buying_format:"buy_it_now"};
  const cond=searchApiCondition(condition);
  if(cond) extra.condition=cond;
  if(postalCode){
    extra.postal_code=String(postalCode);
    extra.distance_radius=String(distanceRadius||50);
  }
  if(localOnly) extra.filters="local_pickup";
  const data=await searchSearchApiEngine("ebay_search",query,extra);
  if(!data) return [];

  const raw=[...(data.organic_results||[])];
  for(const section of (data.sections||[])){
    if(section?.has_items && Array.isArray(section.results)) raw.push(...section.results);
  }

  return raw.map((x,index)=>mapSearchApiEbayResult(x,index,{query,category}))
    .filter(x=>x.itemPrice>0 && (condition==="any" || x.condition===condition || (condition==="open-box"&&x.condition==="open-box")));
}

export async function searchSearchApiBestBuy({query,category,condition}) {
  const data=await searchSearchApiEngine("bestbuy_search",query,{sort_by:"best_match"});
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

export async function searchSearchApiWalmart({query,category,condition}) {
  if(condition==="used"||condition==="open-box") return [];
  const data=await searchSearchApiEngine("walmart_search",query,{sort_by:"best_match"});
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

function bestBuySearchTerms(query) {
  const tokens=normalizeText(query).split(" ").filter(Boolean).slice(0,6);
  return tokens.map(t=>"search="+encodeURIComponent(t)).join("&");
}

async function bestBuyOpenBoxForSkus(skus,{query,category}) {
  if (!skus.length || !env("BESTBUY_API_KEY")) return [];
  const list=skus.slice(0,100).join(",");
  const url="https://api.bestbuy.com/beta/products/openBox(sku%20in("+list+"))?apiKey="+encodeURIComponent(env("BESTBUY_API_KEY"));
  const response=await fetch(url);
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
  const response=await fetch(searchUrl);
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
  const qualifying=robustFilter(items.filter(x=>x.relevance>=0.58 && Number(x.soldCount||0)>0));
  const medianPrice=weightedMedian(
    qualifying,
    x=>x.totalPrice,
    x=>Math.min(12,1+Math.log2(1+Number(x.soldCount||0)))
  );
  const totalUnits=qualifying.reduce((s,x)=>s+Number(x.soldCount||0),0);
  return {
    median:medianPrice===null?null:Math.round(medianPrice*100)/100,
    listingCount:qualifying.length,
    totalReportedUnitsSold:totalUnits,
    confidence:qualifying.length>=15?"High":qualifying.length>=6?"Medium":qualifying.length>=2?"Low":"Insufficient",
    listings:qualifying.sort((a,b)=>(b.soldCount||0)-(a.soldCount||0)).slice(0,12),
    label:"Sales-backed eBay listing price"
  };
}

export async function searchLocalEbay(input){
  if(!env("SEARCHAPI_API_KEY") || !input.postalCode) return {items:[],market:buildMarket([]),errors:[]};
  try{
    const items=await searchSearchApiEbay({...input,localOnly:true,postalCode:input.postalCode,distanceRadius:input.distanceRadius||50});
    return {items,market:buildMarket(items),errors:[]};
  }catch(error){
    return {items:[],market:buildMarket([]),errors:[{provider:"Local eBay",message:error.message}]};
  }
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

function cacheKey(input){
  return [normalizeText(input.query),String(input.category||"").toLowerCase(),input.condition||"any",input.deepScan?"deep":"fast",input.componentEstimate?"component":"direct"].join("|");
}

function chooseProviders(input){
  const hasOfficialEbay=Boolean(env("EBAY_CLIENT_ID")&&env("EBAY_CLIENT_SECRET"));
  const condition=input.condition||"any";
  const providers=[];

  if(input.componentEstimate&&env("SERPER_API_KEY")){
    providers.push(["Serper Shopping",()=>searchSerperShopping(input)]);
    return providers;
  }

  if(condition==="used"){
    if(env("SEARCHAPI_API_KEY")) providers.push(["SearchAPI eBay",()=>searchSearchApiEbay(input)]);
    else if(hasOfficialEbay) providers.push(["eBay",()=>searchEbay(input)]);
    else if(env("SERPER_API_KEY")) providers.push(["Serper Shopping",()=>searchSerperShopping(input)]);
    else if(env("SERPAPI_API_KEY")) providers.push(["Google Shopping",()=>searchSerpApi(input)]);
    return providers;
  }

  if(condition==="open-box"){
    if(env("SEARCHAPI_API_KEY")) {
      providers.push(["SearchAPI Best Buy",()=>searchSearchApiBestBuy(input)]);
      providers.push(["SearchAPI eBay",()=>searchSearchApiEbay(input)]);
    } else if(env("BESTBUY_API_KEY")) {
      providers.push(["Best Buy",()=>searchBestBuy(input)]);
    } else if(hasOfficialEbay) {
      providers.push(["eBay",()=>searchEbay(input)]);
    } else if(env("SERPER_API_KEY")) {
      providers.push(["Serper Shopping",()=>searchSerperShopping(input)]);
    }
    return providers;
  }

  if(env("SERPER_API_KEY")) providers.push(["Serper Shopping",()=>searchSerperShopping(input)]);
  else if(env("SERPAPI_API_KEY")) providers.push(["Google Shopping",()=>searchSerpApi(input)]);

  if(input.deepScan&&env("SEARCHAPI_API_KEY")){
    providers.push(["SearchAPI Walmart",()=>searchSearchApiWalmart(input)]);
    providers.push(["SearchAPI Best Buy",()=>searchSearchApiBestBuy(input)]);
    if(condition==="any") providers.push(["SearchAPI eBay",()=>searchSearchApiEbay(input)]);
  } else if(!env("SERPER_API_KEY")&&!env("SERPAPI_API_KEY")){
    if(env("SEARCHAPI_API_KEY")){
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

export async function liveSearch(input) {
  const key=cacheKey(input);
  const hit=searchCache.get(key);
  let base;

  if(hit&&Date.now()-hit.savedAt<CACHE_MS){
    base=hit.value;
  }else{
    const providers=chooseProviders(input);
    const settled=await Promise.all(providers.map(async([name,run])=>{
      try{return await run();}
      catch(error){return {__error:true,provider:name,message:error.message};}
    }));

    const errors=[];
    let items=[];
    for(const result of settled){
      if(Array.isArray(result)) items.push(...result);
      else if(result?.__error) errors.push({provider:result.provider,message:result.message});
    }
    items=dedupe(items).filter(x=>x.relevance>=0.4);
    const market=buildMarket(items);
    base={items,market,errors};
    searchCache.set(key,{savedAt:Date.now(),value:base});
    if(searchCache.size>150){
      const oldest=[...searchCache.entries()].sort((a,b)=>a[1].savedAt-b[1].savedAt).slice(0,30);
      for(const [oldKey] of oldest) searchCache.delete(oldKey);
    }
  }

  const ranked=rankDeals(base.items,base.market,input);
  return {...base,ranked};
}
