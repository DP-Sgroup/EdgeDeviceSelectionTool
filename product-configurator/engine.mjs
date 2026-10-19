import {catalog as c} from './catalog.mjs';
export function encodeCount(n) {
  if(!Number.isInteger(n)||n<0||n>35||n===33) throw new Error('Port count must be 0–35, excluding 33 (X is reserved for none).');
  return n.toString(36).toUpperCase();
}
export function validate(s) {
  const errors=[]; const check=(field,lookup)=>{if(!Object.hasOwn(lookup,s[field]))errors.push(`Invalid ${field}.`);};
  check('family',{Edge:1,Cyber:1,Net:1});check('vendor',c.vendors);check('enclosure',c.enclosures);check('ip',c.ip);check('power',c.power);
  if(s.enclosure==='X'&&!['0','2'].includes(s.ip))errors.push('No enclosure (X) permits IP00 or IP20 only.');
  if(s.enclosure==='B'&&s.ip!=='0')errors.push('Backplane (B) requires IP00.');
  for(const [prefix,types] of [['wan',c.copper],['lan',c.copper],['fibre',c.fibre]]){
    const n=s[prefix+'Count'],t=s[prefix+'Type'];
    try{encodeCount(n);}catch(e){errors.push(prefix+': '+e.message);}
    if(!Object.hasOwn(types,t))errors.push(`Invalid ${prefix} port type.`);
    if(n===0&&t!=='X')errors.push(`${prefix}: zero ports requires type X.`);
    if(n>0&&t==='X')errors.push(`${prefix}: present ports require a type.`);
  }
  if(s.family==='Edge') {check('series',c.series);check('io',c.io);check('cyber',c.cyber);check('net',c.net);check('isolation',c.isolation);check('hmi',c.hmi);check('gps',c.gps);}
  if(s.family==='Net')check('cyber',c.cyber);
  if(s.family==='Cyber'){check('firewall',c.firewall);check('wireless',c.wireless);}
  if(!Number.isSafeInteger(s.units)||s.units<1||s.units>100000)errors.push('Batch quantity must be 1–100,000 whole units.');
  return errors;
}
export function generate(s) {
  const errors=validate(s);if(errors.length)throw new Error(errors.join(' '));
  const t6=['wan','lan','fibre'].map(p=>encodeCount(s[p+'Count'])+s[p+'Type']).join('');
  const common=[s.vendor,s.enclosure+s.ip];
  if(s.family==='Edge')return `DPS Edge ${s.series} ${[...common,t6,s.io+s.cyber+s.net,s.isolation+s.hmi+s.gps,s.power].join('-')}`;
  if(s.family==='Cyber')return `DPS Cyber ${[...common,s.firewall,t6,s.wireless,s.power].join('-')}`;
  return `DPS Net ${[...common,t6,s.cyber,s.power].join('-')}`;
}
export function bom(s,components=c.components,extra=[]) {
  const errors=validate(s);if(errors.length)throw new Error(errors.join(' '));
  const lines=[],gaps=[],warnings=[];
  const add=id=>{const p=components.find(p=>p.id===id);if(!p)throw new Error('Missing catalogue component '+id);lines.push({...p,quantityPerUnit:1,resolved:true});};
  const gap=description=>{gaps.push(description);lines.push({id:'gap-'+gaps.length,manufacturer:'TBC',partNumber:'TBC',description,quantityPerUnit:1,unitCost:null,currency:'GBP',resolved:false});};
  if(s.family==='Edge'){
    if(s.series==='Light'&&s.vendor==='SI'){
      add('iot2050');
      if(s.fibreCount||s.wanCount+s.lanCount!==2||[s.wanType,s.lanType].some(t=>!['G','X'].includes(t)))gap('Validate networking hardware: IOT2050 provides two Gigabit RJ45 ports; requested port mix needs engineering review.');
      warnings.push('WAN/LAN assignment is a configuration assumption; verify routing and application compatibility.');
    }else gap(`Select released compute/controller assembly for ${s.vendor} ${s.series}.`);
    c.io[s.io].parts.forEach(add);
    if(s.net!=='X')gap('Embedded Net assembly');
    if(s.isolation==='I')gap('Select isolation components and validate I/O design.');
    if(s.hmi!=='X')gap('Select '+c.hmi[s.hmi]+' HMI and accessories.');
    if(s.gps==='G')gap('Select GPS/GNSS receiver and antenna.');
  }else gap(`Select released ${s.family} base assembly and networking hardware.`);
  if(['Edge','Net'].includes(s.family)&&s.cyber!=='X'){
    gap('Resolve embedded assembly: '+c.cyber[s.cyber].sku);
    warnings.push('Embedded Cyber SKU copied verbatim from §5.8.2; its XX enclosure conflicts with §5.3 and needs a controlled standard clarification.');
  }
  if(!['X','B'].includes(s.enclosure))gap('Select '+c.enclosures[s.enclosure]+' enclosure, '+c.ip[s.ip]+' glands, mounting and protection.');
  if(s.enclosure==='B')gap('Select backplane and mounting kit.');
  if(s.power==='XX')warnings.push('External/inherited power supply must be verified at assembly release.');
  else if(s.power!=='3X')gap('Select power conversion/distribution for '+c.power[s.power]+'.');
  // A syntactically valid SKU is not a released electrical design.
  gap('Assembly release: confirm terminals, wiring, fusing, mounting, licences, labour and test procedure.');
  for(const row of extra){
    const p=components.find(p=>p.id===row.componentId);
    if(!p||!Number.isSafeInteger(row.quantity)||row.quantity<1||row.quantity>100000)throw new Error('Invalid additional BoM line.');
    const existing=lines.find(x=>x.id===p.id&&x.resolved);if(existing)existing.quantityPerUnit+=row.quantity;else lines.push({...p,quantityPerUnit:row.quantity,resolved:true});
  }
  for(const p of lines){
    if(p.currency!=='GBP')throw new Error('Only GBP costs are supported; convert supplier prices before entry.');
    if(p.unitCost!==null&&(!Number.isFinite(p.unitCost)||p.unitCost<0))throw new Error('Costs must be non-negative or unknown.');
    p.quantity=p.quantityPerUnit*s.units;
    const cents=p.unitCost===null?null:Math.round(p.unitCost*100)*p.quantity;
    if(cents!==null&&!Number.isSafeInteger(cents))throw new Error('Extended cost exceeds the supported monetary range.');
    p.extendedCost=cents===null?null:cents/100;
  }
  const unpriced=lines.filter(p=>p.unitCost===null).length;
  const subtotalCents=lines.reduce((n,p)=>n+Math.round((p.extendedCost??0)*100),0);
  if(!Number.isSafeInteger(subtotalCents))throw new Error('Batch subtotal exceeds the supported monetary range.');
  const knownSubtotal=subtotalCents/100;
  return {sku:generate(s),lines,gaps,warnings,units:s.units,currency:'GBP',knownSubtotal,unpriced,complete:gaps.length===0&&unpriced===0,productionReady:false};
}
export function csv(result){
  const safe=v=>{let text=String(v??'');if(/^[=+@\-\t\r\n]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
  return [['SKU','Part number','Description','Qty per unit','Batch qty','Unit cost GBP','Extended cost GBP','Status'],...result.lines.map(p=>[result.sku,p.partNumber,p.description,p.quantityPerUnit,p.quantity,p.unitCost,p.extendedCost,p.resolved?'Component':'Engineering TBC'])].map(row=>row.map(safe).join(',')).join('\r\n');
}
export function snapshot(s,components,extra){return {schemaVersion:1,standard:c.standard,catalogRevision:c.revision,createdAt:new Date().toISOString(),configuration:{...s},components:structuredClone(components),extra:structuredClone(extra),result:bom(s,components,extra)};}
export function readSnapshot(value){
  if(!value||value.schemaVersion!==1||value.standard!==c.standard||value.catalogRevision!==c.revision)throw new Error('Unsupported configuration or catalogue revision.');
  if(!value.configuration||validate(value.configuration).length)throw new Error('Invalid imported configuration.');
  if(!Array.isArray(value.components)||value.components.length>500||!Array.isArray(value.extra)||value.extra.length>500)throw new Error('Invalid component catalogue.');
  const ids=new Set();
  for(const p of value.components){
    if(!p||typeof p.id!=='string'||!p.id||ids.has(p.id))throw new Error('Duplicate or invalid component ID.');ids.add(p.id);
    for(const key of ['description','manufacturer','partNumber'])if(typeof p[key]!=='string'||!p[key].trim()||p[key].length>1000)throw new Error('Invalid component '+key);
    if(p.currency!=='GBP'||(p.unitCost!==null&&(!Number.isFinite(p.unitCost)||p.unitCost<0)))throw new Error('Invalid component price.');
  }
  // Preserve controlled standard part identities. Imports may change prices, not mappings.
  for(const base of c.components){const p=value.components.find(p=>p.id===base.id);if(!p||p.partNumber!==base.partNumber||p.manufacturer!==base.manufacturer)throw new Error('Controlled component identity changed: '+base.id);}
  bom(value.configuration,value.components,value.extra);
  return {configuration:value.configuration,components:value.components,extra:value.extra};
}
