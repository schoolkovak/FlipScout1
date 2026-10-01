import React, { useEffect, useMemo, useState } from "react";
import { Search, Cpu, Gauge, ShoppingCart, ExternalLink, Database, AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react";
import { cpuValues, gpuValues, fallbackPcEstimate } from "./valuation";

const categories=["GPU","CPU","SSD / Storage","RAM","Motherboard","PSU","Case","Cooler","Complete PC"];

function money(v){
  if(v===null||v===undefined||Number.isNaN(Number(v))) return "—";
  return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(v);
}

function Analyzer(){
  const [price,setPrice]=useState(525);
  const [cpu,setCpu]=useState("Ryzen 5 5600");
  const [gpu,setGpu]=useState("RTX 4060");
  const [ram,setRam]=useState("16");
  const [storage,setStorage]=useState("1000");
  const [purpose,setPurpose]=useState("flip");
  const [result,setResult]=useState(null);
  const [live,setLive]=useState(null);
  const [loading,setLoading]=useState(false);

  async function analyze(){
    setLoading(true);
    setLive(null);
    const fallback=fallbackPcEstimate({cpu,gpu,ram,storage,price,purpose});
    setResult(fallback);
    try{
      const r=await fetch("/api/market/pc",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({cpu,gpu,ram,storage,price,purpose})
      });
      if(r.ok){
        const d=await r.json();
        if(d.available){
          setLive(d);
          const resale=d.market.median;
          const sellingCosts=Math.round(resale*.08+15);
          const profit=resale-Number(price||0)-sellingCosts;
          const maxBuy=Math.max(0,resale-sellingCosts-120);
          const discount=resale?(resale-Number(price||0))/resale:0;
          const score=Math.max(0,Math.min(100,Math.round(55+discount*90+(gpu.includes("40")||gpu.includes("50")?6:0))));
          setResult({...fallback,low:d.market.low,high:d.market.high,resale,sellingCosts,profit,maxBuy,score});
        }
      }
    }catch{}
    finally{setLoading(false);}
  }

  return <section className="panel">
    <div className="sectionTitle">
      <div><span className="eyebrow">PC ANALYZER</span><h2>Analyze a complete build</h2></div>
      <button className="ghost" onClick={()=>{setPrice(525);setCpu("Ryzen 5 5600");setGpu("RTX 4060");setRam("16");setStorage("1000");}}>Load sample</button>
    </div>
    <div className="formGrid">
      <label>Asking price<input type="number" value={price} onChange={e=>setPrice(e.target.value)}/></label>
      <label>CPU<select value={cpu} onChange={e=>setCpu(e.target.value)}>{Object.keys(cpuValues).map(x=><option key={x}>{x}</option>)}</select></label>
      <label>GPU<select value={gpu} onChange={e=>setGpu(e.target.value)}>{Object.keys(gpuValues).map(x=><option key={x}>{x}</option>)}</select></label>
      <label>RAM<select value={ram} onChange={e=>setRam(e.target.value)}><option value="8">8 GB</option><option value="16">16 GB</option><option value="32">32 GB</option><option value="64">64 GB</option></select></label>
      <label>Storage<select value={storage} onChange={e=>setStorage(e.target.value)}><option value="500">500 GB SSD</option><option value="1000">1 TB SSD</option><option value="2000">2 TB SSD</option><option value="4000">4 TB SSD</option></select></label>
      <label>Purpose<select value={purpose} onChange={e=>setPurpose(e.target.value)}><option value="flip">Flip for profit</option><option value="personal">Personal gaming PC</option></select></label>
    </div>
    <button className="primary" onClick={analyze} disabled={loading}>{loading?<><RefreshCw className="spin" size={18}/>Checking live comps...</>:<><Gauge size={18}/>Analyze deal</>}</button>

    {result&&<div className="resultsGrid">
      <div className="scoreCard"><span>FLIP SCORE</span><strong>{result.score}</strong><small>/100</small></div>
      <div className="metric"><span>Market value</span><b>{money(result.low)}–{money(result.high)}</b><small>{live?"Live component comps":"Fallback estimate"}</small></div>
      <div className="metric"><span>Expected resale</span><b>{money(result.resale)}</b></div>
      <div className="metric"><span>Selling costs</span><b>{money(result.sellingCosts)}</b></div>
      <div className="metric"><span>Potential profit</span><b className={result.profit>=0?"good":"bad"}>{money(result.profit)}</b></div>
      <div className="metric"><span>Max buy price</span><b>{money(result.maxBuy)}</b></div>
    </div>}

    {live&&<div className="liveBreakdown">
      <h3><CheckCircle2 size={18}/> Live price inputs</h3>
      <div className="breakdownGrid">
        {Object.entries(live.components).map(([name,x])=><div key={name}><span>{name}</span><b>{money(x.value)}</b><small>{x.source} · {x.sampleSize} comps</small></div>)}
      </div>
    </div>}

    {result&&<div className="why"><h3>How FlipScout is judging it</h3><p>FlipScout uses live GPU, CPU and SSD comps when enough relevant listings exist. It falls back only for components without enough live data, then factors in selling costs, resale headroom and newer-model resale appeal.</p></div>}
  </section>
}

