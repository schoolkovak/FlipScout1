const KEY="flipscout-market-history-v1";

function read(){
  try{return JSON.parse(localStorage.getItem(KEY)||"{}")||{};}
  catch{return {};}
}
function write(data){try{localStorage.setItem(KEY,JSON.stringify(data));}catch{/* A history quota failure must not discard live scan results. */}}

function idFor({category,query,condition}){
  return [String(category||"").toLowerCase(),String(query||"").toLowerCase().replace(/\s+/g," ").trim(),condition||"any"].join("|");
}

export function saveMarketSnapshot(search,market){
  if(!market?.median)return null;
  const all=read();
  const id=idFor(search);
  const current=Array.isArray(all[id])?all[id]:[];
  const entry={
    at:new Date().toISOString(),
    median:Number(market.median),
    low:Number(market.low||0),
    high:Number(market.high||0),
    sampleSize:Number(market.sampleSize||0),
    bySource:market.bySource||{}
  };
  if(current.length && Date.now()-Date.parse(current.at(-1).at)<10*60*1000)return getMarketTrend(search);
  const next=[...current,entry].slice(-30);
  all[id]=next;
  write(all);
  return getMarketTrend(search);
}

export function getMarketTrend(search){
  const rows=read()[idFor(search)]||[];
  if(!rows.length)return null;
  const latest=rows[rows.length-1];
  const previous=rows.length>=2?rows[rows.length-2]:null;
  const first=rows[0];
  return {
    latest,
    previous,
    first,
    count:rows.length,
    changeSinceLast:previous?((latest.median-previous.median)/previous.median)*100:null,
    changeSinceFirst:first&&first!==latest?((latest.median-first.median)/first.median)*100:null,
    series:rows.map(x=>x.median)
  };
}
