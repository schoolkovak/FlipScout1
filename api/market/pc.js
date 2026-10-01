import { liveSearch } from "../_lib/market.js";

function fallbackPart(query) {
  const values={
    "Ryzen 5 3600":55,"Ryzen 5 5500":65,"Ryzen 5 5600":90,"Ryzen 5 5600X":100,"Ryzen 7 5700X":130,
    "Intel i5-10400":60,"Intel i5-11400":70,"Intel i5-12400":105,"Intel i5-13400":145,
    "RTX 3060":185,"RTX 3060 Ti":220,"RTX 3070":245,"RTX 3070 Ti":275,"RTX 3080":335,
    "RTX 4060":245,"RTX 4060 Ti":320,"RTX 4070":430,"RTX 5060":365,
    "RX 6600":135,"RX 6650 XT":165,"RX 6700 XT":220,"RX 6800":300,"RX 7600":210,"RX 7700 XT":335
  };
  return values[query]||null;
}

export default async function handler(req,res) {
  if (req.method!=="POST") return res.status(405).json({error:"POST required"});
  const body=req.body||{};
  const searches=[
    {query:body.gpu,category:"GPU",condition:"used",partBudget:0,buildBudget:0,committed:0,sortBy:"best"},
    {query:body.cpu,category:"CPU",condition:"used",partBudget:0,buildBudget:0,committed:0,sortBy:"best"},
    {query:(Number(body.storage)>=2000?"2TB":"1TB")+" NVMe SSD",category:"SSD / Storage",condition:"new",partBudget:0,buildBudget:0,committed:0,sortBy:"best"}
  ];

  const [gpuData,cpuData,ssdData]=await Promise.all(searches.map(x=>liveSearch(x).catch(()=>null)));
  const gpuLive=gpuData?.market?.sampleSize>=5?gpuData.market.median:null;
  const cpuLive=cpuData?.market?.sampleSize>=5?cpuData.market.median:null;
  const ssdLive=ssdData?.market?.sampleSize>=5?ssdData.market.median:null;

  const gpu=gpuLive||fallbackPart(body.gpu)||200;
  const cpu=cpuLive||fallbackPart(body.cpu)||80;
  const storage=ssdLive||(Number(body.storage)>=2000?115:Number(body.storage)>=1000?70:40);
  const ram=Number(body.ram)>=32?75:Number(body.ram)>=16?45:25;
  const supportingParts=165;
  const partsTotal=gpu+cpu+storage+ram+supportingParts;
  const low=Math.round(partsTotal*.93);
  const high=Math.round(partsTotal*1.08);
  const median=Math.round((low+high)/2);

  res.status(200).json({
    available:Boolean(gpuLive||cpuLive||ssdLive),
    market:{low,high,median},
    components:{
      gpu:{value:Math.round(gpu),source:gpuLive?"Live used asking comps":"Fallback estimate",sampleSize:gpuData?.market?.sampleSize||0},
      cpu:{value:Math.round(cpu),source:cpuLive?"Live used asking comps":"Fallback estimate",sampleSize:cpuData?.market?.sampleSize||0},
      storage:{value:Math.round(storage),source:ssdLive?"Live new retail comps":"Fallback estimate",sampleSize:ssdData?.market?.sampleSize||0}
    }
  });
}