function Scanner(){
  const [category,setCategory]=useState("GPU");
  const [query,setQuery]=useState("RTX 4070");
  const [condition,setCondition]=useState("any");
  const [partBudget,setPartBudget]=useState(450);
  const [buildBudget,setBuildBudget]=useState(850);
  const [committed,setCommitted]=useState(300);
  const [sortBy,setSortBy]=useState("best");
  const [loading,setLoading]=useState(false);
  const [data,setData]=useState(null);

  async function scan(){
    setLoading(true); setData(null);
    try{
      const r=await fetch("/api/deals/search",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({category,query,condition,partBudget,buildBudget,committed,sortBy})
      });
      setData(await r.json());
    }catch{
      setData({available:false,message:"Live search backend is not reachable yet."});
    }finally{setLoading(false);}
  }

  return <section className="panel">
    <div className="sectionTitle"><div><span className="eyebrow">LIVE PARTS SCANNER</span><h2>Find underpriced hardware</h2></div><ShoppingCart/></div>
    <div className="formGrid">
      <label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
      <label>What are you looking for?<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="RTX 4070, 2TB NVMe..."/></label>
      <label>Condition<select value={condition} onChange={e=>setCondition(e.target.value)}><option value="any">Any</option><option value="new">New</option><option value="used">Used</option><option value="open-box">Open box</option></select></label>
      <label>Max part budget<input type="number" value={partBudget} onChange={e=>setPartBudget(e.target.value)}/></label>
      <label>Total build budget<input type="number" value={buildBudget} onChange={e=>setBuildBudget(e.target.value)}/></label>
      <label>Already committed<input type="number" value={committed} onChange={e=>setCommitted(e.target.value)}/></label>
      <label>Rank by<select value={sortBy} onChange={e=>setSortBy(e.target.value)}><option value="best">Best Deal</option><option value="lowest">Lowest Price</option><option value="under">Most Under Market</option><option value="flip">Best for Flip</option><option value="budget">Best Fit for Budget</option></select></label>
    </div>
    <button className="primary" onClick={scan} disabled={loading}>{loading?<><RefreshCw className="spin" size={18}/>Scanning real listings...</>:<><Search size={18}/>Scan live deals</>}</button>

    {data&&!data.available&&<div className="notice"><AlertTriangle size={20}/><div><b>Live search needs a provider connection</b><p>{data.message}</p></div></div>}

    {data?.available&&<div>
      <div className="marketHeadline">
        <div><span>{data.market.valueLabel}</span><strong>{money(data.market.median)}</strong><small>{money(data.market.low)}–{money(data.market.high)} trimmed range</small></div>
        <div><span>Relevant comps</span><strong>{data.market.sampleSize}</strong><small>{data.market.rawSampleSize} raw listings scanned</small></div>
        <div><span>Confidence</span><strong>{data.market.confidence}</strong><small>{data.market.shippingKnownPct}% with known shipping</small></div>
      </div>
      <div className="sourceChips">
        {Object.entries(data.market.bySource||{}).map(([k,v])=><span key={k}>{k}: {v}</span>)}
        {Object.entries(data.market.byCondition||{}).map(([k,v])=><span key={k}>{k}: {v}</span>)}
      </div>
      <div className="dealList">{data.results.map((x,i)=><article className="dealCard" key={x.id||i}>
        <div className="dealTop"><div><span className="source">{x.source}</span><h3>{x.title}</h3></div><div className="dealScore">{x.score}</div></div>
        <div className="dealMeta"><span>{x.condition}</span><span>{money(x.itemPrice)} + {x.shippingKnown?money(x.shipping):"shipping unknown"}</span><strong>{x.shippingKnown?money(x.totalPrice)+" delivered":money(x.itemPrice)+" + shipping"}</strong></div>
        <div className="dealMeta"><span className={x.percentVsMarket>=10?"good":x.percentVsMarket<0?"bad":""}>{x.percentVsMarket>=0?x.percentVsMarket+"% under market":Math.abs(x.percentVsMarket)+"% over market"}</span><span>Build budget left: {money(x.budgetLeft)}</span><span>{x.withinPartBudget?"Within part budget":"Over part budget"}</span></div>
        {x.seller&&<div className="seller">Seller/store: {x.seller}</div>}
        {x.url&&<a className="listingLink" href={x.url} target="_blank" rel="noreferrer">View real listing <ExternalLink size={15}/></a>}
      </article>)}</div>
      {data.errors?.length>0&&<div className="providerErrors">{data.errors.map((e,i)=><p key={i}>{e.provider}: {e.message}</p>)}</div>}
    </div>}
  </section>
}

