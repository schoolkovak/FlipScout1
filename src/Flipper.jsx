import React,{useEffect,useState} from "react";
import {MemoryStick,HardDrive,Box,Plug,Cpu,Flame,ExternalLink,Info} from "lucide-react";
import {PriceTotal,money} from "./DealResults.jsx";

// Flipper Deals: the parts a gaming-PC flipper buys most, ranked the way a
// flipper shops. Built from saved listings, so opening it costs no credits.
const ICONS={ddr4:MemoryStick,nvme500:HardDrive,cases:Box,psu:Plug,ryzen:Cpu,gpu:Flame};
const BLURB={
  ddr4:"8GB DDR4 sticks at 3000MHz or faster, under $65 per pair (2×8GB). Lots and kits are split into a per-pair price.",
  nvme500:"Any 500GB / 512GB NVMe M.2 SSD, cheapest first.",
  cases:"New PC cases at $52 or less, accessories filtered out.",
  psu:"550W / 650W first, then 750W. 80+ Bronze and Gold ranked ahead of everything else.",
  ryzen:"Buyer appeal per $100 spent: cheap Ryzen chips that still sell a PC (Ryzen 5 3600, 2600, 3500X…).",
  gpu:"Buyer appeal per $100 spent: the GPUs that make a build sell for the least money."
};
const KEY="fs-flipper-v1";
const waitList=m=>m.length>4?m.length+" models ("+m.slice(0,3).join(", ")+"…)":m.join(", ");
const ago=iso=>{if(!iso)return "";const h=(Date.now()-Date.parse(iso))/3600000;return h<1?Math.max(1,Math.round(h*60))+"m ago":h<48?Math.round(h)+"h ago":Math.round(h/24)+"d ago";};

function Extra({id,x}){
  if(id==="ddr4")return <span className="flipTag">{money(x.perPair,2)} per 2×8GB · {x.sticks} stick{x.sticks>1?"s":""} · {x.speed}MHz</span>;
  if(id==="psu")return <span className="flipTag">{x.tag}</span>;
  if(id==="ryzen"||id==="gpu")return <span className="flipTag">{x.model} · appeal {x.appeal}/10 · {x.appealPer100} per $100</span>;
  return null;
}

function Section({s}){
  const Icon=ICONS[s.id]||Flame;
  const [all,setAll]=useState(false);
  const rows=all?s.listings:s.listings.slice(0,8);
  return <section className="panelBox flipSection">
    <h3><Icon size={16}/>{s.title}<small>{s.count} found{s.searchedAt?" · updated "+ago(s.searchedAt):""}</small></h3>
    <p className="flipBlurb">{BLURB[s.id]}</p>
    {!s.listings.length?<div className="emptyState">{s.missing?.length?"Waiting for the first background update of "+waitList(s.missing)+".":"Nothing matches these rules right now."}</div>:
    <div className="flipList">{rows.map((x,i)=><a key={x.url||x.id||i} className="flipRow" href={x.url} target="_blank" rel="noreferrer">
      {x.image?<img src={x.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.visibility="hidden";}}/>:<span className="imgPh"></span>}
      <div className="flipMain"><b title={x.title}>{x.title}</b><span>{x.source}{x.condition&&x.condition!=="new"?" · "+x.condition:""}</span><Extra id={s.id} x={x}/></div>
      <PriceTotal item={x} big={false}/>
      <ExternalLink size={14}/>
    </a>)}</div>}
    {s.listings.length>8&&<button className="ghostBtn flipMore" onClick={()=>setAll(a=>!a)}>{all?"Show less":"Show all "+s.listings.length}</button>}
    {s.listings.length>0&&s.missing?.length>0&&<p className="flipBlurb">More coming as {waitList(s.missing)} get their first update.</p>}
  </section>;
}

export default function Flipper(){
  const [data,setData]=useState(()=>{try{return JSON.parse(localStorage.getItem(KEY)||"null");}catch{return null;}});
  const [error,setError]=useState("");
  useEffect(()=>{
    fetch("/api/flipper?section=all",{signal:AbortSignal.timeout(30000)}).then(r=>r.json()).then(d=>{
      if(d.sections?.length){setData(d);try{localStorage.setItem(KEY,JSON.stringify(d));}catch{}}
      else if(!data)setError(d.error||"No data yet.");
    }).catch(()=>{if(!data)setError("Could not load Flipper Deals. Try again in a minute.");});
  },[]);
  return <div className="flipPage">
    <h1 className="pageTitle">Flipper Deals</h1>
    <p className="pageSub">Cheap parts that sell gaming PCs. Every listing links to a real store item page, and prices include tax and shipping.</p>
    {error&&<div className="notice"><Info size={18}/><div><p>{error}</p></div></div>}
    {!data&&!error&&<div className="emptyState">Loading…</div>}
    <div className="flipGrid">{data?.sections?.map(s=><Section key={s.id} s={s}/>)}</div>
  </div>;
}
