import React,{useEffect,useState} from "react";
import {MemoryStick,HardDrive,Box,Plug,Cpu,Flame,ExternalLink,Info,Package,CircuitBoard} from "lucide-react";
import {PriceTotal,money} from "./DealResults.jsx";

// Flipper Deals: the parts a gaming-PC flipper buys most, ranked the way a
// flipper shops. Built from saved listings, so opening it costs no credits.
const ICONS={ddr4:MemoryStick,nvme500:HardDrive,cases:Box,whitecases:Box,psu:Plug,psunew:Plug,ryzen:Cpu,gpu:Flame,combos:Package,mobo:CircuitBoard};
const BLURB={
  ddr4:"8GB DDR4 sticks at 3000MHz or faster, under $65 per pair (2×8GB) and at least 10% under the going price. Bulk lots (8+ sticks) and kits are split into a per-pair price.",
  nvme500:"500GB / 512GB NVMe M.2 SSDs at least 10% under the going used price, cheapest first.",
  cases:"RGB cases at $52 or less, Micro-ATX or bigger. No open-air frames, test benches or Mini-ITX.",
  whitecases:"White cases that come with ARGB fans, Micro-ATX or bigger, $70 or less. Well-known case brands first.",
  mobo:"Used motherboards (AM4 B450/B550/X570, AM5, Intel) at $150 or less, at least 10% under that board type's used market. Biggest discount first.",
  psunew:"New 550–750W 80+ rated desktop PSUs at $45 or less, compared with the typical new price for that wattage.",
  psu:"550W / 650W first, then 750W, at least 10% under the going price for that wattage. 80+ Bronze and Gold ranked ahead of everything else.",
  ryzen:"Ryzen chips at $65 or less (shipping included), at least 10% under their own used market price, ranked by buyer appeal per dollar.",
  combos:"Newegg bundles (CPU + motherboard, case + PSU, GPU + PSU…) that cost less than buying the parts separately, biggest % saved first. Total includes FL sales tax. Checked every few hours.",
  gpu:"Ranked by what buyers want: newer, popular cards (RTX 50 / 40, RX 9000) rank high as long as the price is justified. Every card is at least 10% under its own used market price."
};
const KEY="fs-flipper-v1";
const waitList=m=>m.length>4?m.length+" models ("+m.slice(0,3).join(", ")+"…)":m.join(", ");
const ago=iso=>{if(!iso)return "";const h=(Date.now()-Date.parse(iso))/3600000;return h<1?Math.max(1,Math.round(h*60))+"m ago":h<48?Math.round(h)+"h ago":Math.round(h/24)+"d ago";};

function Deal({x}){
  if(x.underPct==null||!x.market)return null;
  const vs=x.marketKind==="new"?"typical new price":"used market";
  return <span className="flipDeal">{x.underPct}% under {vs} (~{money(x.market,0)}{x.perPair?" per pair":""})</span>;
}

function Extra({id,x}){
  if(id==="ddr4")return <span className="flipTag">{x.bulk?"BULK · ":""}{money(x.perPair,2)} per 2×8GB · {x.sticks} stick{x.sticks>1?"s":""} · {x.speed}MHz</span>;
  if(id==="whitecases")return x.tag?<span className="flipTag">{x.tag}</span>:null;
  if(id==="psu"||id==="psunew"||id==="mobo")return <span className="flipTag">{x.tag}</span>;
  if(id==="combos")return <>
    <span className="flipTag">{x.tag}{x.freeGift?" · free gift included":""}</span>
    <span className="flipDeal">Save {money(x.savings,2)} ({x.savingsPct}%) vs {money(x.separate,2)} separately · {money(x.totalAfterTax,2)} total after tax</span>
    {x.parts?.length>0&&<span className="flipParts">{x.parts.map((p,i)=><span key={i}>{p.gift?"🎁 ":""}{p.count>1?p.count+"× ":""}{p.title.slice(0,70)}{p.gift?" (free)":" — "+money(p.price,2)}</span>)}</span>}
  </>;
  if(id==="ryzen"||id==="gpu")return <span className="flipTag">{x.model} · buyer appeal {x.appeal}/10</span>;
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
      <div className="flipMain"><b title={x.title}>{x.title}</b><span>{x.source}{x.condition&&x.condition!=="new"?" · "+x.condition:""}</span><Extra id={s.id} x={x}/><Deal x={x}/></div>
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
