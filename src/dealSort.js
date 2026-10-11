// Pure, deterministic client-side deal comparison.
// Neither sorting nor filtering ever contacts marketplace providers.
export function offerTotal(item){
  const price=Number(item?.totalPrice);
  return Number.isFinite(price)&&price>0?price:Infinity;
}
export function savingsPercent(item){
  const price=offerTotal(item);
  if(!Number.isFinite(price))return null;
  const msrp=Number(item?.msrp);
  if(Number.isFinite(msrp)&&msrp>0)return (msrp-price)/msrp*100;
  const median=Number(item?.comparedMarketMedian);
  if(Number.isFinite(median)&&median>0)return (median-price)/median*100;
  return null;
}
export function offerReference(item){
  const msrp=Number(item?.msrp);
  if(msrp>0)return {price:msrp,type:"manufacturer starting MSRP",source:item?.msrpSource||null};
  const median=Number(item?.comparedMarketMedian);
  if(median>0)return {price:median,type:"sampled market median",source:null};
  return null;
}
export function dedupeOffers(offers){
  const records=new Map();
  for(const offer of offers||[]){
    if(!offer?.url || !Number.isFinite(offerTotal(offer)))continue;
    // A link found by multiple model queries is one offer, not many different deals.
    const key=offer.url.replace(/\?.*$/,"");
    const prior=records.get(key);
    if(!prior || Date.parse(offer.checkedAt||0)>Date.parse(prior.checkedAt||0))records.set(key,offer);
  }
  return [...records.values()];
}
export function filterOffers(offers,{category="All",model="all",store="all",condition="any",minimum=0,maximum=0}={}){
  const min=Number(minimum)||0,max=Number(maximum)||0;
  return (offers||[]).filter(item=>
    (category==="All"||item.category===category)&&
    (model==="all"||item.discoveryId===model)&&
    (store==="all"||item.marketplace===store)&&
    (condition==="any"||item.condition===condition)&&
    offerTotal(item)>=min&&(!max||offerTotal(item)<=max)
  );
}
export function sortOffers(offers,mode="best"){
  return [...(offers||[])].sort((a,b)=>{
    if(mode==="price")return offerTotal(a)-offerTotal(b)||String(a.title).localeCompare(String(b.title));
    if(mode==="newest")return (Date.parse(b.checkedAt||b.freshness||0)||0)-(Date.parse(a.checkedAt||a.freshness||0)||0);
    const ap=savingsPercent(a),bp=savingsPercent(b);
    if(ap!==null&&bp!==null&&Math.abs(ap-bp)>.001)return bp-ap;
    if(ap!==null&&bp===null)return -1;
    if(bp!==null&&ap===null)return 1;
    // No comparable reference: prefer known delivered costs over unknown shipping.
    if(Boolean(a.shippingKnown)!==Boolean(b.shippingKnown))return a.shippingKnown?-1:1;
    return offerTotal(a)-offerTotal(b);
  });
}
