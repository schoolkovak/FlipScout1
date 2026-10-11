import React,{useEffect,useMemo,useRef,useState} from "react";
import {CORE_DISCOVERY_TARGETS as DISCOVERY_TARGETS,CORE_PC_CATEGORIES} from "../shared/discovery.js";
import {SNIPER_CATEGORIES,SNIPER_MARKETPLACES} from "../shared/sniper.js";

const STORE_KEY="flipscout-automatic-discovery-core-v1";
const BATCH=5;
const INTERVAL_MS=15*60*1000;
const HOURLY_INTERVAL_MS=Math.max(20000,Math.floor(3600000/Math.ceil(DISCOVERY_TARGETS.length/BATCH)));
const MAX_AGE_MS=72*60*60*1000;
const storeNames=new Map(SNIPER_MARKETPLACES.map(x=>[x.id,x.name]));

function loadCatalog(){
  try{
    const stored=JSON.parse(localStorage.getItem(STORE_KEY)||"{}");
    if(!stored||typeof stored!=="object")return {};
    const validIds=new Set(DISCOVERY_TARGETS.map(x=>x.id));
    return Object.fromEntries(Object.entries(stored).filter(([id,row])=>
      validIds.has(id)&&row?.checkedAt&&Date.now()-Date.parse(row.checkedAt)<MAX_AGE_MS
    ));
  }catch{return {};}
}
function dollars(value){
  return Number.isFinite(Number(value))?new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(Number(value)):"—";
}
function isHealthy(item){
  return item?.url?.startsWith("https://")&&Number.isFinite(Number(item.totalPrice))&&Number(item.totalPrice)>0;
}

