import React,{useEffect,useMemo,useRef,useState} from "react";
import {Cpu,MemoryStick,HardDrive,CircuitBoard,Plug,Fan,Monitor,ArrowLeft,ExternalLink,RefreshCw,ChevronDown,List,Info,Flame,Bookmark,Search,Zap,TrendingDown,Filter,DollarSign,Layers} from "lucide-react";
import {track} from "@vercel/analytics";
import {PART_GROUPS,findSeries} from "../shared/partCatalog.js";
import {SNIPER_CONDITIONS,allowsUsed} from "../shared/sniper.js";
import {getWatchlist,toggleWatchItem,saveSearch} from "./storage";
import {saveMarketSnapshot,getMarketTrend} from "./marketHistory";
import DealResults,{MarketPulse,ProviderNotes,ScanSkeleton,money} from "./DealResults.jsx";

export function GpuIcon({size=16}){
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="6" width="20" height="11" rx="2"/><circle cx="8" cy="11.5" r="2.5"/><circle cx="16" cy="11.5" r="2.5"/><path d="M5 17v2M9 17v2M2 9H1M2 13H1"/>
  </svg>;
}
const GROUP_ICONS={gpu:GpuIcon,cpu:Cpu,ram:MemoryStick,ssd:HardDrive,board:CircuitBoard,psu:Plug,fan:Fan,monitor:Monitor};
export function GroupIcon({icon,size=16}){const I=GROUP_ICONS[icon]||Layers;return <I size={size}/>;}

const PRICING_MODES=[
  {value:"cheapest",label:"Cheapest Available"},
  {value:"best",label:"Best Deal"},
  {value:"new",label:"Only New"},
  {value:"used",label:"Only Used"}
];
const USED=new Set(["used","refurbished","renewed","open-box"]);
const CACHE_MS=15*60*1000;
const CACHE_VERSION="fs-overview-v2";