function Sources(){
  const [sources,setSources]=useState([]);
  useEffect(()=>{fetch("/api/sources").then(r=>r.json()).then(d=>setSources(d.sources||[])).catch(()=>{});},[]);
  return <section className="panel sourcePanel">
    <div className="sectionTitle"><div><span className="eyebrow">DATA SOURCES</span><h2>Live provider status</h2></div><Database/></div>
    <div className="sourceGrid">{sources.length?sources.map(s=><div className="sourceRow" key={s.name}><div><span>{s.name}</span><small>{s.coverage}</small>{s.id==="bestbuy"&&s.status==="Connected"&&<a className="bestBuyAttribution" href="https://developers.bestbuy.com/" target="_blank" rel="noreferrer"><img src="https://developer.bestbuy.com/images/bestbuy-logo.png" alt="Best Buy Developer API"/></a>}</div><b className={s.status==="Connected"?"good":""}>{s.status}</b></div>):<p>Preview mode is running without live provider credentials.</p>}</div>
  </section>
}

export default function App(){
  const [tab,setTab]=useState("analyze");
  const subtitle=useMemo(()=>tab==="analyze"?"Know what a PC is worth before you buy it.":"Search current listings, compare real asking-market comps, and protect your build budget.",[tab]);
  return <div className="app">
    <header className="hero"><div className="brand"><div className="logo">FS</div><div><h1>FlipScout</h1><p>Find undervalued gaming hardware.</p></div></div><div className="heroText">{subtitle}</div></header>
    <nav className="tabs"><button className={tab==="analyze"?"active":""} onClick={()=>setTab("analyze")}><Cpu size={17}/>PC Analyzer</button><button className={tab==="scan"?"active":""} onClick={()=>setTab("scan")}><Search size={17}/>Parts Deal Scanner</button></nav>
    <main>{tab==="analyze"?<Analyzer/>:<Scanner/>}<Sources/></main>
  </div>;
}