export default function AutomaticDiscovery({providerKeys}){
  const [catalog,setCatalog]=useState(loadCatalog);
  const [position,setPosition]=useState(0);
  const [auto,setAuto]=useState(true);
  const [hourly,setHourly]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [category,setCategory]=useState("All");
  const [requestedCategory,setRequestedCategory]=useState(null);
  const [variation,setVariation]=useState("all");
  const [store,setStore]=useState("all");
  const [condition,setCondition]=useState("any");
  const [sort,setSort]=useState("score");
  const [limit,setLimit]=useState(24);
  const busyRef=useRef(false);
  const positionRef=useRef((()=>{
    try{return Math.max(0,Number(localStorage.getItem("flipscout-catalog-position")||0))%DISCOVERY_TARGETS.length;}
    catch{return 0;}
  })());
  const mountedRef=useRef(true);
  const scanRef=useRef(null);
  const parts=CORE_PC_CATEGORIES;
  const variations=useMemo(()=>DISCOVERY_TARGETS.filter(x=>category!=="All"&&x.category===category),[category]);
  useEffect(()=>{mountedRef.current=true;return()=>{mountedRef.current=false;}},[]);
  useEffect(()=>{
    try{localStorage.setItem(STORE_KEY,JSON.stringify(catalog));}catch{}
  },[catalog]);

  async function scanBatch(priorityCategory=null){
    if(busyRef.current||document.visibilityState==="hidden")return;
    busyRef.current=true;
    setBusy(true);
    setError("");
    const start=positionRef.current;
    const unsampled=priorityCategory?DISCOVERY_TARGETS.filter(x=>x.category===priorityCategory):[];
    const targets=priorityCategory?
      unsampled.filter(x=>!catalog[x.id]||Date.now()-Date.parse(catalog[x.id].checkedAt)>60*60*1000).slice(0,BATCH):
      Array.from({length:BATCH},(_,offset)=>DISCOVERY_TARGETS[(start+offset)%DISCOVERY_TARGETS.length]);
    if(!targets.length){busyRef.current=false;setBusy(false);setRequestedCategory(null);return;}
    try{
      const response=await fetch("/api/parts/sniper",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          targets,marketplaces:SNIPER_MARKETPLACES.map(x=>x.id),deepScan:false,providerKeys
        }),
        signal:AbortSignal.timeout(55000)
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.message||"Search failed");
      if(!Array.isArray(data.results))throw new Error(data.message||"No search data was returned");
      const checkedAt=new Date().toISOString();
      const updates={};
      for(const group of data.results){
        updates[group.id]={
          checkedAt,
          results:(group.results||[]).filter(isHealthy).slice(0,12),
          sourceCoverage:group.sourceCoverage||[],
          errors:group.errors||[]
        };
      }
      if(!mountedRef.current)return;
      setCatalog(prev=>({...prev,...updates}));
      if(!priorityCategory)positionRef.current=(start+BATCH)%DISCOVERY_TARGETS.length;
      try{localStorage.setItem("flipscout-catalog-position",String(positionRef.current));}catch{}
      setPosition(positionRef.current);
      setRequestedCategory(null);
    }catch(e){
      if(mountedRef.current){
        setError(String(e?.message||"Unable to scan parts"));
        setRequestedCategory(null);
        setAuto(false);
      }
    }finally{
      busyRef.current=false;
      if(mountedRef.current)setBusy(false);
    }
  }
  scanRef.current=scanBatch;
  useEffect(()=>{scanRef.current?.()},[]);
  useEffect(()=>{
    if(!auto)return;
    const interval=window.setInterval(()=>{
      if(document.visibilityState==="visible")scanRef.current?.();
    },hourly?HOURLY_INTERVAL_MS:INTERVAL_MS);
    return ()=>window.clearInterval(interval);
  },[auto,hourly]);

  const checked=DISCOVERY_TARGETS.filter(x=>catalog[x.id]).length;
  const checkedCategories=new Set(DISCOVERY_TARGETS.filter(x=>catalog[x.id]).map(x=>x.category)).size;
  const offers=DISCOVERY_TARGETS.filter(target=>(category==="All"||target.category===category)&&(variation==="all"||target.id===variation))
    .flatMap(target=>(catalog[target.id]?.results||[]).map(item=>({
      ...item,category:target.category,subtype:target.query,checkedAt:catalog[target.id].checkedAt
    })))
    .filter(item=>(store==="all"||item.marketplace===store)&&(condition==="any"||item.condition===condition));
  const unique=[...new Map(offers.map(item=>[item.url,item])).values()];
  const storeCounts=Object.fromEntries(SNIPER_MARKETPLACES.map(x=>[x.id,new Set(offers.filter(item=>item.marketplace===x.id).map(item=>item.url)).size]));
  function savingsPct(item){
    if(item.msrp && Number(item.msrp)>0)return (item.msrp-item.totalPrice)/item.msrp*100;
    if(item.comparedMarketMedian && Number(item.comparedMarketMedian)>0)return (item.comparedMarketMedian-item.totalPrice)/item.comparedMarketMedian*100;
    return -999;
  }
  // Client-only sorting: never issues another retailer/provider call.
  unique.sort(sort==="price"?(a,b)=>a.totalPrice-b.totalPrice:
    (a,b)=>savingsPct(b)-savingsPct(a)||a.totalPrice-b.totalPrice);
  const newest=Object.values(catalog).map(x=>x.checkedAt).sort().at(-1);
  const categoryTargets=DISCOVERY_TARGETS.filter(t=>category==="All"||t.category===category);
  const categoryChecked=categoryTargets.filter(t=>catalog[t.id]).length;
  function selectPart(part){
    setCategory(part);setVariation("all");setLimit(24);
    if(part!=="All"){
      const unchecked=DISCOVERY_TARGETS.some(t=>t.category===part&&!catalog[t.id]);
      if(unchecked && !busyRef.current){
        setRequestedCategory(part);
        scanRef.current?.(part);
      }
    }
  }
  const totalPages=Math.ceil(DISCOVERY_TARGETS.length/BATCH);
  const scanInterval=hourly?HOURLY_INTERVAL_MS:INTERVAL_MS;

  return <section className="discoveryBoard">
    <div className="discoveryHeader">
      <div>
        <span className="eyebrow">AUTOMATIC PART DISCOVERY</span>
        <h2>THE LIVE DEAL BOARD<span>.</span></h2>
        <p>Browse currently discovered listings without typing a query. Price rankings only compare loaded results; no scanner can guarantee the absolute lowest offer without complete marketplace coverage.</p>
      </div>
      <div className="discoveryStats">
        <div><strong>{DISCOVERY_TARGETS.length}</strong><small>Build part variations</small></div>
        <div><strong>{checked}</strong><small>Subtypes checked</small></div>
        <div><strong>{unique.length}</strong><small>Matching offers</small></div>
      </div>
    </div>

    <div className="discoveryControls">
      <div className="discoveryStatus">
        <span className={auto?"pulseDot active":"pulseDot"}/>
        <div><b>{busy?"Checking live listings":auto?"Rolling scan enabled":"Rolling scan paused"}</b>
          <small>{checkedCategories} of {SNIPER_CATEGORIES.length} categories observed · {newest?"Last update "+new Date(newest).toLocaleString():"Not scanned yet"}</small>
        </div>
      </div>
      <button className="secondary small" onClick={()=>setAuto(x=>!x)}>{auto?"Pause":"Resume"} auto-scan</button>
      <button className="primary small" onClick={()=>scanRef.current?.()} disabled={busy}>{busy?"Scanning…":"Scan next 5 models"}</button>
      <label className="discoveryHourlyToggle"><input type="checkbox" checked={hourly} onChange={e=>{setHourly(e.target.checked);setAuto(true)}}/> Hourly full-catalog mode</label>
    </div>
    <div className="discoveryProgress"><div style={{width:(100*checked/DISCOVERY_TARGETS.length)+"%"}}/></div>
    <p className="discoveryDisclaimer">{hourly?"High-usage mode: "+DISCOVERY_TARGETS.length+" model searches per hourly cycle (potentially several provider calls per model). Next 5-model batch approximately every "+Math.ceil(scanInterval/1000)+" seconds.":"Economy mode: 5 models every 15 minutes. Enable hourly mode for a complete one-hour sweep."} Scans only while this browser tab is open and visible. Sorting and filtering do not search again. Stored results expire after 72 hours and may no longer be available.</p>
    {error&&<div className="discoveryError">{error}</div>}


    <div className="componentTabs"><button className={category==="All"?"active":""} onClick={()=>selectPart("All")}>All PC parts</button>{parts.map(part=><button key={part} className={category===part?"active":""} onClick={()=>selectPart(part)}>{part}</button>)}</div>
    <div className="discoveryFilters">
      <label>PC components<select value={category} onChange={e=>selectPart(e.target.value)}>
        <option value="All">All PC parts ({parts.length})</option>{parts.map(part=><option key={part} value={part}>{part}</option>)}
      </select></label>
      <label>Model / variation<select value={variation} disabled={category==="All"} onChange={e=>{setVariation(e.target.value);setLimit(24)}}>
        <option value="all">All variations ({variations.length})</option>{variations.map(item=><option value={item.id} key={item.id}>{item.query}</option>)}
      </select></label>
      <label>Store<select value={store} onChange={e=>{setStore(e.target.value);setLimit(24)}}>
        <option value="all">All stores</option>{SNIPER_MARKETPLACES.map(x=><option value={x.id} key={x.id}>{x.name} ({storeCounts[x.id]||0})</option>)}
      </select></label>
      <label>Condition<select value={condition} onChange={e=>{setCondition(e.target.value);setLimit(24)}}>
        <option value="any">Any working condition</option><option value="new">New</option><option value="used">Used</option><option value="open-box">Open box</option><option value="refurbished">Refurbished</option><option value="renewed">Renewed</option>
      </select></label>
      <label>Sort loaded deals<select value={sort} onChange={e=>setSort(e.target.value)}>
        <option value="score">Best savings first</option><option value="price">Lowest total price</option>
      </select></label>
    </div>
    <p className="discoverySortingNote">Sorting, part and variation filters only rearrange offers already loaded; only scan controls contact live providers.</p>
    <div className="discoveryCoverage">{SNIPER_MARKETPLACES.map(x=><span key={x.id} className={storeCounts[x.id]?"hasOffers":"noOffers"}>{x.name} <b>{storeCounts[x.id]||"—"}</b></span>)}</div>

    {!unique.length?<div className="discoveryEmpty">{requestedCategory===category?"Searching "+category+" offers now…":categoryChecked===0?"This component has not finished a scan. Select the component to search it now, or let the rolling catalog reach it.":"No qualifying listings have been returned for the selected part and filters. This does not mean no offers exist."}</div>:
      <div className="discoveryGrid">{unique.slice(0,limit).map(item=><article className="discoveryCard" key={item.url}>
        <div className="discoveryCardTop">
          <span>{storeNames.get(item.marketplace)||item.source}</span>
          <span className="discoveryCondition">{item.condition||"Condition unknown"}</span>
        </div>
        <div className="discoveryCardImage">
          {item.imageUrl?<img src={item.imageUrl} alt={item.title||"PC component"} loading="lazy" referrerPolicy="no-referrer"/>:<span className="discoveryImagePlaceholder">PC PART</span>}
        </div>
        <h3>{item.title}</h3>
        <p className="discoverySubtype">{item.category} / {item.subtype}</p>
        <div className="discoveryPrice">{dollars(item.totalPrice)}
          <small>{item.shippingKnown?"Total including known shipping":"Shipping unconfirmed — final total may be higher"}</small>
        </div>
        <div className="discoverySavings">
          {item.msrp?<><strong className={item.percentVsMsrp>=0?"discountPositive":"discountNegative"}>{Math.abs(item.percentVsMsrp)}% {item.percentVsMsrp>=0?"below":"above"} launch MSRP</strong><span>Reference MSRP: {dollars(item.msrp)}</span></>:
            <><strong>MSRP not verified</strong><span>Reference price unavailable for this exact model</span></>}
          {item.comparedMarketMedian>0&&<span>{item.percentVsMarket>=0?item.percentVsMarket+"% below":Math.abs(item.percentVsMarket)+"% above"} current sampled market · median {dollars(item.comparedMarketMedian)}</span>}
        </div>
        <div className="discoveryDetails"><span>{item.evidenceSampleSize||0} price comparisons</span><span>Checked {new Date(item.checkedAt).toLocaleTimeString()}</span></div>
        {item.riskFlags?.length>0&&<div className="discoveryRisk">{item.riskFlags[0]}</div>}
        {item.msrpSource&&<a className="discoveryMsrpSource" href={item.msrpSource} target="_blank" rel="noopener noreferrer">Reference MSRP source ↗</a>}
        <a className="discoveryBuyLink" href={item.url} target="_blank" rel="noopener noreferrer">VIEW AT {String(storeNames.get(item.marketplace)||item.source||"STORE").toUpperCase()} ↗</a>
      </article>)}</div>}
    {limit<unique.length&&<button className="secondary discoveryMore" onClick={()=>setLimit(l=>l+24)}>Show more deals ({unique.length-limit} remaining)</button>}
  </section>;
}