function ago(iso,now){
  if(!iso)return "";
  const s=Math.max(0,Math.round((now-Date.parse(iso))/1000));
  if(s<60)return s+"s ago";
  const m=Math.floor(s/60);
  return m<60?m+"m "+String(s%60).padStart(2,"0")+"s ago":Math.floor(m/60)+"h ago";
}
function storeName(x){return x?.source||"store";}
function pickListing(row,mode){
  const list=row?.listings||[];
  if(!list.length)return null;
  if(mode==="new")return list.filter(x=>x.condition==="new").sort((a,b)=>a.totalPrice-b.totalPrice)[0]||null;
  if(mode==="used")return list.filter(x=>USED.has(x.condition)).sort((a,b)=>a.totalPrice-b.totalPrice)[0]||null;
  if(mode==="best")return list.slice().sort((a,b)=>(b.score||0)-(a.score||0)||a.totalPrice-b.totalPrice)[0];
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

function ModelCard({item,row,mode,now,loading,onSeeAll,onMode,trend}){
  const usedOk=allowsUsed(item.category);
  const [more,setMore]=useState(false);
  const pick=pickListing(row,mode);
  const delta=vsMsrp(pick?.totalPrice,item.msrp);
  const image=pick?.image||row?.image;
  if(loading&&!row)return <article className="modelCard loading"><div className="mcHead"><h3>{item.name}</h3></div><div className="mcImage shimmer"></div><i className="sk"></i><i className="sk short"></i><i className="sk"></i></article>;
  return <article className={"modelCard"+(delta!=null&&delta<0?" belowMsrp":"")}>
    <div className="mcHead"><h3>{item.name}</h3><span className={"stock "+(pick?"in":"out")}>{pick?"IN STOCK":"NO MATCH"}</span></div>
    <div className="mcImage">{image?<img src={image} alt="" loading="lazy" referrerPolicy="no-referrer"/>:<GroupIcon icon="gpu" size={56}/>}</div>
    {pick?<>
      <a className="mcTitle" href={pick.url||undefined} target="_blank" rel="noreferrer" title={pick.title}>{pick.title}</a>
      <div className="mcSpecs">{item.specs.map(([k,v])=><div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
      <div className="mcPriceRow">
        <strong>{money(pick.totalPrice,2)}</strong>
        {pick.condition!=="new"&&<span className={"condBadge c-"+pick.condition}>{pick.condition==="open-box"?"OPEN BOX":String(pick.condition).toUpperCase()}</span>}
        {delta!=null&&<em className={delta<0?"under":"over"}>{delta>0?"+":""}{delta}% MSRP</em>}
      </div>
      {usedOk&&<div className="mcSplit">
        <button className={mode==="new"?"on":""} disabled={!row.newFrom} onClick={()=>onMode("new")}><span>New from</span><b>{money(row.newFrom,0)}</b></button>
        <button className={mode==="used"?"on":""} disabled={!row.usedFrom} onClick={()=>onMode("used")}><span>Used from</span><b className="usedText">{money(row.usedFrom,0)}</b></button>
      </div>}
      <div className="mcMeta"><span>Updated {ago(row?.searchedAt,now)}</span>{item.msrp?<span>(MSRP: {money(item.msrp,2)})</span>:null}<Spark series={trend}/></div>
      <div className="mcCoverage">Lowest of {row.count} listing{row.count===1?"":"s"} · {row.stores} store{row.stores===1?"":"s"}{usedOk?" · "+row.usedCount+" used":" · new only"}</div>
      <div className="mcBtns">
        <button onClick={onSeeAll}><List size={14}/>See All</button>
        <button onClick={()=>setMore(m=>!m)}>{more?"Less":"More Info"}<ChevronDown size={14} className={more?"flip":""}/></button>
      </div>
      {more&&<div className="mcMore">
        {(row.listings||[]).slice().sort((a,b)=>a.totalPrice-b.totalPrice).slice(0,10).map(x=><a key={x.id} href={x.url} target="_blank" rel="noreferrer"><span>{x.source}</span><em className={"c-"+x.condition}>{x.condition==="open-box"?"open box":x.condition}</em><b>{money(x.totalPrice,2)}</b></a>)}
        <small>{row.count} valid listings · market median {money(row.median)}</small>
      </div>}
      <a className="mcGo" href={pick.url||undefined} target="_blank" rel="noreferrer"><ExternalLink size={15}/>{linkLabel(pick,item.name)}</a>
    </>:<div className="mcEmpty"><p>{mode==="new"?"No new listing found in this scan.":mode==="used"?"No used listing found in this scan.":"No trusted listing with a real item link in this scan."}</p><button onClick={onSeeAll}><Search size={14}/>Run full scan</button></div>}
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
  const [mode,setMode]=useState("cheapest");
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
    if(cached){setRows(cached.data);setError("");return;}
    const id=++reqId.current;
    setLoading(true);setError("");setRows({});
    track("browse_series",{group:group.id,series:series.id});
    try{
      const r=await fetch("/api/parts/overview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:series.items.map(x=>({id:x.name,query:x.query,category:x.category})),providerKeys}),signal:AbortSignal.timeout(58000)});
      const d=await r.json();
      if(id!==reqId.current)return;
      if(!d.available&&d.message)setError(d.message);
      const next=Object.fromEntries((d.items||[]).map(x=>[x.id,x]));
      setRows(next);
      writeCache(key,next);
      for(const item of series.items){
        const p=pickListing(next[item.name],"cheapest");
        if(p)saveMarketSnapshot({category:"browse",query:item.query,condition:"cheapest"},{median:p.totalPrice,low:p.totalPrice,high:p.totalPrice,sampleSize:next[item.name].count});
      }
    }catch{if(id===reqId.current)setError("Could not reach the live price service. Try again.");}
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
  useEffect(()=>{if(!usedGroup&&(mode==="used"||mode==="new"))setMode("cheapest");},[usedGroup]);

  return <div className="browse">
    <aside className="sidebar">
      <section className="sideBox">
        <button className="sideHead" onClick={()=>toggle("group")}><Layers size={15}/>Part Group<ChevronDown size={15} className={open.group?"flip":""}/></button>
        {open.group&&<div className="seriesList">
          {group.series.map(s=><button key={s.id} className={"seriesBtn"+(s.id===series.id?" on":"")+(s.brand?" b-"+s.brand:"")} onClick={()=>setRoute({page:"browse",group:group.id,series:s.id})}><Zap size={13}/>{s.label}</button>)}
        </div>}
      </section>
      <section className="sideBox">
        <button className="sideHead" onClick={()=>toggle("price")}><DollarSign size={15}/>Price<ChevronDown size={15} className={open.price?"flip":""}/></button>
        {open.price&&<><small className="sideLabel">Price Range</small><div className="rangeRow"><input inputMode="numeric" placeholder="Min" value={minPrice} onChange={e=>setMinPrice(e.target.value.replace(/[^\d.]/g,""))}/><input inputMode="numeric" placeholder="Max" value={maxPrice} onChange={e=>setMaxPrice(e.target.value.replace(/[^\d.]/g,""))}/></div>
        <small className="sideLabel">Pricing Modes <span title="Which listing each card shows. Switching never re-searches."><Info size={12}/></span></small>
        <div className="modeRow">{PRICING_MODES.filter(m=>usedGroup||(m.value!=="used"&&m.value!=="new")).map(m=><button key={m.value} className={mode===m.value?"on":""} onClick={()=>setMode(m.value)}>{m.label}</button>)}</div></>}
      </section>
      <section className="sideBox">
        <button className="sideHead" onClick={()=>toggle("filters")}><Filter size={15}/>Filters<ChevronDown size={15} className={open.filters?"flip":""}/></button>
        {open.filters&&<>
          {group.id==="gpu"&&<><small className="sideLabel">Minimum VRAM (GB)</small><input inputMode="numeric" placeholder="(Like 12GB)" value={minVram} onChange={e=>setMinVram(e.target.value.replace(/\D/g,""))}/></>}
          <small className="sideLabel">Sort cards</small>
          <select value={cardSort} onChange={e=>setCardSort(e.target.value)}><option value="catalog">Model tier</option><option value="price">Price: low to high</option><option value="msrp">Biggest discount vs MSRP</option></select>
        </>}
      </section>
      <p className="sideNote">Every listing links to a real item page on a trusted store or marketplace — eBay, AliExpress and Mercari item pages included for used deals. For-parts, broken, scam-priced and mismatched listings are removed.</p>
    </aside>

    <section className="browseMain">
      <h1 className="pageTitle">Track {series.label} {group.label} Prices</h1>
      <p className="pageSub">New and used prices from Amazon, Best Buy, Newegg, Walmart, eBay, AliExpress, Mercari, Micro Center, B&amp;H and more — the cheapest real listing per model, checked against launch MSRP.</p>
      <div className="crumbBar">
        <button className="backBtn" onClick={()=>setRoute({page:"browse",group:group.id,series:group.series[0].id})}><ArrowLeft size={15}/>{group.label}</button>
        <div className="crumbs"><span>{group.label}</span><b>›</b><strong>{series.label}</strong><em>{series.items.length} models{loadedAt?" | Last updated "+new Date(loadedAt).toLocaleTimeString():""}</em></div>
        <button className="ghostBtn" onClick={()=>load(true)} disabled={loading}><RefreshCw size={14} className={loading?"spin":""}/>Refresh prices</button>
      </div>
      <DealTicker cards={hot}/>
      {error&&<div className="notice"><Info size={18}/><div><b>{error}</b></div></div>}
      <div className="modelGrid">
        {cards.map(c=><ModelCard key={c.item.name} item={c.item} row={c.row} mode={mode} now={now} loading={loading}
          onMode={setMode}
          trend={getMarketTrend({category:"browse",query:c.item.query,condition:"cheapest"})?.series}
          onSeeAll={()=>setRoute({page:"model",group:group.id,series:series.id,model:c.item.name})}/>)}
      </div>
      {!cards.length&&<div className="emptyState">No models match these filters.</div>}
    </section>
  </div>;
}

export function guessCategory(q){
  const s=String(q||"").toLowerCase();
  if(/\b(rtx|gtx|rx\s?\d|radeon|geforce|arc\s?[ab]\d)/.test(s))return "GPU";
  if(/\b(ryzen|core\s?i[3579]|i[3579][-\s]\d|core ultra|threadripper)/.test(s))return "CPU";
  if(/\bddr[345]\b|\bram\b|memory/.test(s))return "RAM / Memory";
  if(/\bnvme\b|\bm\.?2\b/.test(s))return "NVMe SSD";
  if(/\bssd\b/.test(s))return "SATA SSD";
  if(/\bhdd\b|hard drive/.test(s))return "Hard Drive / HDD";
  if(/\b[abxz]\d{3}[a-z]?\b|motherboard/.test(s))return "Motherboard";
  if(/\b\d{3,4}\s?w\b|\bpsu\b|power supply/.test(s))return "Power Supply / PSU";
  if(/\baio\b|liquid cooler/.test(s))return "AIO Liquid Cooler";
  if(/cooler/.test(s))return "CPU Air Cooler";
  if(/monitor|\b\d{3}hz\b/.test(s))return "Monitor";
  return "Other";
}

export function ModelPage({providerKeys,route,setRoute,onWatchChange}){
  const {group,series}=findSeries(route.group,route.series);
  const item=series.items.find(x=>x.name===route.model)||(route.query?{name:route.query,query:route.query,category:guessCategory(route.query),specs:[],msrp:null}:series.items[0]);
  const [condition,setCondition]=useState("any");
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  const [watched,setWatched]=useState(()=>getWatchlist());

  async function scan(){
    setLoading(true);setData(null);
    track("full_scan",{query:item.query});
    try{
      const r=await fetch("/api/deals/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({category:item.category,query:item.query,condition,sortBy:"lowest",providerKeys}),signal:AbortSignal.timeout(58000)});
      setData(await r.json());
    }catch{setData({available:false,message:"Live search backend is unavailable."});}
    finally{setLoading(false);}
  }
  useEffect(()=>{scan();},[item.query,condition]);

  function toggle(x){const out=toggleWatchItem({...x,category:item.category,query:item.query});setWatched(out.items);onWatchChange?.();}
  const isWatched=x=>watched.some(w=>(w.url||w.id||w.title)===(x.url||x.id||x.title));
  const cheapest=data?.results?.length?Math.min(...data.results.map(x=>x.totalPrice)):null;
  const delta=vsMsrp(cheapest,item.msrp);

  return <div className="modelPage">
    <div className="crumbBar">
      <button className="backBtn" onClick={()=>setRoute(route.query?{page:"browse"}:{page:"browse",group:group.id,series:series.id})}><ArrowLeft size={15}/>Go Back<small>Return to product group</small></button>
      <div className="crumbs">{route.query?<><span>Search</span><b>›</b><strong>{item.name}</strong></>:<><span>{group.label}</span><b>›</b><span>{series.label}</span><b>›</b><strong>{item.name}</strong></>}</div>
    </div>
    <section className="modelHero">
      <div>
        <h1 className="pageTitle left">{item.name}</h1>
        <div className="heroSpecs">{item.specs.map(([k,v])=><span key={k}>{k} <b>{v}</b></span>)}{item.msrp&&<span>MSRP <b>{money(item.msrp)}</b></span>}</div>
      </div>
      <div className="heroRight">
        {cheapest!=null&&<div className="heroPrice"><small>Lowest trusted price</small><strong>{money(cheapest,2)}</strong>{delta!=null&&<em className={delta<0?"under":"over"}>{delta>0?"+":""}{delta}% vs MSRP</em>}</div>}
        <div className="heroControls">
          {allowsUsed(item.category)?<select value={condition} onChange={e=>setCondition(e.target.value)} aria-label="Condition">{SNIPER_CONDITIONS.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select>:<span className="newOnly">New only</span>}
          <button className="ghostBtn" onClick={()=>{saveSearch({category:item.category,query:item.query,condition,sortBy:"lowest"});onWatchChange?.();}}><Bookmark size={14}/>Save</button>
          <button className="ghostBtn" onClick={scan} disabled={loading}><RefreshCw size={14} className={loading?"spin":""}/>Rescan</button>
        </div>
      </div>
    </section>
    {loading&&<ScanSkeleton label={"Full scan: "+item.name+" across every trusted store"}/>}
    {data&&!data.available&&<div className="notice"><Info size={18}/><div><b>No live listings</b><p>{data.message}</p><ProviderNotes providers={data.providers} coverage={data.coverage} errors={data.errors}/></div></div>}
    {data?.available&&<section className="resultsPanel">
      <MarketPulse market={data.market} results={data.results}/>
      <DealResults results={data.results} isWatched={isWatched} onWatch={toggle}/>
      <ProviderNotes providers={data.providers} coverage={data.coverage} errors={data.errors}/>
    </section>}
  </div>;
}

export function CategoryPills({groupId,onPick}){
  return <div className="catPills">{PART_GROUPS.map(g=><button key={g.id} className={"catPill"+(g.id===groupId?" on":"")} onClick={()=>onPick(g)}><GroupIcon icon={g.icon}/>{g.label}</button>)}</div>;
}

export {TrendingDown};
