// Browse catalog: part group -> series -> models. Clicking a series loads a
// price card per model. MSRP = launch list price in USD (reference only).
const gpu = (name, msrp, vram, power, extra = {}) => ({
  name, query: extra.query || name, category: "GPU", msrp, vram,
  specs: [["VRAM", vram + " GB"], ["Power", power + "W"]]
});
const cpu = (name, msrp, cores, threads, boost, tdp, extra = {}) => ({
  name, query: extra.query || name, category: "CPU", msrp,
  specs: [["Cores", cores + "C / " + threads + "T"], ["Boost", boost + " GHz"], ["TDP", tdp + "W"]]
});
const spec = (name, category, specs, extra = {}) => ({ name, query: extra.query || name, category, msrp: extra.msrp || null, specs });

export const PART_GROUPS = [
  {
    id: "gpu", label: "GPU", icon: "gpu", series: [
      { id: "rtx50", label: "RTX 50 Series", brand: "nvidia", items: [
        gpu("RTX 5090", 1999, 32, 575), gpu("RTX 5080", 999, 16, 360), gpu("RTX 5070 Ti", 749, 16, 300),
        gpu("RTX 5070", 549, 12, 250), gpu("RTX 5060 Ti 16GB", 429, 16, 180), gpu("RTX 5060 Ti 8GB", 379, 8, 180),
        gpu("RTX 5060", 299, 8, 145), gpu("RTX 5050", 249, 8, 130)
      ] },
      { id: "rtx40", label: "RTX 40 Series", brand: "nvidia", items: [
        gpu("RTX 4090", 1599, 24, 450), gpu("RTX 4080 Super", 999, 16, 320), gpu("RTX 4080", 1199, 16, 320),
        gpu("RTX 4070 Ti Super", 799, 16, 285), gpu("RTX 4070 Ti", 799, 12, 285), gpu("RTX 4070 Super", 599, 12, 220),
        gpu("RTX 4070", 549, 12, 200), gpu("RTX 4060 Ti 16GB", 499, 16, 165), gpu("RTX 4060 Ti 8GB", 399, 8, 160),
        gpu("RTX 4060", 299, 8, 115)
      ] },
      { id: "rtx30", label: "RTX 30 Series", brand: "nvidia", items: [
        gpu("RTX 3090 Ti", 1999, 24, 450), gpu("RTX 3090", 1499, 24, 350), gpu("RTX 3080 Ti", 1199, 12, 350),
        gpu("RTX 3080 10GB", 699, 10, 320), gpu("RTX 3070 Ti", 599, 8, 290), gpu("RTX 3070", 499, 8, 220),
        gpu("RTX 3060 Ti", 399, 8, 200), gpu("RTX 3060 12GB", 329, 12, 170), gpu("RTX 3060 8GB", 329, 8, 170),
        gpu("RTX 3050 8GB", 249, 8, 130), gpu("RTX 3050 6GB", 169, 6, 70)
      ] },
      { id: "rtx20", label: "RTX 20 Series", brand: "nvidia", items: [
        gpu("RTX 2080 Ti", 999, 11, 250), gpu("RTX 2080 Super", 699, 8, 250), gpu("RTX 2080", 699, 8, 215),
        gpu("RTX 2070 Super", 499, 8, 215), gpu("RTX 2070", 499, 8, 175), gpu("RTX 2060 Super", 399, 8, 175),
        gpu("RTX 2060", 349, 6, 160)
      ] },
      { id: "gtx16", label: "GTX 16 Series", brand: "nvidia", items: [
        gpu("GTX 1660 Ti", 279, 6, 120), gpu("GTX 1660 Super", 229, 6, 125), gpu("GTX 1660", 219, 6, 120),
        gpu("GTX 1650 Super", 159, 4, 100), gpu("GTX 1650", 149, 4, 75), gpu("GTX 1630", 149, 4, 75)
      ] },
      { id: "gtx10", label: "GTX 10 Series", brand: "nvidia", items: [
        gpu("GTX 1080 Ti", 699, 11, 250), gpu("GTX 1080", 599, 8, 180), gpu("GTX 1070 Ti", 449, 8, 180),
        gpu("GTX 1070", 379, 8, 150), gpu("GTX 1060 6GB", 249, 6, 120), gpu("GTX 1060 3GB", 199, 3, 120),
        gpu("GTX 1050 Ti", 139, 4, 75)
      ] },
      { id: "rx9000", label: "RX 9000 Series", brand: "amd", items: [
        gpu("RX 9070 XT", 599, 16, 304), gpu("RX 9070", 549, 16, 220),
        gpu("RX 9060 XT 16GB", 349, 16, 160), gpu("RX 9060 XT 8GB", 299, 8, 150)
      ] },
      { id: "rx7000", label: "RX 7000 Series", brand: "amd", items: [
        gpu("RX 7900 XTX", 999, 24, 355), gpu("RX 7900 XT", 899, 20, 315), gpu("RX 7900 GRE", 549, 16, 260),
        gpu("RX 7800 XT", 499, 16, 263), gpu("RX 7700 XT", 449, 12, 245), gpu("RX 7600 XT", 329, 16, 190),
        gpu("RX 7600", 269, 8, 165)
      ] },
      { id: "rx6000", label: "RX 6000 Series", brand: "amd", items: [
        gpu("RX 6950 XT", 1099, 16, 335), gpu("RX 6900 XT", 999, 16, 300), gpu("RX 6800 XT", 649, 16, 300),
        gpu("RX 6800", 579, 16, 250), gpu("RX 6750 XT", 549, 12, 250), gpu("RX 6700 XT", 479, 12, 230),
        gpu("RX 6650 XT", 399, 8, 180), gpu("RX 6600", 329, 8, 132)
      ] },
      { id: "rx5000", label: "RX 5000 / 500", brand: "amd", items: [
        gpu("RX 5700 XT", 399, 8, 225), gpu("RX 5700", 349, 8, 180), gpu("RX 5600 XT", 279, 6, 150),
        gpu("RX 5500 XT 8GB", 199, 8, 130), gpu("RX 590", 279, 8, 225), gpu("RX 580 8GB", 229, 8, 185)
      ] },
      { id: "arc", label: "Intel Arc", brand: "intel", items: [
        gpu("Arc B580", 249, 12, 190, { query: "Intel Arc B580" }), gpu("Arc B570", 219, 10, 150, { query: "Intel Arc B570" }),
        gpu("Arc A770 16GB", 349, 16, 225, { query: "Intel Arc A770 16GB" }), gpu("Arc A750", 289, 8, 225, { query: "Intel Arc A750" })
      ] }
    ]
  },
  {
    id: "cpu", label: "CPU", icon: "cpu", series: [
      { id: "ryzen9000", label: "Ryzen 9000", brand: "amd", items: [
        cpu("Ryzen 7 9800X3D", 479, 8, 16, 5.2, 120), cpu("Ryzen 9 9950X3D", 699, 16, 32, 5.7, 170),
        cpu("Ryzen 9 9900X3D", 599, 12, 24, 5.5, 120), cpu("Ryzen 9 9950X", 649, 16, 32, 5.7, 170),
        cpu("Ryzen 9 9900X", 499, 12, 24, 5.6, 120), cpu("Ryzen 7 9700X", 359, 8, 16, 5.5, 65),
        cpu("Ryzen 5 9600X", 279, 6, 12, 5.4, 65)
      ] },
      { id: "ryzen7000", label: "Ryzen 7000", brand: "amd", items: [
        cpu("Ryzen 7 7800X3D", 449, 8, 16, 5.0, 120), cpu("Ryzen 9 7950X3D", 699, 16, 32, 5.7, 120),
        cpu("Ryzen 9 7950X", 699, 16, 32, 5.7, 170), cpu("Ryzen 9 7900X", 549, 12, 24, 5.6, 170),
        cpu("Ryzen 7 7700X", 399, 8, 16, 5.4, 105), cpu("Ryzen 5 7600X", 299, 6, 12, 5.3, 105),
        cpu("Ryzen 5 7600", 229, 6, 12, 5.1, 65)
      ] },
      { id: "ryzen5000", label: "AM4 · Ryzen 5000", brand: "amd", items: [
        cpu("Ryzen 7 5800X3D", 449, 8, 16, 4.5, 105), cpu("Ryzen 7 5700X3D", 249, 8, 16, 4.1, 105),
        cpu("Ryzen 9 5950X", 799, 16, 32, 4.9, 105), cpu("Ryzen 9 5900X", 549, 12, 24, 4.8, 105),
        cpu("Ryzen 7 5800X", 449, 8, 16, 4.7, 105), cpu("Ryzen 7 5700X", 299, 8, 16, 4.6, 65),
        cpu("Ryzen 5 5600X", 299, 6, 12, 4.6, 65), cpu("Ryzen 5 5600", 199, 6, 12, 4.4, 65)
      ] },
      { id: "ryzen5000g", label: "AM4 · Ryzen 5000 budget & APUs", brand: "amd", items: [
        cpu("Ryzen 7 5700G", 359, 8, 16, 4.6, 65), cpu("Ryzen 5 5600G", 259, 6, 12, 4.4, 65),
        cpu("Ryzen 5 5600GT", 140, 6, 12, 4.6, 65), cpu("Ryzen 5 5500", 159, 6, 12, 4.2, 65),
        cpu("Ryzen 7 5700", 199, 8, 16, 4.6, 65), cpu("Ryzen 5 5600XT", 194, 6, 12, 4.7, 65),
        cpu("Ryzen 7 5800XT", 249, 8, 16, 4.8, 105), cpu("Ryzen 9 5900XT", 349, 16, 32, 4.8, 105)
      ] },
      { id: "ryzen3000", label: "AM4 · Ryzen 3000", brand: "amd", items: [
        cpu("Ryzen 9 3950X", 749, 16, 32, 4.7, 105), cpu("Ryzen 9 3900X", 499, 12, 24, 4.6, 105),
        cpu("Ryzen 7 3800X", 399, 8, 16, 4.5, 105), cpu("Ryzen 7 3700X", 329, 8, 16, 4.4, 65),
        cpu("Ryzen 5 3600X", 249, 6, 12, 4.4, 95), cpu("Ryzen 5 3600", 199, 6, 12, 4.2, 65),
        cpu("Ryzen 5 3500X", 159, 6, 6, 4.1, 65), cpu("Ryzen 3 3300X", 120, 4, 8, 4.3, 65)
      ] },
      { id: "ryzen2000", label: "AM4 · Ryzen 2000 / 1000", brand: "amd", items: [
        cpu("Ryzen 7 2700X", 329, 8, 16, 4.3, 105), cpu("Ryzen 7 2700", 299, 8, 16, 4.1, 65),
        cpu("Ryzen 5 2600X", 229, 6, 12, 4.2, 95), cpu("Ryzen 5 2600", 199, 6, 12, 3.9, 65),
        cpu("Ryzen 7 1700", 329, 8, 16, 3.7, 65), cpu("Ryzen 5 1600", 219, 6, 12, 3.6, 65)
      ] },
      { id: "coreultra", label: "Core Ultra 200S", brand: "intel", items: [
        cpu("Core Ultra 9 285K", 589, 24, 24, 5.7, 125), cpu("Core Ultra 7 265K", 394, 20, 20, 5.5, 125),
        cpu("Core Ultra 5 245K", 309, 14, 14, 5.2, 125)
      ] },
      { id: "intel14", label: "Intel 14th / 13th Gen", brand: "intel", items: [
        cpu("i9-14900K", 589, 24, 32, 6.0, 125, { query: "Intel Core i9-14900K" }),
        cpu("i7-14700K", 409, 20, 28, 5.6, 125, { query: "Intel Core i7-14700K" }),
        cpu("i5-14600K", 319, 14, 20, 5.3, 125, { query: "Intel Core i5-14600K" }),
        cpu("i5-14400F", 196, 10, 16, 4.7, 65, { query: "Intel Core i5-14400F" }),
        cpu("i7-13700K", 409, 16, 24, 5.4, 125, { query: "Intel Core i7-13700K" }),
        cpu("i5-13600K", 319, 14, 20, 5.1, 125, { query: "Intel Core i5-13600K" })
      ] },
      { id: "intel12", label: "Intel 12th Gen", brand: "intel", items: [
        cpu("i7-12700K", 409, 12, 20, 5.0, 125, { query: "Intel Core i7-12700K" }),
        cpu("i5-12600K", 289, 10, 16, 4.9, 125, { query: "Intel Core i5-12600K" }),
        cpu("i5-12400F", 167, 6, 12, 4.4, 65, { query: "Intel Core i5-12400F" })
      ] },
      { id: "intel11", label: "Intel 10th / 11th Gen", brand: "intel", items: [
        cpu("i7-11700K", 399, 8, 16, 5.0, 125, { query: "Intel Core i7-11700K" }),
        cpu("i5-11600K", 262, 6, 12, 4.9, 125, { query: "Intel Core i5-11600K" }),
        cpu("i5-11400F", 157, 6, 12, 4.4, 65, { query: "Intel Core i5-11400F" }),
        cpu("i7-10700K", 374, 8, 16, 5.1, 125, { query: "Intel Core i7-10700K" }),
        cpu("i7-10700", 323, 8, 16, 4.8, 65, { query: "Intel Core i7-10700" }),
        cpu("i5-10400F", 155, 6, 12, 4.3, 65, { query: "Intel Core i5-10400F" })
      ] }
    ]
  },
  {
    id: "ram", label: "RAM", icon: "ram", series: [
      { id: "ddr5", label: "DDR5 Desktop", items: [
        spec("32GB DDR5 6000 CL30", "RAM / Memory", [["Kit", "2×16 GB"], ["Speed", "6000 MT/s"], ["Latency", "CL30"]]),
        spec("32GB DDR5 6000", "RAM / Memory", [["Kit", "2×16 GB"], ["Speed", "6000 MT/s"]]),
        spec("64GB DDR5 6000", "RAM / Memory", [["Kit", "2×32 GB"], ["Speed", "6000 MT/s"]]),
        spec("32GB DDR5 5600", "RAM / Memory", [["Kit", "2×16 GB"], ["Speed", "5600 MT/s"]]),
        spec("48GB DDR5 6000", "RAM / Memory", [["Kit", "2×24 GB"], ["Speed", "6000 MT/s"]])
      ] },
      { id: "ddr4", label: "DDR4 Desktop", items: [
        spec("8GB DDR4 3200", "RAM / Memory", [["Kit", "1×8 GB"], ["Speed", "3200 MT/s"]]),
        spec("16GB DDR4 3600", "RAM / Memory", [["Kit", "2×8 GB"], ["Speed", "3600 MT/s"]]),
        spec("16GB DDR4 3200", "RAM / Memory", [["Kit", "2×8 GB"], ["Speed", "3200 MT/s"]]),
        spec("32GB DDR4 3200", "RAM / Memory", [["Kit", "2×16 GB"], ["Speed", "3200 MT/s"]]),
        spec("32GB DDR4 3600", "RAM / Memory", [["Kit", "2×16 GB"], ["Speed", "3600 MT/s"]]),
        spec("64GB DDR4 3200", "RAM / Memory", [["Kit", "2×32 GB"], ["Speed", "3200 MT/s"]])
      ] }
    ]
  },
  {
    id: "ssd", label: "SSD", icon: "ssd", series: [
      { id: "ssd500", label: "500GB SSDs", items: [
        spec("500GB SSD", "SSD / NVMe", [["Capacity", "500 GB"], ["Type", "NVMe or SATA"]]),
        spec("500GB NVMe SSD", "NVMe SSD", [["Capacity", "500 GB"], ["Interface", "M.2 NVMe"]]),
        spec("500GB SATA SSD", "SATA SSD", [["Capacity", "500 GB"], ["Form", "2.5\""]]),
        spec("1TB SSD", "SSD / NVMe", [["Capacity", "1 TB"], ["Type", "NVMe or SATA"]])
      ] },
      { id: "nvme", label: "NVMe SSD", items: [
        spec("1TB NVMe SSD", "NVMe SSD", [["Capacity", "1 TB"], ["Interface", "M.2 NVMe"]]),
        spec("2TB NVMe SSD", "NVMe SSD", [["Capacity", "2 TB"], ["Interface", "M.2 NVMe"]]),
        spec("4TB NVMe SSD", "NVMe SSD", [["Capacity", "4 TB"], ["Interface", "M.2 NVMe"]]),
        spec("2TB PCIe 5.0 NVMe SSD", "NVMe SSD", [["Capacity", "2 TB"], ["Interface", "PCIe 5.0"]])
      ] },
      { id: "sata", label: "SATA SSD / HDD", items: [
        spec("1TB SATA SSD", "SATA SSD", [["Capacity", "1 TB"], ["Form", "2.5\""]]),
        spec("2TB SATA SSD", "SATA SSD", [["Capacity", "2 TB"], ["Form", "2.5\""]]),
        spec("4TB 7200RPM HDD", "Hard Drive / HDD", [["Capacity", "4 TB"], ["Speed", "7200 RPM"]]),
        spec("8TB HDD", "Hard Drive / HDD", [["Capacity", "8 TB"], ["Form", "3.5\""]])
      ] }
    ]
  },
  {
    id: "motherboard", label: "Motherboard", icon: "board", series: [
      { id: "am5", label: "AM5", brand: "amd", items: [
        spec("B650 AM5 motherboard", "Motherboard", [["Socket", "AM5"], ["Chipset", "B650"]]),
        spec("B850 AM5 motherboard", "Motherboard", [["Socket", "AM5"], ["Chipset", "B850"]]),
        spec("X870 AM5 motherboard", "Motherboard", [["Socket", "AM5"], ["Chipset", "X870"]]),
        spec("X670E AM5 motherboard", "Motherboard", [["Socket", "AM5"], ["Chipset", "X670E"]])
      ] },
      { id: "am4", label: "AM4", brand: "amd", items: [
        spec("B550 AM4 motherboard", "Motherboard", [["Socket", "AM4"], ["Chipset", "B550"]]),
        spec("X570 AM4 motherboard", "Motherboard", [["Socket", "AM4"], ["Chipset", "X570"]]),
        spec("B450 AM4 motherboard", "Motherboard", [["Socket", "AM4"], ["Chipset", "B450"]])
      ] },
      { id: "intelboards", label: "Intel LGA1700 / 1851", brand: "intel", items: [
        spec("Z790 LGA1700 motherboard", "Motherboard", [["Socket", "LGA1700"], ["Chipset", "Z790"]]),
        spec("B760 LGA1700 motherboard", "Motherboard", [["Socket", "LGA1700"], ["Chipset", "B760"]]),
        spec("Z890 LGA1851 motherboard", "Motherboard", [["Socket", "LGA1851"], ["Chipset", "Z890"]]),
        spec("B860 LGA1851 motherboard", "Motherboard", [["Socket", "LGA1851"], ["Chipset", "B860"]])
      ] }
    ]
  },
  {
    id: "psu", label: "PSU", icon: "psu", series: [
      { id: "watts", label: "By Wattage (all brands)", items: [
        spec("550W PSU", "Power Supply / PSU", [["Wattage", "550W"], ["Rating", "Any 80+"]]),
        spec("650W PSU", "Power Supply / PSU", [["Wattage", "650W"], ["Rating", "Any 80+"]]),
        spec("750W PSU", "Power Supply / PSU", [["Wattage", "750W"], ["Rating", "Any 80+"]]),
        spec("850W PSU", "Power Supply / PSU", [["Wattage", "850W"], ["Rating", "Any 80+"]]),
        spec("1000W PSU", "Power Supply / PSU", [["Wattage", "1000W"], ["Rating", "Any 80+"]]),
        spec("1200W PSU", "Power Supply / PSU", [["Wattage", "1200W"], ["Rating", "Any 80+"]])
      ] },
      { id: "gold", label: "80+ Gold", items: [
        spec("650W 80+ Gold PSU", "Power Supply / PSU", [["Wattage", "650W"], ["Rating", "80+ Gold"]]),
        spec("750W 80+ Gold PSU", "Power Supply / PSU", [["Wattage", "750W"], ["Rating", "80+ Gold"]]),
        spec("850W 80+ Gold PSU", "Power Supply / PSU", [["Wattage", "850W"], ["Rating", "80+ Gold"]]),
        spec("1000W 80+ Gold PSU", "Power Supply / PSU", [["Wattage", "1000W"], ["Rating", "80+ Gold"]]),
        spec("1200W 80+ Platinum PSU", "Power Supply / PSU", [["Wattage", "1200W"], ["Rating", "80+ Platinum"]])
      ] }
    ]
  },
  {
    id: "cooling", label: "Cooling", icon: "fan", series: [
      { id: "aio", label: "AIO Liquid", items: [
        spec("240mm AIO liquid cooler", "AIO Liquid Cooler", [["Radiator", "240 mm"]]),
        spec("280mm AIO liquid cooler", "AIO Liquid Cooler", [["Radiator", "280 mm"]]),
        spec("360mm AIO liquid cooler", "AIO Liquid Cooler", [["Radiator", "360 mm"]])
      ] },
      { id: "air", label: "Air Coolers & Fans", items: [
        spec("dual tower CPU air cooler", "CPU Air Cooler", [["Type", "Dual tower"]]),
        spec("CPU air cooler", "CPU Air Cooler", [["Type", "Tower air"]]),
        spec("120mm ARGB fan 3 pack", "Case Fans", [["Size", "120 mm"], ["Pack", "3"]])
      ] }
    ]
  },
  {
    id: "case", label: "Case", icon: "case", series: [
      { id: "budget", label: "Budget Cases", items: [
        spec("ATX mid tower PC case", "PC Case", [["Form", "ATX mid tower"]]),
        spec("Micro ATX PC case", "PC Case", [["Form", "Micro ATX"]]),
        spec("Mini ITX PC case", "PC Case", [["Form", "Mini ITX"]])
      ] }
    ]
  },
  {
    id: "monitor", label: "Monitor", icon: "monitor", series: [
      { id: "gaming", label: "Gaming Monitors", items: [
        spec("27 inch 1440p 165Hz gaming monitor", "Monitor", [["Size", "27\""], ["Res", "1440p"], ["Refresh", "165 Hz"]]),
        spec("27 inch 1440p 240Hz OLED monitor", "Monitor", [["Size", "27\""], ["Panel", "OLED"], ["Refresh", "240 Hz"]]),
        spec("24 inch 1080p 180Hz gaming monitor", "Monitor", [["Size", "24\""], ["Res", "1080p"], ["Refresh", "180 Hz"]]),
        spec("32 inch 4K 144Hz gaming monitor", "Monitor", [["Size", "32\""], ["Res", "4K"], ["Refresh", "144 Hz"]]),
        spec("34 inch ultrawide 1440p gaming monitor", "Monitor", [["Size", "34\""], ["Res", "UWQHD"]])
      ] }
    ]
  }
];

