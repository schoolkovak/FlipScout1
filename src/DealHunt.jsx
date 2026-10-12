import React,{useMemo,useState} from "react";
import {AlertTriangle,RefreshCw,Target,Trash2,Sparkles} from "lucide-react";
import {track} from "@vercel/analytics";
import {SNIPER_CATEGORIES,SNIPER_MARKETPLACES,SNIPER_CONDITIONS,groupedSniperCategories,allowsUsed} from "../shared/sniper.js";
import {getWatchlist,toggleWatchItem} from "./storage";
import DealResults,{MarketPulse,ProviderNotes,ScanSkeleton,PriceTotal,money} from "./DealResults.jsx";

export default function DealHunt({providerKeys,onWatchChange}){
  const categoryGroups=useMemo(()=>groupedSniperCategories(),[]);
  const [targets,setTargets]=useState(()=>[
    {id:"target-1",category:"GPU",query:"RTX 5070",condition:"any",maxPrice:550,buildBudget:1000,committed:300}
  ]);
  const [marketplaces,setMarketplaces]=useState(SNIPER_MARKETPLACES.map(x=>x.id));
  const [loading,setLoading]=useState(false);
  const [data,setData]=useState(null);
  const [error,setError]=useState("");
  const [watched,setWatched]=useState(()=>getWatchlist());

  function updateTarget(id,key,value){
    setTargets(rows=>rows.map(x=>x.id===id?{...x,[key]:value}:x));
    setError("");
  }
  function changeCategory(id,category){
    const example=SNIPER_CATEGORIES.find(x=>x.name===category)?.example||"";
    setTargets(rows=>rows.map(x=>x.id===id?{...x,category,query:example}:x));
    setError("");
  }
  function addTarget(){
    if(targets.length>=5)return;
    const item=SNIPER_CATEGORIES[(targets.length*3)%SNIPER_CATEGORIES.length];
    setTargets(rows=>[...rows,{id:"target-"+Date.now(),category:item.name,query:item.example,condition:"any",maxPrice:0,buildBudget:1000,committed:0}]);
  }
  function removeTarget(id){
    if(targets.length===1)return;
    setTargets(rows=>rows.filter(x=>x.id!==id));
  }
  function toggleMarketplace(id){
    setMarketplaces(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);
    setError("");
  }
  function toggleWatch(item,target){
    const out=toggleWatchItem({...item,category:target.category,query:target.query});
    setWatched(out.items);onWatchChange?.();
  }
  function isWatched(item){
    const key=item.url||item.id||item.title;
    return watched.some(x=>(x.url||x.id||x.title)===key);
  }

  async function scan(){
    if(loading)return;
    if(!marketplaces.length){setError("Choose at least one marketplace.");return;}
    if(targets.find(x=>!String(x.query||"").trim())){setError("Every target needs a part or model.");return;}
    setLoading(true);setError("");setData(null);
    track("sniper_scan",{targets:targets.length,marketplaces:marketplaces.length});
    try{
      const r=await fetch("/api/parts/sniper",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({targets,marketplaces,providerKeys}),signal:AbortSignal.timeout(58000)});
      const d=await r.json();
      if(!r.ok){setError(d.message||"Deal Hunt could not run this scan.");return;}
      setData(d);
      if(!d.available)setError(d.message||"No qualifying live listings were found.");
    }catch{
      setError("Deal Hunt could not reach the live shopping service. Try again.");
    }finally{setLoading(false);}
  }

  return <div className="pageStack">
    <section className="searchDock hunt">
      <div className="dockHead"><span className="eyebrow">DEAL HUNT</span><h2>Hunt up to five parts <em>across ten stores</em> at once.</h2><p>Deep scan on every target: Google Shopping (2 pages, new + used), retailer product pages, and eBay / AliExpress / Mercari item pages. Results load once — sort and filter them instantly.</p></div>
      <div className="storeToggles">
        {SNIPER_MARKETPLACES.map(m=><button key={m.id} className={"storeToggle store-"+m.id+(marketplaces.includes(m.id)?" on":"")} onClick={()=>toggleMarketplace(m.id)} aria-pressed={marketplaces.includes(m.id)}><i></i>{m.name}</button>)}
      </div>
      <div className="targetList">
        {targets.map((target,index)=><div className="targetRow" key={target.id}>
          <span className="targetNum">{index+1}</span>
          <label className="targetQuery"><span>Part / model</span><input value={target.query} onChange={e=>updateTarget(target.id,"query",e.target.value)} placeholder="e.g. RTX 5070 Ti 16GB"/></label>
          <label><span>Category</span><select value={target.category} onChange={e=>changeCategory(target.id,e.target.value)}>{Object.entries(categoryGroups).map(([group,items])=><optgroup label={group} key={group}>{items.map(item=><option key={item.name} value={item.name}>{item.name}</option>)}</optgroup>)}</select></label>
          <label><span>Condition</span>{allowsUsed(target.category)?<select value={target.condition} onChange={e=>updateTarget(target.id,"condition",e.target.value)}>{SNIPER_CONDITIONS.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select>:<select value="new" disabled><option value="new">New only</option></select>}</label>
          <label><span>Max price</span><input type="number" min="0" value={target.maxPrice} onChange={e=>updateTarget(target.id,"maxPrice",e.target.value)} placeholder="0 = no cap"/></label>
          <button className="iconBtn" disabled={targets.length===1} onClick={()=>removeTarget(target.id)} aria-label={"Remove target "+(index+1)}><Trash2 size={16}/></button>
        </div>)}
      </div>
      <div className="dockFoot">
        <button className="ghost small" onClick={addTarget} disabled={targets.length>=5}>+ Add target <em>{targets.length}/5</em></button>
        <button className="primary large scanBtn" onClick={scan} disabled={loading}>{loading?<><RefreshCw className="spin" size={18}/>Hunting…</>:<><Target size={18}/>Run hunt</>}</button>
      </div>
      {error&&<div className="notice"><AlertTriangle size={18}/><div><b>{error}</b></div></div>}
    </section>

    {loading&&<ScanSkeleton label={"Hunting "+targets.length+" target"+(targets.length===1?"":"s")+" across "+marketplaces.length+" stores"}/>}
    {data?.available&&(data.results||[]).map(group=><section className="resultsPanel" key={group.id}>
      <div className="targetHead">
        <div><span className="eyebrow">{group.target.category} · {SNIPER_CONDITIONS.find(x=>x.value===group.target.condition)?.label||group.target.condition}{group.target.maxPrice>0?" · max "+money(group.target.maxPrice):""}</span><h3>{group.target.query}</h3></div>
        {group.bestDeal&&<a className="bestValue" href={group.bestDeal.url||undefined} target="_blank" rel="noreferrer">
          <span><Sparkles size={13}/>Best value{group.target.maxPrice>0?" under cap":""}</span>
          <PriceTotal item={group.bestDeal}/>
          <small>{group.bestDeal.source} · {group.bestDeal.condition} · score {group.bestDeal.score}</small>
        </a>}
      </div>
      {group.available?<>
        <MarketPulse market={group.market} results={group.results}/>
        <DealResults results={group.results} isWatched={isWatched} onWatch={item=>toggleWatch(item,group.target)}/>
      </>:<div className="emptyState">No valid priced listing for this target.</div>}
      <ProviderNotes providers={group.providers} coverage={group.coverage} errors={group.errors}/>
    </section>)}
  </div>;
}
