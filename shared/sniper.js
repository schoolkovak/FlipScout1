export const SNIPER_CATEGORIES = [
  {name:"GPU",group:"Core components",example:"RTX 5070 Ti 16GB",include:["gpu","graphics","geforce","radeon","rtx","rx","arc"],exclude:["laptop","waterblock","heatsink","backplate","replacement fan","empty box","riser","prebuilt","gaming pc"]},
  {name:"CPU",group:"Core components",example:"Ryzen 7 9800X3D",include:["cpu","processor","ryzen","intel","core"],exclude:["laptop","motherboard combo","bundle","prebuilt","gaming pc"]},
  {name:"Motherboard",group:"Core components",example:"B650 AM5 motherboard",include:["motherboard","mainboard","b650","b550","b760","z790","x870"],exclude:["combo","bundle","with cpu","cpu included"]},
  {name:"RAM / Memory",group:"Core components",example:"32GB DDR5 6000 CL30",include:["ram","memory","ddr4","ddr5"],exclude:["sodimm","so-dimm","laptop"]},
  {name:"NVMe SSD",group:"Storage",example:"2TB NVMe SSD",include:["nvme","ssd","m.2","m2"],exclude:["enclosure","adapter","heatsink","cable","dock"]},
  {name:"SATA SSD",group:"Storage",example:"2TB SATA SSD",include:["sata","ssd"],exclude:["enclosure","adapter","cable","dock"]},
  {name:"Hard Drive / HDD",group:"Storage",example:"4TB 7200RPM HDD",include:["hdd","hard drive","7200"],exclude:["enclosure","dock","adapter"]},
  {name:"Power Supply / PSU",group:"Power & chassis",example:"850W 80+ Gold ATX 3.1 PSU",include:["psu","power supply","80 plus","atx 3"],exclude:["cable only","replacement cable","extension cable","adapter"]},
  {name:"PC Case",group:"Power & chassis",example:"ATX airflow RGB case",include:["pc case","computer case","chassis","tower","atx case"],exclude:["case fan","fan only","side panel","front panel","replacement panel"]},
  {name:"CPU Air Cooler",group:"Cooling",example:"dual tower CPU air cooler",include:["air cooler","cpu cooler","tower cooler","heatsink"],exclude:["bracket only","mounting kit","retention kit","replacement fan"]},
  {name:"AIO Liquid Cooler",group:"Cooling",example:"360mm AIO liquid cooler",include:["aio","liquid cooler","liquid cooling"],exclude:["bracket only","mounting kit","retention kit","replacement fan"]},
  {name:"Case Fans",group:"Cooling",example:"120mm ARGB fan 3 pack",include:["case fan","argb fan","rgb fan","120mm","140mm"],exclude:["cpu cooler","gpu fan","replacement gpu"]},
  {name:"Fan Hub / Controller",group:"Cooling",example:"PWM ARGB fan hub controller",include:["fan hub","fan controller","pwm hub"],exclude:["fan pack","case fan"]},
  {name:"Thermal Paste",group:"Cooling",example:"high performance thermal paste",include:["thermal paste","thermal compound"],exclude:["thermal pad","liquid metal"]},
  {name:"Wi-Fi Card",group:"Networking",example:"PCIe Wi-Fi 7 Bluetooth card",include:["wifi","wi-fi","pcie","wireless card"],exclude:["usb wifi","router","access point"]},
  {name:"Bluetooth Adapter",group:"Networking",example:"Bluetooth 5.4 USB adapter",include:["bluetooth","adapter"],exclude:["wifi card","router"]},
  {name:"USB Wi-Fi Adapter",group:"Networking",example:"USB Wi-Fi 6E adapter",include:["usb","wifi","wi-fi","wireless"],exclude:["pcie","router","access point"]},
  {name:"Ethernet / NIC",group:"Networking",example:"2.5GbE PCIe network card",include:["ethernet","network card","nic","2.5gbe","10gbe"],exclude:["router","switch","usb hub"]},
  {name:"Capture Card",group:"Expansion",example:"4K PCIe capture card",include:["capture card","pcie capture","4k capture"],exclude:["camera","webcam"]},
  {name:"Sound Card",group:"Expansion",example:"PCIe sound card",include:["sound card","audio card","pcie audio"],exclude:["usb dac","speaker"]},
  {name:"PCIe Riser",group:"Expansion",example:"PCIe 4.0 riser cable",include:["pcie riser","riser cable"],exclude:["gpu","vertical mount kit"]},
  {name:"GPU Vertical Mount",group:"Expansion",example:"GPU vertical mount PCIe 4.0",include:["vertical gpu mount","gpu vertical mount"],exclude:["gpu card","support bracket"]},
  {name:"GPU Support Bracket",group:"Expansion",example:"GPU anti-sag support bracket",include:["gpu support","anti sag","support bracket"],exclude:["vertical mount"]},
  {name:"RGB / ARGB Controller",group:"Expansion",example:"ARGB RGB controller hub",include:["argb controller","rgb controller","lighting hub"],exclude:["fan hub"]},
  {name:"Sleeved PSU Cables",group:"Cables & accessories",example:"sleeved modular PSU cable kit",include:["sleeved cable","modular cable","psu cable"],exclude:["extension cable","adapter"]},
  {name:"PSU Cable Extensions",group:"Cables & accessories",example:"sleeved PSU cable extension kit",include:["cable extension","psu extension"],exclude:["modular replacement"]},
  {name:"M.2 Heatsink",group:"Cables & accessories",example:"M.2 NVMe heatsink",include:["m.2 heatsink","nvme heatsink"],exclude:["ssd drive"]},
  {name:"SATA Cables",group:"Cables & accessories",example:"SATA III data cable pack",include:["sata cable","sata iii cable"],exclude:["ssd","hard drive"]},
  {name:"USB Expansion Card",group:"Expansion",example:"PCIe USB 3.2 expansion card",include:["pcie usb","usb expansion card"],exclude:["usb hub external"]},
  {name:"Thunderbolt Card",group:"Expansion",example:"Thunderbolt 4 PCIe add-in card",include:["thunderbolt","add-in card","pcie"],exclude:["dock","laptop"]},
  {name:"Front I/O Hub",group:"Cables & accessories",example:"5.25 front panel USB-C hub",include:["front panel","front io","5.25","usb c hub"],exclude:["external hub"]},
  {name:"Internal USB Hub",group:"Cables & accessories",example:"internal USB 2.0 motherboard hub",include:["internal usb hub","motherboard usb hub"],exclude:["external hub"]},
  {name:"Monitor",group:"Peripherals",example:"27 inch 1440p 165Hz gaming monitor",include:["monitor","display","144hz","165hz","240hz"],exclude:["laptop","screen replacement"]},
  {name:"Keyboard",group:"Peripherals",example:"mechanical gaming keyboard",include:["keyboard","mechanical"],exclude:["keycap only","switch only"]},
  {name:"Mouse",group:"Peripherals",example:"wireless gaming mouse",include:["mouse","gaming mouse"],exclude:["mouse pad","mousepad"]},
  {name:"Headset",group:"Peripherals",example:"wireless gaming headset",include:["headset","gaming headset"],exclude:["stand only","ear pads"]},
  {name:"Webcam",group:"Peripherals",example:"1080p 60fps webcam",include:["webcam","web camera"],exclude:["security camera"]},
  {name:"Complete PC",group:"Systems",example:"Ryzen 5 7600 RTX 5070 gaming PC",include:["gaming pc","gaming desktop","desktop computer","prebuilt"],exclude:["laptop","notebook","case only","parts only"]}
];

export const SNIPER_MARKETPLACES = [
  {id:"amazon",name:"Amazon",domain:"amazon.com",supports:["new","renewed","refurbished","used","any"]},
  {id:"newegg",name:"Newegg",domain:"newegg.com",supports:["new","open-box","refurbished","used","any"]},
  {id:"ebay",name:"eBay",domain:"ebay.com",supports:["new","open-box","renewed","refurbished","used","any"]},
  {id:"mercari",name:"Mercari",domain:"mercari.com",supports:["new","open-box","renewed","refurbished","used","any"]}
];

export const SNIPER_CONDITIONS = [
  {value:"any",label:"Any condition"},
  {value:"new",label:"New"},
  {value:"open-box",label:"Open box"},
  {value:"renewed",label:"Renewed"},
  {value:"refurbished",label:"Refurbished"},
  {value:"used",label:"Used"}
];

export function sniperCategory(name){
  return SNIPER_CATEGORIES.find(x=>x.name===name)||SNIPER_CATEGORIES[0];
}

export function groupedSniperCategories(){
  const groups={};
  for(const item of SNIPER_CATEGORIES)(groups[item.group]||(groups[item.group]=[])).push(item);
  return groups;
}
