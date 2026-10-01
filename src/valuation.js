export const cpuValues = {
  "Ryzen 5 3600": 55,
  "Ryzen 5 5500": 65,
  "Ryzen 5 5600": 90,
  "Ryzen 5 5600X": 100,
  "Ryzen 7 5700X": 130,
  "Intel i5-10400": 60,
  "Intel i5-11400": 70,
  "Intel i5-12400": 105,
  "Intel i5-13400": 145
};

export const gpuValues = {
  "RTX 3060": 185,
  "RTX 3060 Ti": 220,
  "RTX 3070": 245,
  "RTX 3070 Ti": 275,
  "RTX 3080": 335,
  "RTX 4060": 245,
  "RTX 4060 Ti": 320,
  "RTX 4070": 430,
  "RTX 5060": 365,
  "RX 6600": 135,
  "RX 6650 XT": 165,
  "RX 6700 XT": 220,
  "RX 6800": 300,
  "RX 7600": 210,
  "RX 7700 XT": 335
};

export function fallbackPcEstimate(input) {
  const cpuValue = cpuValues[input.cpu] || 80;
  const gpuValue = gpuValues[input.gpu] || 200;
  const ramValue = Number(input.ram) >= 32 ? 75 : Number(input.ram) >= 16 ? 45 : 25;
  const storageValue = Number(input.storage) >= 2000 ? 115 : Number(input.storage) >= 1000 ? 70 : 40;
  const supportingParts = 165;
  const base = cpuValue + gpuValue + ramValue + storageValue + supportingParts;
  const low = Math.round(base * 0.93);
  const high = Math.round(base * 1.08);
  const resale = Math.round((low + high) / 2);
  const sellingCosts = Math.round(resale * 0.08 + 15);
  const profit = resale - Number(input.price || 0) - sellingCosts;
  const maxBuy = Math.max(0, resale - sellingCosts - 120);
  const discount = resale ? (resale - Number(input.price || 0)) / resale : 0;
  const newerGpuBoost = input.gpu.includes("40") || input.gpu.includes("50") ? 6 : 0;
  const score = Math.max(0, Math.min(100, Math.round(55 + discount * 90 + newerGpuBoost)));
  return { low, high, resale, sellingCosts, profit, maxBuy, score };
}
