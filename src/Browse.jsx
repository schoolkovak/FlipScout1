import React,{useEffect,useMemo,useRef,useState} from "react";
import {Box,Cpu,MemoryStick,HardDrive,CircuitBoard,Plug,Fan,Monitor,ArrowLeft,ExternalLink,RefreshCw,ChevronDown,List,Info,Flame,Bookmark,Search,Zap,TrendingDown,Filter,DollarSign,Layers} from "lucide-react";
import {track} from "@vercel/analytics";
import {PART_GROUPS,findSeries,findCatalogModel,normalizePartQuery} from "../shared/partCatalog.js";
import {SNIPER_CONDITIONS,allowsUsed} from "../shared/sniper.js";
import {getWatchlist,toggleWatchItem,saveSearch} from "./storage";
import {saveMarketSnapshot,getMarketTrend} from "./marketHistory";
import DealResults,{MarketPulse,ProviderNotes,ScanSkeleton,PriceTotal,money} from "./DealResults.jsx";
import {finalPrice,taxRate} from "./pricing.js";
import {useTaxState} from "./taxContext.js";

export function GpuIcon({size=16}){
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="6" width="20" height="11" rx="2"/><circle cx="8" cy="11.5" r="2.5"/><circle cx="16" cy="11.5" r="2.5"/><path d="M5 17v2M9 17v2M2 9H1M2 13H1"/>
  </svg>;
}
const GROUP_ICONS={case:Box,gpu:GpuIcon,cpu:Cpu,ram:MemoryStick,ssd:HardDrive,board:CircuitBoard,psu:Plug,fan:Fan,monitor:Monitor};
export function GroupIcon({icon,size=16}){const I=GROUP_ICONS[icon]||Layers;return <I size={size}/>;}

// Two independent choices: which listing to feature, and which condition.
const RANK_MODES=[{value:"cheapest",label:"Cheapest Available"},{value:"best",label:"Best Deal"}];
const COND_MODES=[{value:"any",label:"Any"},{value:"new",label:"Only New"},{value:"used",label:"Only Used"}];
const USED=new Set(["used","refurbished","renewed","open-box"]);
// Saved browse results stay on screen across visits; fresh data loads quietly
// in the background (it is read from saved snapshots, so it costs no credits).
const CACHE_MS=48*3600*1000;
const CACHE_VERSION="fs-overview-v7";

function ago(iso,now){
  if(!iso)return "";
  const s=Math.max(0,Math.round((now-Date.parse(iso))/1000));
  if(s<60)return s+"s ago";
  const m=Math.floor(s/60);
  if(m<60)return m+"m ago";
  const h=Math.floor(m/60);
  return h<48?h+"h ago":Math.floor(h/24)+"d ago";
}
function storeName(x){return x?.source||"store";}
function pickListing(row,mode={rank:"cheapest",cond:"any"}){
  let list=row?.listings||[];
  if(mode.cond==="new")list=list.filter(x=>x.condition==="new");
  if(mode.cond==="used")list=list.filter(x=>USED.has(x.condition));
  if(!list.length)return null;
  if(mode.rank==="best")return list.slice().sort((a,b)=>(b.score||0)-(a.score||0)||a.totalPrice-b.totalPrice)[0];
  return list.slice().sort((a,b)=>a.totalPrice-b.totalPrice)[0];
}
function vsMsrp(price,msrp){return msrp&&price?Math.round((price-msrp)/msrp*1000)/10:null;}
function linkLabel(item,name){return "View "+name+" on "+storeName(item);}

function readCache(key){try{const v=JSON.parse(localStorage.getItem(key)||"null");return v&&Date.now()-v.at<CACHE_MS?v:null;}catch{return null;}}
function writeCache(key,data){try{localStorage.setItem(key,JSON.stringify({at:Date.now(),data}));}catch{}}

function Spark({series}){
  if(!series||series.length<2)return null;
  const min=Math.min(...series),max=Math.max(...series),w=70,h=20;
  const pts=series.map((v,i)=>[i/(series.length-1)*w,max===min?h/2:h-(v-min)/(max-min)*h]);
  const down=series.at(-1)<=series[0];
  return <svg className={"spark "+(down?"down":"up")} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label="Your price history"><polyline points={pts.map(p=>p.join(",")).join(" ")} fill="none" strokeWidth="1.6"/></svg>;
}

