export const CHANNELS = {
  local: {
    name:"Local cash",
    feeRate:0,
    fixedFee:0,
    shipping:false,
    note:"No marketplace fee assumed. Travel, payment risk, and your time are not included."
  },
  ebay: {
    name:"eBay shipped",
    feeRate:.0735,
    fixedFee:.40,
    shipping:true,
    note:"Default desktop-PC fee assumption; actual account/category/promoted-listing costs can differ."
  },
  jawa: {
    name:"Jawa",
    feeRate:.12,
    fixedFee:0,
    shipping:true,
    note:"Uses 9% platform + 3% payment-processing assumption for newer sellers."
  }
};

function clamp(n,min=0,max=100){ return Math.max(min,Math.min(max,n)); }
function round(n){ return Math.round(Number(n||0)); }

export function buildSaleStrategy({onlineLikely,localLikely,marketLow,marketHigh}){
  const anchor=onlineLikely||localLikely||((Number(marketLow||0)+Number(marketHigh||0))/2);
  if(!anchor) return null;
  return {
    quick:round(anchor*.91),
    likely:round(anchor),
    stretch:round(anchor*1.08),
    negotiationFloor:round(anchor*.88)
  };
}

export function channelEconomics({salePrice,acquisitionCost,shippingCost=0,channel}){
  const cfg=CHANNELS[channel];
  const price=Number(salePrice||0);
  const buy=Number(acquisitionCost||0);
  const ship=cfg.shipping?Number(shippingCost||0):0;
  const fee=price*cfg.feeRate+cfg.fixedFee;
  const net=price-fee-ship;
  const profit=net-buy;
  const roi=buy>0?(profit/buy)*100:0;
  const margin=price>0?(profit/price)*100:0;
  return {channel:cfg.name,salePrice:price,fee,shipping:ship,net,profit,roi,margin,note:cfg.note};
}

export function channelScenarios({onlineLikely,localLikely,acquisitionCost,shippingMedian}){
  const online=Number(onlineLikely||0);
  const local=Number(localLikely||online*.92||0);
  return {
    local:channelEconomics({salePrice:local,acquisitionCost,channel:"local"}),
    ebay:channelEconomics({salePrice:online,acquisitionCost,shippingCost:shippingMedian||0,channel:"ebay"}),
    jawa:channelEconomics({salePrice:online*.98,acquisitionCost,shippingCost:shippingMedian||0,channel:"jawa"})
  };
}

export function marginBuyTargets({resale,shipping=0}){
  const r=Number(resale||0);
  if(!r) return null;
  const ebayFees=r*CHANNELS.ebay.feeRate+CHANNELS.ebay.fixedFee+Number(shipping||0);
  const net=r-ebayFees;
  return {
    target15:round(net/1.15),
    target20:round(net/1.20),
    target25:round(net/1.25),
    target30:round(net/1.30)
  };
}

export function negotiationPlan({askingPrice,maxBuy}){
  const ask=Number(askingPrice||0);
  const walk=Number(maxBuy||0);
  if(!ask||!walk) return null;
  const opening=Math.min(walk,Math.round(walk*.88/10)*10);
  const target=Math.min(walk,Math.round(walk*.96/10)*10);
  const gap=ask-walk;
  return {
    opening,
    target,
    walkAway:round(walk),
    askingGap:round(gap),
    script:gap>0
      ? `I can pick it up quickly. Based on the current market and what I need to put into it, I could do $${opening} today.`
      : `The asking price is already at or below FlipScout's walk-away number.`
  };
}

export function gamingTier(gpuName){
  const g=String(gpuName||"").toLowerCase();
  if(/5090|5080|4090|4080|7900 xtx/.test(g)) return {label:"4K enthusiast",score:100};
  if(/5070 ti|5070|4070 ti|4070 super|9070 xt|9070|7900 xt|7800 xt/.test(g)) return {label:"1440p ultra / 4K capable",score:90};
  if(/5060 ti|5060|4060 ti|4070|7700 xt|6800 xt|6800|9060 xt/.test(g)) return {label:"1440p strong",score:80};
  if(/4060|3060 ti|3070|6700 xt|6750 xt|7600 xt|6650 xt/.test(g)) return {label:"1080p ultra / 1440p capable",score:70};
  if(/3060|6600|2070|2060 super|5700 xt|b580/.test(g)) return {label:"1080p strong",score:60};
  return {label:"Entry / esports gaming",score:45};
}

