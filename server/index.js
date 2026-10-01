import "dotenv/config";
import express from "express";
import cors from "cors";
import { liveSearch, providerStatus } from "../api/_lib/market.js";

const app=express();
app.use(cors());
app.use(express.json());

const port=process.env.PORT||8787;

app.get("/api/sources",(req,res)=>res.json({sources:providerStatus()}));

app.post("/api/deals/search",async(req,res)=>{
  const input={
    category:req.body?.category||"GPU",
    query:String(req.body?.query||"").trim(),
    condition:req.body?.condition||"any",
    partBudget:Number(req.body?.partBudget||0),
    buildBudget:Number(req.body?.buildBudget||0),
    committed:Number(req.body?.committed||0),
    sortBy:req.body?.sortBy||"best"
  };
  if(!input.query) return res.status(400).json({available:false,message:"Enter a part or model to search."});
  if(!providerStatus().some(x=>x.status==="Connected")){
    return res.json({available:false,message:"No live provider credentials are configured yet.",sources:providerStatus()});
  }
  const result=await liveSearch(input);
  if(!result.market.sampleSize){
    return res.json({available:false,message:"Providers responded, but FlipScout could not find enough relevant comparable listings.",errors:result.errors,sources:providerStatus()});
  }
  return res.json({
    available:true,
    searchedAt:new Date().toISOString(),
    market:{
      median:result.market.median,
      low:result.market.low,
      high:result.market.high,
      sampleSize:result.market.sampleSize,
      rawSampleSize:result.market.rawSampleSize,
      byCondition:result.market.byCondition,
      bySource:result.market.bySource,
      shippingKnownPct:result.market.shippingKnownPct,
      confidence:result.market.confidence,
      valueLabel:"Current asking-market value"
    },
    results:result.ranked.slice(0,75),
    errors:result.errors,
    sources:providerStatus()
  });
});

app.post("/api/market/pc",async(req,res)=>{
  const body=req.body||{};
  const searches=[
    {query:body.gpu,category:"GPU",condition:"used",partBudget:0,buildBudget:0,committed:0,sortBy:"best"},
    {query:body.cpu,category:"CPU",condition:"used",partBudget:0,buildBudget:0,committed:0,sortBy:"best"},
    {query:(Number(body.storage)>=2000?"2TB":"1TB")+" NVMe SSD",category:"SSD / Storage",condition:"new",partBudget:0,buildBudget:0,committed:0,sortBy:"best"}
  ];
  const fallback={
    "Ryzen 5 3600":55,"Ryzen 5 5500":65,"Ryzen 5 5600":90,"Ryzen 5 5600X":100,"Ryzen 7 5700X":130,
    "Intel i5-10400":60,"Intel i5-11400":70,"Intel i5-12400":105,"Intel i5-13400":145,
    "RTX 3060":185,"RTX 3060 Ti":220,"RTX 3070":245,"RTX 3070 Ti":275,"RTX 3080":335,
    "RTX 4060":245,"RTX 4060 Ti":320,"RTX 4070":430,"RTX 5060":365,
    "RX 6600":135,"RX 6650 XT":165,"RX 6700 XT":220,"RX 6800":300,"RX 7600":210,"RX 7700 XT":335
  };
  const [gpuData,cpuData,ssdData]=await Promise.all(searches.map(x=>liveSearch(x).catch(()=>null)));
  const gpuLive=gpuData?.market?.sampleSize>=5?gpuData.market.median:null;
  const cpuLive=cpuData?.market?.sampleSize>=5?cpuData.market.median:null;
  const ssdLive=ssdData?.market?.sampleSize>=5?ssdData.market.median:null;
  const gpu=gpuLive||fallback[body.gpu]||200;
  const cpu=cpuLive||fallback[body.cpu]||80;
  const storage=ssdLive||(Number(body.storage)>=2000?115:Number(body.storage)>=1000?70:40);
  const ram=Number(body.ram)>=32?75:Number(body.ram)>=16?45:25;
  const total=gpu+cpu+storage+ram+165;
  const low=Math.round(total*.93);
  const high=Math.round(total*1.08);
  return res.json({
    available:Boolean(gpuLive||cpuLive||ssdLive),
    market:{low,high,median:Math.round((low+high)/2)},
    components:{
      gpu:{value:Math.round(gpu),source:gpuLive?"Live used asking comps":"Fallback estimate",sampleSize:gpuData?.market?.sampleSize||0},
      cpu:{value:Math.round(cpu),source:cpuLive?"Live used asking comps":"Fallback estimate",sampleSize:cpuData?.market?.sampleSize||0},
      storage:{value:Math.round(storage),source:ssdLive?"Live new retail comps":"Fallback estimate",sampleSize:ssdData?.market?.sampleSize||0}
    }
  });
});

app.listen(port,()=>console.log("FlipScout API running on port "+port));