function SourcesWhy({row,open=false}){
  if(!row?.sources?.length)return null;
  return <details className="mcWhy" open={open}><summary>What was searched</summary>{row.sources.map(src=><p key={src.name}><b>{src.name}</b> {src.status==="ok"?src.raw+" found → "+src.kept+" kept"+(Object.keys(src.dropped||{}).length?" · "+Object.entries(src.dropped).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([r,n])=>n+" "+r.replace(/-/g," ")).join(", "):""):src.message}</p>)}</details>;
}

function ModelCard({item,row,mode,now,loading,onSeeAll,onCond,trend}){
  const st=useTaxState();
  const rate=taxRate(st);
  const usedOk=allowsUsed(item.category);
  const [more,setMore]=useState(false);
  const pick=pickListing(row,mode);
  const delta=vsMsrp(pick?.totalPrice,item.msrp);
  const image=pick?.image||row?.image;
  if(loading&&!row)return <article className="modelCard loading"><div className="mcHead"><h3>{item.name}</h3></div><div className="mcImage shimmer"></div><i className="sk"></i><i className="sk short"></i><i className="sk"></i></article>;
  return <article className={"modelCard"+(delta!=null&&delta<0?" belowMsrp":"")}>
    <button className="mcHead" onClick={onSeeAll} title={"See every "+item.name+" listing"}><h3>{item.name}</h3><span className={"stock "+(pick?"in":row?.pending?"queued":"out")}>{pick?"IN STOCK":row?.pending?"QUEUED":"NO MATCH"}</span></button>
    <button className="mcImage" onClick={onSeeAll} aria-label={"See every "+item.name+" listing"}>{image?<img src={image} alt="" loading="lazy" referrerPolicy="no-referrer"/>:<GroupIcon icon="gpu" size={56}/>}</button>
    {pick?<>
      <a className="mcTitle" href={pick.url||undefined} target="_blank" rel="noreferrer" title={pick.title}>{pick.title}</a>
      <div className="mcSpecs">{item.specs.map(([k,v])=><div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
      <div className="mcPriceRow">
        <PriceTotal item={pick}/>
        {pick.condition!=="new"&&<span className={"condBadge c-"+pick.condition}>{pick.condition==="open-box"?"OPEN BOX":String(pick.condition).toUpperCase()}</span>}
        {delta!=null&&<em className={delta<0?"under":"over"}>{delta>0?"+":""}{delta}% MSRP</em>}
      </div>
      {usedOk&&<div className="mcSplit">
        <button className={mode.cond==="new"?"on":""} disabled={!row.newFrom} onClick={()=>onCond("new")}><span>New from</span><b>{money(row.newFrom&&row.newFrom*(1+rate),0)}</b></button>
        <button className={mode.cond==="used"?"on":""} disabled={!row.usedFrom} onClick={()=>onCond("used")}><span>Used from</span><b className="usedText">{money(row.usedFrom&&row.usedFrom*(1+rate),0)}</b></button>
      </div>}
      <div className="mcMeta"><span>Updated {ago(row?.searchedAt,now)}</span>{item.msrp?<span>(MSRP: {money(item.msrp,2)})</span>:null}<Spark series={trend}/></div>
      <div className="mcCoverage">Lowest of {row.count} listing{row.count===1?"":"s"} · {row.stores} store{row.stores===1?"":"s"}{usedOk?" · "+row.usedCount+" used":" · new only"}</div>
      <div className="mcBtns">
        <button onClick={onSeeAll}><List size={14}/>See All</button>
        <button onClick={()=>setMore(m=>!m)}>{more?"Less":"More Info"}<ChevronDown size={14} className={more?"flip":""}/></button>
      </div>
      {more&&<div className="mcMore">
        {(row.listings||[]).slice().sort((a,b)=>a.totalPrice-b.totalPrice).slice(0,10).map(x=><a key={x.id} href={x.url} target="_blank" rel="noreferrer"><span>{x.source}</span><em className={"c-"+x.condition}>{x.condition==="open-box"?"open box":x.condition}</em><b>{money(finalPrice(x,st).total,2)}</b></a>)}
        <small>{row.count} valid listings · market median {money(row.median)}</small>
        {row.byStore?.length>0&&<div className="mcStores">{row.byStore.map(([n,c])=><span key={n}>{n} <b>{c}</b></span>)}</div>}
        <SourcesWhy row={row}/>
      </div>}
      <a className="mcGo" href={pick.url||undefined} target="_blank" rel="noreferrer"><ExternalLink size={15}/>{linkLabel(pick,item.name)}</a>
    </>:row?.pending?<div className="mcEmpty"><p>Prices for this model are collected in the background and will show up after the next update.</p><button className="mcSearchNow" onClick={onSeeAll}><List size={14}/>Search it now</button></div>:<div className="mcEmpty"><p>{mode.cond==="new"?"No new listing right now.":mode.cond==="used"?"No used listing right now.":"No real store listing right now."}</p><SourcesWhy row={row}/></div>}
  </article>;
}

function DealTicker({cards}){
  if(cards.length<2)return null;
  const row=[...cards,...cards];
  return <div className="ticker" aria-label="Biggest discounts vs MSRP right now">
    <span className="tickerLabel"><Flame size={14}/>HOT</span>
    <div className="tickerTrack"><div className="tickerMove">{row.map((c,i)=><a key={i} href={c.pick.url||undefined} target="_blank" rel="noreferrer"><b>{c.item.name}</b> {money(c.pick.totalPrice)} <em className={c.delta<0?"under":"over"}>{c.delta>0?"+":""}{c.delta}%</em><span>{c.pick.source}</span></a>)}</div></div>
  </div>;
}

export function BrowsePage({providerKeys,groupId,seriesId,setRoute}){
  const {group,series}=findSeries(groupId,seriesId);
  const [rows,setRows]=useState({});
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [rank,setRank]=useState("cheapest");
  const [cond,setCond]=useState("any");
  const mode=useMemo(()=>({rank,cond}),[rank,cond]);
  const [minPrice,setMinPrice]=useState("");
  const [maxPrice,setMaxPrice]=useState("");
  const [minVram,setMinVram]=useState("");
  const [cardSort,setCardSort]=useState("catalog");
  const [now,setNow]=useState(Date.now());
  const [open,setOpen]=useState({group:true,price:true,modes:true,filters:true});
  const reqId=useRef(0);

  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[]);

  async function load(force=false){
    const key=CACHE_VERSION+":"+group.id+":"+series.id;
    const cached=!force&&readCache(key);
    const id=++reqId.current;
    setError("");
    if(cached)setRows(cached.data);
    else{setRows({});setLoading(true);}
    track("browse_series",{group:group.id,series:series.id});
    try{
      const r=await fetch("/api/parts/overview?group="+encodeURIComponent(group.id)+"&series="+encodeURIComponent(series.id),{signal:AbortSignal.timeout(58000)});
      const d=await r.json();
      if(id!==reqId.current)return;
      if(!d.available&&d.message)setError(d.message);
      const next=Object.fromEntries((d.items||[]).map(x=>[x.id,x]));
      setRows(next);
      writeCache(key,next);
      for(const item of series.items){
        const p=pickListing(next[item.name]);
        if(p)saveMarketSnapshot({category:"browse",query:item.query,condition:"cheapest"},{median:p.totalPrice,low:p.totalPrice,high:p.totalPrice,sampleSize:next[item.name].count});
      }
    }catch{if(id===reqId.current&&!cached)setError("Could not reach the price service. Try again.");}
    finally{if(id===reqId.current)setLoading(false);}
  }
  useEffect(()=>{load();},[group.id,series.id]);

  const cards=useMemo(()=>series.items.map(item=>{
    const row=rows[item.name];
    const pick=pickListing(row,mode);
    return {item,row,pick,delta:vsMsrp(pick?.totalPrice,item.msrp)};
  }).filter(c=>{
    if(minVram&&c.item.vram!=null&&c.item.vram<Number(minVram))return false;
    if(c.pick&&minPrice&&c.pick.totalPrice<Number(minPrice))return false;
    if(c.pick&&maxPrice&&c.pick.totalPrice>Number(maxPrice))return false;
    return true;
  }).sort((a,b)=>cardSort==="price"?(a.pick?.totalPrice??1e9)-(b.pick?.totalPrice??1e9):cardSort==="msrp"?(a.delta??1e9)-(b.delta??1e9):0),[series,rows,mode,minPrice,maxPrice,minVram,cardSort]);
  const hot=cards.filter(c=>c.pick&&c.delta!=null).sort((a,b)=>a.delta-b.delta).slice(0,6);
  const loadedAt=Object.values(rows).map(x=>x.searchedAt).filter(Boolean).sort().at(-1);
  const toggle=k=>setOpen(o=>({...o,[k]:!o[k]}));
  const usedGroup=allowsUsed(series.items[0]?.category);
  useEffect(()=>{if(!usedGroup)setCond("any");},[usedGroup]);
  // Phones: the sidebar folds into a drawer so the price cards come first.
  const [drawer,setDrawer]=useState(false);
  useEffect(()=>setDrawer(false),[group.id,series.id]);

  return <div className="browse">
    <button className="drawerBtn" onClick={()=>setDrawer(d=>!d)} aria-expanded={drawer}><Filter size={15}/><span>{series.label}</span><small>Series, models & filters</small><ChevronDown size={16} className={drawer?"flip":""}/></button>
    <aside className={"sidebar"+(drawer?" open":"")}>
      <section className="sideBox">
        <button className="sideHead" onClick={()=>toggle("group")}><Layers size={15}/>Part Group<ChevronDown size={15} className={open.group?"flip":""}/></button>
        {open.group&&<div className="seriesList">
          {group.series.map(s=><button key={s.id} className={"seriesBtn"+(s.id===series.id?" on":"")+(s.brand?" b-"+s.brand:"")} onClick={()=>setRoute({page:"browse",group:group.id,series:s.id})}><Zap size={13}/>{s.label}</button>)}
        </div>}
      </section>
      <section className="sideBox">
        <button className="sideHead" onClick={()=>toggle("models")}><List size={15}/>Models<ChevronDown size={15} className={open.models!==false?"flip":""}/></button>
        {open.models!==false&&<div className="modelList">
          {series.items.map(it=>{const p=pickListing(rows[it.name],mode);return <button key={it.name} className="modelBtn" onClick={()=>setRoute({page:"model",group:group.id,series:series.id,model:it.name})}><span>{it.name}</span><b>{p?money(p.totalPrice):"—"}</b></button>;})}
          <small className="sideLabel">Pick a model to see every listing, ranked by price or value.</small>
        </div>}
      </section>
      <section className="sideBox">
        <button className="sideHead" onClick={()=>toggle("price")}><DollarSign size={15}/>Price<ChevronDown size={15} className={open.price?"flip":""}/></button>
        {open.price&&<><small className="sideLabel">Price Range</small><div className="rangeRow"><input inputMode="numeric" placeholder="Min" value={minPrice} onChange={e=>setMinPrice(e.target.value.replace(/[^\d.]/g,""))}/><input inputMode="numeric" placeholder="Max" value={maxPrice} onChange={e=>setMaxPrice(e.target.value.replace(/[^\d.]/g,""))}/></div>
</>}
      </section>
      <section className="sideBox">
        <div className="sideHead static"><Zap size={15}/>Show <span className="tip" title="Which listing each card features. Switching never re-searches."><Info size={12}/></span></div>
        <div className="modeRow">{RANK_MODES.map(m=><button key={m.value} className={rank===m.value?"on":""} onClick={()=>setRank(m.value)}>{m.label}</button>)}</div>
      </section>
      {usedGroup&&<section className="sideBox">
        <div className="sideHead static"><Filter size={15}/>Condition</div>
        <div className="modeRow three">{COND_MODES.map(m=><button key={m.value} className={cond===m.value?"on":""} onClick={()=>setCond(m.value)}>{m.label}</button>)}</div>
      </section>}
      <section className="sideBox">
        <button className="sideHead" onClick={()=>toggle("filters")}><Filter size={15}/>Filters<ChevronDown size={15} className={open.filters?"flip":""}/></button>
        {open.filters&&<>
          {group.id==="gpu"&&<><small className="sideLabel">Minimum VRAM (GB)</small><input inputMode="numeric" placeholder="(Like 12GB)" value={minVram} onChange={e=>setMinVram(e.target.value.replace(/\D/g,""))}/></>}
          <small className="sideLabel">Sort cards</small>
          <select value={cardSort} onChange={e=>setCardSort(e.target.value)}><option value="catalog">Model tier</option><option value="price">Price: low to high</option><option value="msrp">Biggest discount vs MSRP</option></select>
        </>}
      </section>
      <p className="sideNote">Every listing links to a real item page on a trusted store. eBay listings come from eBay's official API, so they are live Buy It Now listings. Sold, for-parts, broken, scam-priced and mismatched listings are removed.</p>
    </aside>

    <section className="browseMain">
      <h1 className="pageTitle">Track {series.label} {group.label} Prices</h1>
      <p className="pageSub">New and used prices from Amazon, Best Buy, Newegg, Walmart, eBay, AliExpress, Micro Center, B&amp;H and more — the cheapest real listing per model, checked against launch MSRP.</p>
      <div className="crumbBar">
        <button className="backBtn" onClick={()=>setRoute({page:"browse",group:group.id,series:group.series[0].id})}><ArrowLeft size={15}/>{group.label}</button>
        <div className="crumbs"><span>{group.label}</span><b>›</b><strong>{series.label}</strong><em>{series.items.length} models{loadedAt?" | Last updated "+new Date(loadedAt).toLocaleTimeString():""}</em></div>
        <span className="autoNote"><RefreshCw size={13}/>Prices update automatically in the background</span>
      </div>
      <DealTicker cards={hot}/>
      {error&&<div className="notice"><Info size={18}/><div><b>{error}</b></div></div>}
      <div className="modelGrid">
        {cards.map(c=><ModelCard key={c.item.name} item={c.item} row={c.row} mode={mode} now={now} loading={loading}
          onCond={setCond}
          trend={getMarketTrend({category:"browse",query:c.item.query,condition:"cheapest"})?.series}
          onSeeAll={()=>setRoute({page:"model",group:group.id,series:series.id,model:c.item.name})}/>)}
      </div>
      {!cards.length&&<div className="emptyState">No models match these filters.</div>}
    </section>
  </div>;
}

export function guessCategory(q){
  const s=String(q||"").toLowerCase();
  if(/\b(rtx|gtx|rx\s?\d|radeon|geforce|arc\s?[ab]\d)/.test(s)||/^\s*\d{3,4}\s*(ti|super|xtx?|gre)?\s*$/.test(s))return "GPU";
  if(/\b(ryzen|core\s?i[3579]|i[3579][-\s]\d|core ultra|threadripper)/.test(s))return "CPU";
  if(/\bddr[345]\b|\bram\b|memory/.test(s))return "RAM / Memory";
  if(/\bnvme\b|\bm\.?2\b/.test(s))return "NVMe SSD";
  if(/\bsata\b/.test(s)&&/\bssd\b/.test(s))return "SATA SSD";
  if(/\bssd\b|solid state/.test(s))return "SSD / NVMe";
  if(/\bhdd\b|hard drive/.test(s))return "Hard Drive / HDD";
  if(/\b[abxz]\d{3}[a-z]?\b|motherboard/.test(s))return "Motherboard";
  if(/\b\d{3,4}\s?w\b|\bpsu\b|power supply/.test(s))return "Power Supply / PSU";
  if(/\baio\b|liquid cooler/.test(s))return "AIO Liquid Cooler";
  if(/cooler/.test(s))return "CPU Air Cooler";
  if(/monitor|\b\d{3}hz\b/.test(s))return "Monitor";
  return "Other";
}

// Plain-language versions of provider errors.
function friendly(msg){
  const m=String(msg||"");
  if(/out of credits|not enough credits|quota/i.test(m))return "Live search is paused because today's search credits are used up. Saved prices keep updating in the background — check back later.";
  if(/timed out|network error|unavailable|failed/i.test(m))return "The price service didn't answer in time. Try again in a minute.";
  if(/no listing matched|no .* listings in the latest update/i.test(m))return "Nothing matching this exact model and condition was for sale at a trusted store in the latest check. Try another condition, or check back after the next update.";
  return m||"Nothing found yet. Prices update in the background — check back soon.";
}

export function ModelPage({providerKeys,route,setRoute,onWatchChange}){
  const {group,series}=findSeries(route.group,route.series);
  const typed=route.query?normalizePartQuery(route.query):"";
  const item=series.items.find(x=>x.name===route.model)||(typed?(findCatalogModel(typed)?.item||{name:typed,query:typed,category:guessCategory(typed),specs:[],msrp:null}):series.items[0]);
  const [condition,setCondition]=useState("any");
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  const [watched,setWatched]=useState(()=>getWatchlist());

  // Last results stay on screen across visits; the refresh reads saved
  // snapshots (free) and only searches live for models never saved yet.
  async function scan(){
    const key="fs-model-v1:"+item.name+":"+item.query+":"+condition;
    const cached=readCache(key);
    if(cached)setData(cached.data);else{setLoading(true);setData(null);}
    track("full_scan",{query:item.query});
    try{
      const qs=new URLSearchParams({q:item.query,category:item.category,condition,msrp:String(item.msrp||0)});
      if(item.specs?.length)qs.set("model",item.name);
      const r=await fetch("/api/deals/search?"+qs.toString(),{signal:AbortSignal.timeout(58000)});
      const d=await r.json();
      if(d.available||!cached){setData(d);if(d.available)writeCache(key,d);}
    }catch{if(!cached)setData({available:false,message:"Price service is unavailable. Try again in a minute."});}
    finally{setLoading(false);}
  }
  useEffect(()=>{scan();},[item.query,condition]);

  function toggle(x){const out=toggleWatchItem({...x,category:item.category,query:item.query});setWatched(out.items);onWatchChange?.();}
  const isWatched=x=>watched.some(w=>(w.url||w.id||w.title)===(x.url||x.id||x.title));
  const st=useTaxState();
  const cheapest=data?.results?.length?Math.min(...data.results.map(x=>x.totalPrice)):null;
  const cheapestFinal=data?.results?.length?Math.min(...data.results.map(x=>finalPrice(x,st).total)):null;
  const delta=vsMsrp(cheapest,item.msrp);

  return <div className="modelPage">
    <div className="crumbBar">
      <button className="backBtn" onClick={()=>setRoute(route.query?{page:"browse"}:{page:"browse",group:group.id,series:series.id})}><ArrowLeft size={15}/>Go Back<small>Return to product group</small></button>
      <div className="crumbs">{route.query?<><span>Search</span><b>›</b><strong>{item.name}</strong></>:<><span>{group.label}</span><b>›</b><span>{series.label}</span><b>›</b><strong>{item.name}</strong></>}</div>
      {!route.query&&<select className="modelSwitch" value={item.name} onChange={e=>setRoute({page:"model",group:group.id,series:series.id,model:e.target.value})} aria-label="Switch model">{series.items.map(x=><option key={x.name}>{x.name}</option>)}</select>}
    </div>
    <section className="modelHero">
      <div>
        <h1 className="pageTitle left">{item.name}</h1>
        <div className="heroSpecs">{item.specs.map(([k,v])=><span key={k}>{k} <b>{v}</b></span>)}{item.msrp&&<span>MSRP <b>{money(item.msrp)}</b></span>}</div>
      </div>
      <div className="heroRight">
        {cheapest!=null&&<div className="heroPrice"><small>Lowest price (tax & shipping)</small><strong>{money(cheapestFinal,2)}</strong>{delta!=null&&<em className={delta<0?"under":"over"}>{delta>0?"+":""}{delta}% vs MSRP</em>}</div>}
        <div className="heroControls">
          {allowsUsed(item.category)?<select value={condition} onChange={e=>setCondition(e.target.value)} aria-label="Condition">{SNIPER_CONDITIONS.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select>:<span className="newOnly">New only</span>}
          <button className="ghostBtn" onClick={()=>{saveSearch({category:item.category,query:item.query,condition,sortBy:"lowest"});onWatchChange?.();}}><Bookmark size={14}/>Save</button>

        </div>
      </div>
    </section>
    {data?.searchedAt&&<p className="snapNote">Prices updated {ago(data.searchedAt,Date.now())}{data.snapshot?" · refreshed automatically in the background":""}</p>}
    {loading&&<ScanSkeleton label={item.name+" — every real listing across trusted stores"}/>}
    {data&&!data.available&&<div className="notice"><Info size={18}/><div><b>No listings for {item.name} right now</b><p>{friendly(data.message)}</p><ProviderNotes providers={data.providers} coverage={data.coverage} errors={data.errors}/></div></div>}
    {data?.available&&<section className="resultsPanel">
      <MarketPulse market={data.market} results={data.results}/>
      <DealResults results={data.results} isWatched={isWatched} onWatch={toggle} msrp={item.msrp}/>
      <ProviderNotes providers={data.providers} coverage={data.coverage} errors={data.errors}/>
    </section>}
  </div>;
}

export function CategoryPills({groupId,onPick}){
  return <div className="catPills">{PART_GROUPS.map(g=><button key={g.id} className={"catPill"+(g.id===groupId?" on":"")} onClick={()=>onPick(g)}><GroupIcon icon={g.icon}/>{g.label}</button>)}</div>;
}

export {TrendingDown};