export function buyerAppealScore({gpu,cpu,ram,storage,caseType}){
  let score=50;
  const g=String(gpu||"").toLowerCase();
  const c=String(cpu||"").toLowerCase();
  const r=String(ram||"").toLowerCase();
  const s=String(storage||"").toLowerCase();
  const pcCase=String(caseType||"").toLowerCase();

  if(/rtx 50|rtx 40|rx 90/.test(g)) score+=16;
  else if(/rtx 30|rx 70|arc b/.test(g)) score+=9;
  if(/x3d|ryzen 7 9|core ultra|i7-14|i5-14|ryzen 7 7|ryzen 5 7/.test(c)) score+=10;
  if(/32gb|48gb|64gb/.test(r)) score+=8;
  else if(/16gb/.test(r)) score+=3;
  if(/2tb|4tb/.test(s)) score+=7;
  else if(/1tb/.test(s)) score+=3;
  if(/rgb|tempered|showcase/.test(pcCase)) score+=6;
  return clamp(score);
}

export function liquidityScore({gpu,cpu,onlineEvidenceCount=0,completePcCompCount=0}){
  let score=35;
  const g=String(gpu||"").toLowerCase();
  const c=String(cpu||"").toLowerCase();
  if(/rtx (30|40|50)|rx (6|7|9)/.test(g)) score+=25;
  if(/ryzen [5-9] [5-9]|i[5-9]-1[2-5]|core ultra/.test(c)) score+=15;
  score+=Math.min(15,Number(onlineEvidenceCount||0));
  score+=Math.min(10,Math.floor(Number(completePcCompCount||0)/2));
  return clamp(score);
}

export function verdict({score,profit,roi,evidenceConfidence,compatWarnings=0}){
  if(compatWarnings>0) return {label:"FIX / VERIFY",tone:"warn",reason:"Compatibility or identity issues need attention before buying."};
  if(score>=82 && profit>=150 && roi>=20) return {label:"STRONG BUY",tone:"good",reason:"High projected margin with strong overall deal quality."};
  if(score>=70 && profit>=100 && roi>=14) return {label:"BUY",tone:"good",reason:"Good projected economics if the hardware checks out."};
  if(score>=55 && profit>=40) return {label:"NEGOTIATE",tone:"warn",reason:"Potential deal, but margin needs a better purchase price."};
  if(evidenceConfidence==="Insufficient") return {label:"VERIFY",tone:"warn",reason:"Not enough evidence to trust the market estimate yet."};
  return {label:"PASS",tone:"bad",reason:"Projected margin does not justify the risk."};
}

export function upgradeIdeas(input){
  const ideas=[];
  const ram=String(input.ram||"").toLowerCase();
  const storage=String(input.storage||"").toLowerCase();
  const caseType=String(input.caseType||"").toLowerCase();
  const cooler=String(input.cooler||"").toLowerCase();
  const gpu=String(input.gpu||"").toLowerCase();

  if(/16gb/.test(ram)) ideas.push({title:"32GB memory upgrade",cost:55,resaleLift:75,reason:"32GB reads as a more complete modern gaming build to buyers."});
  if(/500gb/.test(storage)) ideas.push({title:"Move to 1TB NVMe",cost:45,resaleLift:70,reason:"500GB can make an otherwise good gaming PC feel budget-tier."});
  if(/1tb/.test(storage)&&/(4070|5070|7800|7900|9070|4080|5080|4090|5090)/.test(gpu)) ideas.push({title:"2TB NVMe upgrade",cost:65,resaleLift:90,reason:"Higher-end GPUs pair better with 2TB storage in buyer-facing listings."});
  if(/basic/.test(caseType)) ideas.push({title:"Airflow RGB case",cost:45,resaleLift:80,reason:"Presentation matters disproportionately in local gaming-PC sales."});
  if(/stock/.test(cooler)) ideas.push({title:"Tower air cooler",cost:20,resaleLift:35,reason:"Low-cost visual and thermal upgrade that improves listing photos."});

  return ideas.map(x=>({...x,estimatedNetLift:x.resaleLift-x.cost,roi:x.cost?Math.round((x.resaleLift-x.cost)/x.cost*100):0}))
    .sort((a,b)=>b.estimatedNetLift-a.estimatedNetLift)
    .slice(0,4);
}