export function findSeries(groupId, seriesId) {
  const group = PART_GROUPS.find(g => g.id === groupId) || PART_GROUPS[0];
  return { group, series: group.series.find(s => s.id === seriesId) || group.series[0] };
}

// Typed searches: "1660 super", "gtx1660ti", "5700xt" -> the catalog model,
// so the model page gets the right category, MSRP and series.
const modelKey = s => String(s || "").toLowerCase().replace(/\b(nvidia|geforce|amd|radeon|intel|graphics card|gpu)\b/g, "").replace(/\b(rtx|gtx|gt|rx)\s*/g, "").replace(/[^a-z0-9]/g, "");
export function findCatalogModel(query) {
  const key = modelKey(query);
  if (!key) return null;
  let loose = null;
  for (const group of PART_GROUPS) for (const series of group.series) for (const item of series.items) {
    const k = modelKey(item.name);
    if (k === key) return { group, series, item };
    // "1060" -> "GTX 1060 6GB", "3050" -> "RTX 3050 8GB" (memory size left off)
    if (!loose && modelKey(item.name.replace(/\s*\d{1,2}\s*GB\b/i, "")) === key) loose = { group, series, item };
  }
  return loose;
}

// Bare GPU numbers get their brand prefix so the search engine and the
// category guess understand them: "1660 ti" -> "GTX 1660 Ti", "6600" -> "RX 6600".
export function normalizePartQuery(query) {
  const q = String(query || "").trim().replace(/\s+/g, " ");
  const m = q.match(/^(\d{3,4})\s*(ti|super|xtx|xt|gre)?(\s.*)?$/i);
  if (!m) return q;
  const n = m[1], suffix = m[2] ? " " + m[2].replace(/^(ti|super)$/i, s => s[0].toUpperCase() + s.slice(1).toLowerCase()).replace(/^(xtx|xt|gre)$/i, s => s.toUpperCase()) : "";
  let prefix = "";
  if (/^1[0-6]\d\d$/.test(n)) prefix = "GTX";
  else if (/^90\d\d$/.test(n) || /^(4|5)[5-9]0$/.test(n) || /^[5-7][5-9]\d0$/.test(n) || /^5[5-7]00$/.test(n)) prefix = "RX";
  else if (/^[2-5]0[5-9]0$/.test(n)) prefix = "RTX";
  return prefix ? prefix + " " + n + suffix + (m[3] || "") : q;
}
