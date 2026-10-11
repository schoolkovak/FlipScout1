// Manufacturer-published *starting/reference* launch prices, not the MSRP of
// every factory-overclocked board partner SKU. Do not fill unknown values.
const REFERENCES={
  "RTX 4060":{price:299,source:"https://www.nvidia.com/en-us/geforce/news/ultimate-guide-to-4060/"},
  "RTX 4060 Ti 8GB":{price:399,source:"https://www.nvidia.com/en-us/geforce/news/geforce-rtx-4060-4060ti/"},
  "RTX 4060 Ti 16GB":{price:499,source:"https://www.nvidia.com/en-us/geforce/news/geforce-rtx-4060-4060ti/"},
  "RTX 5070":{price:549,source:"https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5070-family/"},
  "RTX 5070 Ti":{price:749,source:"https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5070-family/"},
  "RX 9070":{price:549,source:"https://ir.amd.com/news-events/press-releases/detail/1238/amd-unveils-next-generation-amd-rdna-4-architecture-with-the-launch-of-amd-radeon-rx-9000-series-graphics-cards"},
  "RX 9070 XT":{price:599,source:"https://ir.amd.com/news-events/press-releases/detail/1238/amd-unveils-next-generation-amd-rdna-4-architecture-with-the-launch-of-amd-radeon-rx-9000-series-graphics-cards"}
};
export function referenceMsrp(category,query,title=""){
  if(String(category).toLowerCase()!=="gpu")return null;
  const q=String(query||"").toLowerCase();
  const t=String(title||"").toLowerCase();
  // Only use a reference price if variant strings are unambiguous.
  for(const [key,value] of Object.entries(REFERENCES).sort((a,b)=>b[0].length-a[0].length)){
    const variant=key.toLowerCase();
    if(!q.includes(variant))continue;
    if(key==="RTX 4060" && (/4060\s*ti/.test(q)||/4060\s*ti/.test(t)))continue;
    if(key==="RTX 5070" && (/5070\s*ti/.test(q)||/5070\s*ti/.test(t)))continue;
    if(key==="RX 9070" && (/9070\s*xt/.test(q)||/9070\s*xt/.test(t)))continue;
    if(key.includes("8GB")&&!/\b8\s?gb\b/i.test(t+" "+q))continue;
    if(key.includes("16GB")&&!/\b16\s?gb\b/i.test(t+" "+q))continue;
    return {amount:value.price,source:value.source,label:"Manufacturer starting MSRP (reference model)"};
  }
  return null;
}
