export const catalog = {
  revision: '2026-10-19.1', standard: 'DPS_IMS_STAND0001 v1.0 (04/02/2026)',
  vendors: {AB:'Rockwell Automation',SC:'Schneider Electric',SI:'Siemens',FT:'Fortinet',TL:'Teltonika',PF:'Palo Alto'},
  series: {Light:'Lite / Light — entry-level edge',Core:'Core — main edge compute',Pro:'Pro — high-performance edge',IO:'IO — I/O-centric edge'},
  enclosures: {P:'Plastic',M:'Mild steel',S:'Stainless steel',B:'Backplane only',X:'No enclosure'},
  ip: {'0':'IP00','2':'IP20','5':'IP54','6':'IP65','7':'IP67'},
  power: {'1U':'230 VAC with UPS','1X':'230 VAC, no UPS','2U':'110 VAC with UPS','2X':'110 VAC, no UPS','3U':'24 VDC with UPS','3X':'24 VDC, no UPS','4U':'48 VDC with UPS','4X':'48 VDC, no UPS','XX':'External / inherited power'},
  copper: {G:'Gigabit RJ45',F:'Fast Ethernet RJ45',M:'Gigabit M12',N:'Fast Ethernet M12',X:'Not present'},
  fibre: {A:'Fast Ethernet single-mode',B:'Gigabit single-mode',C:'Fast Ethernet multi-mode',D:'Gigabit multi-mode',E:'Fast Ethernet SFP',F:'Gigabit SFP',X:'Not present'},
  wireless: {X:'None',W:'Wi-Fi',L:'LTE / 4G','5':'5G',C:'Wi-Fi + LTE',F:'Wi-Fi + 5G'},
  firewall: {S:'Stateless — site level',C:'Stateless — cell level',N:'Next-generation'},
  io: {X:{label:'No local I/O',parts:[]},A:{label:'LOGO! 24Ceo',parts:['logo']},B:{label:'LOGO! 24Ceo + DM8 12/24R',parts:['logo','dm8']},C:{label:'S7-1200 G2 CPU 1212C',parts:['s71200']}},
  cyber: {X:{label:'No embedded Cyber',sku:null},A:{label:'Siemens cell firewall',sku:'DPS Cyber SI-XX-C-1F4F0X-X-XX'},B:{label:'Siemens site firewall',sku:'DPS Cyber SI-XX-S-2G4G2F-X-XX'},C:{label:'Teltonika gateway',sku:'DPS Cyber TL-XX-C-1G1G0X-C-XX'}},
  net: {X:'No embedded Net — no other variants released in v1.0'},
  isolation: {X:'No isolation',I:'Isolated I/O present'},
  hmi: {X:'No HMI','1':'1 inch','2':'2 inch','3':'3 inch','4':'4 inch','5':'5 inch','6':'6 inch','7':'7 inch','8':'8 inch','9':'9 inch',A:'10 inch',B:'11 inch',C:'12 inch',D:'13 inch',E:'15 inch'},
  gps: {X:'No GPS',G:'GPS / GNSS present'},
  components: [
    {id:'iot2050',manufacturer:'Siemens',partNumber:'6ES7647-0BW00-1YA2',description:'SIMATIC IOT2050 Industrial Edge (ARM64), 2 GB RAM, 16 GB eMMC, 2 × GbE RJ45, 24 VDC, IP20',unitCost:null,currency:'GBP',priceDate:null,source:'https://mall.industry.siemens.com/mall/en/WW/Catalog/Product/6ES7647-0BW00-1YA2'},
    {id:'logo',manufacturer:'Siemens',partNumber:'6ED1052-2CC08-0BA2',description:'LOGO! 24Ceo controller',unitCost:null,currency:'GBP',priceDate:null,source:'DPS_IMS_STAND0001 §5.8.1'},
    {id:'dm8',manufacturer:'Siemens',partNumber:'6ED1055-1MB00-0BA2',description:'LOGO! DM8 12/24R expansion',unitCost:null,currency:'GBP',priceDate:null,source:'DPS_IMS_STAND0001 §5.8.1'},
    {id:'s71200',manufacturer:'Siemens',partNumber:'6ES7212-1AG50-0XB0',description:'SIMATIC S7-1200 G2 CPU 1212C',unitCost:null,currency:'GBP',priceDate:null,source:'DPS_IMS_STAND0001 §5.8.1'}
  ]
};
export function defaults() { return {family:'Edge',series:'Light',vendor:'SI',enclosure:'X',ip:'2',wanCount:1,wanType:'G',lanCount:1,lanType:'G',fibreCount:0,fibreType:'X',power:'3X',io:'X',cyber:'X',net:'X',isolation:'X',hmi:'X',gps:'X',firewall:'C',wireless:'X',units:1}; }
