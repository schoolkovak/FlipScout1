import {SNIPER_CATEGORIES} from "./sniper.js";

// Curated discovery seeds cover every broad category and multiple useful subtypes.
// This is a rolling catalog, not a claim to cover every model ever manufactured.
export const DISCOVERY_SUBTYPES={
  "GPU": [
    "RTX 4060 8GB",
    "RTX 4070 12GB",
    "RTX 4080 16GB",
    "RTX 5060 8GB",
    "RTX 5070 12GB",
    "RX 7600 8GB",
    "RX 7800 XT 16GB",
    "RX 9070 XT 16GB",
    "Intel Arc B580 12GB"
  ],
  "CPU": [
    "Ryzen 5 5500",
    "Ryzen 5 5600",
    "Ryzen 5 7600",
    "Ryzen 7 7800X3D",
    "Ryzen 7 9800X3D",
    "Intel i5 12400F",
    "Intel i5 14400F",
    "Intel Core Ultra 5 245K"
  ],
  "Motherboard": [
    "B550 AM4 ATX motherboard",
    "B650 AM5 motherboard",
    "B850 AM5 motherboard",
    "B760 LGA1700 motherboard",
    "Z790 motherboard",
    "X870 motherboard"
  ],
  "RAM / Memory": [
    "16GB DDR4 3200 2x8GB",
    "16GB DDR4 3600 2x8GB",
    "32GB DDR4 3600 2x16GB",
    "32GB DDR5 6000 2x16GB",
    "64GB DDR5 6000 2x32GB"
  ],
  "NVMe SSD": [
    "500GB NVMe SSD",
    "1TB NVMe SSD",
    "2TB NVMe SSD",
    "4TB NVMe SSD PCIe 4.0"
  ],
  "SATA SSD": [
    "500GB SATA SSD",
    "1TB SATA SSD",
    "2TB SATA SSD"
  ],
  "Hard Drive / HDD": [
    "2TB 7200rpm HDD",
    "4TB 7200rpm HDD",
    "8TB NAS hard drive"
  ],
  "Power Supply / PSU": [
    "550W 80+ Bronze PSU",
    "650W 80+ Gold PSU",
    "750W 80+ Gold ATX 3.0 PSU",
    "850W 80+ Gold ATX 3.1 PSU",
    "1000W 80+ Gold PSU"
  ],
  "PC Case": [
    "ATX airflow RGB PC case",
    "Micro ATX tempered glass case",
    "Mini ITX case"
  ],
  "CPU Air Cooler": [
    "single tower 120mm CPU air cooler",
    "dual tower CPU air cooler",
    "low profile CPU air cooler"
  ],
  "AIO Liquid Cooler": [
    "240mm AIO liquid cooler",
    "280mm AIO cooler",
    "360mm AIO liquid cooler"
  ],
  "Case Fans": [
    "120mm PWM fan 3 pack",
    "120mm ARGB fan 3 pack",
    "140mm PWM case fans"
  ],
  "Fan Hub / Controller": [
    "PWM fan hub",
    "ARGB PWM fan controller"
  ],
  "Thermal Paste": [
    "thermal paste 4g",
    "thermal paste 8g"
  ],
  "Wi-Fi Card": [
    "PCIe WiFi 6E Bluetooth card",
    "PCIe WiFi 7 Bluetooth card"
  ],
  "Bluetooth Adapter": [
    "Bluetooth 5.3 USB adapter",
    "Bluetooth 5.4 USB adapter"
  ],
  "USB Wi-Fi Adapter": [
    "USB WiFi 6 adapter",
    "USB WiFi 6E adapter"
  ],
  "Ethernet / NIC": [
    "2.5GbE PCIe network card",
    "10GbE PCIe network card"
  ],
  "Capture Card": [
    "1080p 60fps capture card",
    "4K PCIe capture card"
  ],
  "Sound Card": [
    "PCIe 5.1 sound card",
    "PCIe 7.1 sound card"
  ],
  "PCIe Riser": [
    "PCIe 4.0 riser cable",
    "PCIe 5.0 riser cable"
  ],
  "GPU Vertical Mount": [
    "GPU vertical mount PCIe 4.0",
    "GPU vertical mount PCIe 5.0"
  ],
  "GPU Support Bracket": [
    "GPU anti sag support bracket",
    "adjustable GPU support stand"
  ],
  "RGB / ARGB Controller": [
    "ARGB controller hub",
    "USB RGB controller"
  ],
  "Sleeved PSU Cables": [
    "sleeved modular PSU cable kit",
    "sleeved 12VHPWR cable"
  ],
  "PSU Cable Extensions": [
    "sleeved PSU cable extension kit",
    "12VHPWR cable extension"
  ],
  "M.2 Heatsink": [
    "M.2 2280 NVMe heatsink",
    "M.2 heatsink with fan"
  ],
  "SATA Cables": [
    "SATA III data cable pack",
    "right angle SATA cable"
  ],
  "USB Expansion Card": [
    "PCIe USB 3.2 expansion card",
    "PCIe USB-C expansion card"
  ],
  "Thunderbolt Card": [
    "Thunderbolt 4 PCIe add in card",
    "Thunderbolt 5 expansion card"
  ],
  "Front I/O Hub": [
    "5.25 inch USB-C front panel",
    "front panel USB 3.0 hub"
  ],
  "Internal USB Hub": [
    "internal USB 2.0 motherboard hub",
    "internal USB 3.0 hub"
  ],
  "Monitor": [
    "24 inch 1080p 165Hz monitor",
    "27 inch 1440p 165Hz monitor",
    "27 inch 1440p 240Hz monitor",
    "32 inch 4K 144Hz gaming monitor"
  ],
  "Keyboard": [
    "mechanical gaming keyboard TKL",
    "mechanical gaming keyboard 75 percent"
  ],
  "Mouse": [
    "wireless gaming mouse",
    "ultralight gaming mouse"
  ],
  "Headset": [
    "wired gaming headset",
    "wireless gaming headset"
  ],
  "Webcam": [
    "1080p 60fps webcam",
    "4K webcam"
  ],
  "Complete PC": [
    "Ryzen 5 5600 RTX 4060 gaming PC",
    "Ryzen 5 7600 RTX 5070 gaming PC",
    "Ryzen 7 7800X3D RTX 4070 gaming PC"
  ]
};

export const DISCOVERY_TARGETS=SNIPER_CATEGORIES.flatMap(category=>
  (DISCOVERY_SUBTYPES[category.name]||[category.example]).map((query,index)=>({
    id:category.name.toLowerCase().replace(/[^a-z0-9]+/g,"-")+"-"+index,
    category:category.name,
    group:category.group,
    query,
    condition:"any",
    maxPrice:0
  }))
);