export function generateListingCopy(input,{localLikely,onlineLikely,tier}={}){
  const spec=[input.cpu,input.gpu,input.ram,input.storage].filter(Boolean);
  const title=`${input.gpu} Gaming PC | ${input.cpu} | ${String(input.ram||"").split(" ")[0]} | ${String(input.storage||"").split(" ")[0]} SSD`.slice(0,80);
  const bullets=[
    `${tier?.label||"Gaming-ready"} performance tier`,
    `${input.cpu} processor`,
    `${input.gpu} graphics`,
    `${input.ram}`,
    `${input.storage}`,
    input.caseType,
    input.cooler
  ].filter(Boolean);
  const description=`Clean gaming PC built around ${spec.join(", ")}. Great fit for ${tier?.label||"gaming"}. Fully test the system before listing and include benchmark screenshots, temperatures, storage health, and clear photos of the inside and outside. Local target price: ${localLikely?"$"+round(localLikely):"check local comps"}. Online target price: ${onlineLikely?"$"+round(onlineLikely):"check live comps"}.`;
  return {title,bullets,description};
}

export function scoreBreakdown({result,live,best,appeal,liquidity}){
  const roi=Number(best?.roi||0);
  const marginScore=clamp(roi*2.5);
  const evidenceCount=Number(live?.salesEvidence?.listingCount||0);
  const completeCount=Number(live?.completePc?.sampleSize||0);
  const liveParts=Number(live?.meta?.liveComponentCount||0);
  let evidence=20;
  if(live?.resale?.online?.salesBacked)evidence+=35;
  evidence+=Math.min(20,evidenceCount*3);
  evidence+=Math.min(15,completeCount*2);
  evidence+=Math.min(10,liveParts*2);
  evidence=clamp(evidence);
  const warningCount=result?.compatibility?.warnings?.length||0;
  const compatibility=clamp(100-warningCount*35);
  const weighted=Math.round(
    marginScore*.36+
    Number(appeal||0)*.18+
    Number(liquidity||0)*.18+
    evidence*.18+
    compatibility*.10
  );
  const risks=[];
  if(roi<12)risks.push("Thin projected ROI");
  if(!live?.resale?.online?.salesBacked)risks.push("No sales-backed complete-PC evidence");
  if(completeCount<4)risks.push("Few complete-PC comps");
  if(warningCount)risks.push(warningCount+" compatibility / identity warning"+(warningCount>1?"s":""));
  if(live?.resale?.online?.costs?.shippingMedian==null)risks.push("Shipping cost not supported by enough comps");
  return {
    weighted,
    factors:[
      {name:"Margin",score:Math.round(marginScore),weight:"36%"},
      {name:"Buyer appeal",score:Math.round(appeal||0),weight:"18%"},
      {name:"Liquidity",score:Math.round(liquidity||0),weight:"18%"},
      {name:"Evidence quality",score:Math.round(evidence),weight:"18%"},
      {name:"Compatibility",score:Math.round(compatibility),weight:"10%"}
    ],
    risks
  };
}

export function buildOpportunitySummary(input,result,live){
  if(!result?.identityValid) return null;
  const onlineLikely=live?.resale?.online?.likely||result.resale;
  const localLikely=live?.resale?.local?.likely||Math.round(Number(onlineLikely||0)*.92);
  const shipping=live?.resale?.online?.costs?.shippingMedian||0;
  const channels=channelScenarios({onlineLikely,localLikely,acquisitionCost:input.price,shippingMedian:shipping});
  const best=Object.values(channels).sort((a,b)=>b.profit-a.profit)[0];
  const buyTargets=marginBuyTargets({resale:onlineLikely,shipping});
  const negotiation=negotiationPlan({askingPrice:input.price,maxBuy:buyTargets?.target20||result.maxBuy});
  const appeal=buyerAppealScore(input);
  const liquidity=liquidityScore({
    gpu:input.gpu,
    cpu:input.cpu,
    onlineEvidenceCount:live?.salesEvidence?.listingCount||0,
    completePcCompCount:live?.completePc?.sampleSize||0
  });
  const breakdown=scoreBreakdown({result,live,best,appeal,liquidity});
  const v=verdict({
    score:breakdown.weighted||result.score,
    profit:best?.profit||result.profit,
    roi:best?.roi||0,
    evidenceConfidence:live?.resale?.online?.confidence,
    compatWarnings:result.compatibility?.warnings?.length||0
  });
  return {
    onlineLikely,localLikely,shipping,channels,best,buyTargets,negotiation,
    appeal,liquidity,verdict:v,scoreBreakdown:breakdown,
    tier:gamingTier(input.gpu),
    upgrades:upgradeIdeas(input),
    listing:generateListingCopy(input,{localLikely,onlineLikely,tier:gamingTier(input.gpu)}),
    saleStrategy:buildSaleStrategy({onlineLikely,localLikely,marketLow:result.low,marketHigh:result.high})
  };
}
