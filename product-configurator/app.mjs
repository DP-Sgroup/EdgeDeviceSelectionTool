import {catalog as c,defaults} from './catalog.mjs';
import {validate,generate,bom,csv,snapshot,readSnapshot} from './engine.mjs';
const $=id=>document.getElementById(id),key='dps-configurator-v1';
let s=defaults(),components=structuredClone(c.components),extra=[],step=0;
const names=['Product','Housing & power','Connectivity','Sub-systems','BoM & costs'];
const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const money=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(n);
function notify(message){$('notice').textContent=message;}
try{const saved=localStorage.getItem(key);if(saved){const v=readSnapshot(JSON.parse(saved));s=v.configuration;components=v.components;extra=v.extra;}}catch{notify('The saved draft could not be restored. Default configuration loaded.');}
function persist(){try{if(!validate(s).length)localStorage.setItem(key,JSON.stringify(snapshot(s,components,extra)));}catch{notify('Browser storage unavailable. Download your configuration to keep it.');}}
function select(field,label,options){return `<label>${esc(label)}<select data-field="${field}">${Object.entries(options).map(([v,label])=>`<option value="${esc(v)}" ${s[field]===v?'selected':''}>${esc(label.label??label)} (${esc(v)})</option>`).join('')}</select></label>`;}
function connection(prefix,label,types){return `<h3>${label}</h3><div class="fields"><label>Port count<input data-field="${prefix}Count" type="number" min="0" max="35" value="${s[prefix+'Count']}"></label>${select(prefix+'Type','Connector / speed',types)}</div>`;}
function render(){
  $('steps').innerHTML=names.map((n,i)=>`<button data-step="${i}" class="${step===i?'active':''}" ${step===i?'aria-current="step"':''}>${i+1}. ${n}</button>`).join('');
  $('back').disabled=step===0;$('next').hidden=step===4;$('units').value=s.units;
  let html='';
  if(step===0)html=`<h2>Choose your product</h2><p>Start with the family and platform vendor.</p><div class="fields">${select('family','Product family',{Edge:'DPS Edge',Cyber:'DPS Cyber',Net:'DPS Net'})}${select('vendor','Platform vendor',c.vendors)}${s.family==='Edge'?select('series','Edge series',c.series):''}</div>${s.family==='Edge'&&s.series==='Light'&&s.vendor==='SI'?'<div class="callout"><b>DPS Edge Lite / Light</b><br>Siemens SIMATIC IOT2050 Industrial Edge<br><code>6ES7647-0BW00-1YA2</code><br>ARM64 · 2 GB RAM · 16 GB eMMC · 2 × GbE · 24 VDC<br><a href="https://sieportal.siemens.com/en-ww/products-services/detail/6ES7647-0BW00-1YA2" target="_blank" rel="noreferrer">Siemens product details ↗</a></div>':'<p class="hint">The code defines a capability class. Hardware mappings beyond Lite and the released I/O variants still require engineering definition.</p>'}`;
  if(step===1)html=`<h2>Housing & power</h2><p>These selections apply to the whole unit and its embedded sub-systems.</p><div class="fields">${select('enclosure','Enclosure',c.enclosures)}${select('ip','IP rating',Object.fromEntries(Object.entries(c.ip).filter(([v])=>s.enclosure==='B'?v==='0':s.enclosure==='X'?['0','2'].includes(v):true)))}${select('power','Supply & UPS',c.power)}</div><p class="hint">An enclosure rating does not certify the finished assembly. Glands, cooling, protection and the electrical design must be checked.</p>`;
  if(step===2)html=`<h2>Define physical interfaces</h2><p>The six-character T6 block encodes WAN, LAN and fibre counts and types.</p>${connection('wan','WAN',c.copper)}${connection('lan','LAN',c.copper)}${connection('fibre','Fibre',c.fibre)}<p class="hint">10 = A, 11 = B … 35 = Z. X is reserved for none, so count 33 needs a standard clarification. Zero ports automatically uses type X.</p>${s.family==='Cyber'?`<div class="fields">${select('wireless','Wireless connectivity',c.wireless)}${select('firewall','Firewall class',c.firewall)}</div>`:'<p class="hint">Edge and Net have no standalone wireless field in v1.0. Edge wireless capability is carried by the selected embedded Cyber variant.</p>'}`;
  if(step===3)html=`<h2>Sub-systems & options</h2><p>Only lookup variants released in the standard can be encoded.</p><div class="fields">${s.family==='Edge'?select('io','PLC / I/O',c.io):''}${['Edge','Net'].includes(s.family)?select('cyber','Embedded Cyber',c.cyber):''}${s.family==='Edge'?select('net','Embedded Net',c.net)+select('isolation','I/O isolation',c.isolation)+select('hmi','HMI size',c.hmi)+select('gps','GPS',c.gps):''}</div>${s.family==='Cyber'?'<p>The firewall class and wireless capability were selected under Connectivity. Cyber has no Edge option block.</p>':''}<p class="hint">The standard does not define any embedded Net variants beyond X. Adding variants or changing code meanings requires a new standard version.</p>`;
  if(step===4)html=review();
  $('panel').innerHTML=html;updateSummary();
}
function review(){
  if(validate(s).length)return '<h2>Resolve configuration errors</h2><p>Return to the relevant step before generating a BoM.</p>';
  const r=bom(s,components,extra);
  return `<h2>Review & prepare the unit</h2><p>Component quantities are shown for ${s.units} unit${s.units===1?'':'s'}. Costs exclude VAT.</p><div class="callout"><b>Draft BoM — engineering release required</b><br>Known components are included below. TBC rows identify unresolved assembly requirements; additional parts do not automatically clear those checks.</div><div class="table-wrap"><table><thead><tr><th>Component / requirement</th><th>Per unit / batch</th><th>Unit cost GBP</th><th>Batch cost</th></tr></thead><tbody>${r.lines.map(p=>`<tr><td><code>${esc(p.partNumber)}</code><br>${esc(p.description)}<small>${esc(p.manufacturer)} · ${p.resolved?'Component':'Engineering TBC'}</small></td><td>${p.quantityPerUnit} / ${p.quantity}</td><td>${p.resolved?`<input aria-label="Cost for ${esc(p.partNumber)}" data-price="${esc(p.id)}" type="number" min="0" step="0.01" placeholder="Unknown" value="${p.unitCost??''}">`:'TBC'}</td><td>${p.extendedCost===null?'Unpriced':money(p.extendedCost)}</td></tr>`).join('')}</tbody></table></div><p><b>Known batch subtotal: ${money(r.knownSubtotal)}</b> · ${r.unpriced} unpriced line(s).<br><span class="hint">This is a partial subtotal, not a quotation or complete build cost.</span></p>${r.warnings.length?'<ul>'+r.warnings.map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul>':''}<div class="actions"><button id="csv">Export BoM CSV</button><button id="print" class="secondary">Print review</button></div><h3>Add components to the BoM</h3><form id="add-line" class="inline-form"><label>Component<select name="component">${components.map(p=>`<option value="${esc(p.id)}">${esc(p.partNumber)} — ${esc(p.description)}</option>`).join('')}</select></label><label>Quantity per unit<input name="quantity" type="number" min="1" max="100000" value="1" required></label><button>Add</button></form>${extra.length?'<ul>'+extra.map((x,i)=>`<li>${esc(components.find(p=>p.id===x.componentId).partNumber)} × ${x.quantity} <button class="text" data-remove="${i}">Remove</button></li>`).join('')+'</ul>':''}<details class="component-form"><summary>Add a catalogue component</summary><form id="add-component"><div class="fields"><label>Manufacturer<input name="manufacturer" maxlength="120" required></label><label>Part number<input name="partNumber" maxlength="120" required></label><label>Description<input name="description" maxlength="500" required></label><label>Unit cost GBP (optional)<input name="unitCost" type="number" min="0" step="0.01"></label></div><button>Add to catalogue</button><p class="hint">Catalogue additions and prices are saved in this browser and configuration exports. Shared controlled pricing can be added later.</p></form></details>`;
}
function updateSummary(){
  const errors=validate(s);$('sku').textContent=errors.length?'Configuration incomplete':generate(s);$('copy').disabled=errors.length>0;$('save').disabled=errors.length>0;
  $('status').innerHTML=errors.length?`<div class="error">${errors.map(esc).join('<br>')}</div>`:'<span class="badge">Valid standard code</span> <span class="badge warn">Draft assembly</span>';
  $('summary').innerHTML=[['Family','DPS '+s.family],['Series',s.family==='Edge'?s.series:'—'],['Vendor',c.vendors[s.vendor]],['Housing',c.enclosures[s.enclosure]+' · '+c.ip[s.ip]],['Power',c.power[s.power]],['Standard','v1.0'],['Catalogue',c.revision]].map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
  if(!errors.length){const r=bom(s,components,extra);$('estimate').innerHTML=`<p class="money">${money(r.knownSubtotal)}</p><p class="hint">Known batch subtotal · ${r.unpriced} unpriced line(s)<br>Complete cost pending</p>`;}else $('estimate').textContent='Resolve errors to calculate costs.';
}
function download(name,type,data){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function changed(){persist();render();}
$('steps').onclick=e=>{if(e.target.dataset.step!==undefined){step=Number(e.target.dataset.step);render();}};
$('back').onclick=()=>{step--;render();};$('next').onclick=()=>{step++;render();};
$('panel').addEventListener('change',e=>{
  const f=e.target.dataset.field;
  if(f){s[f]=f.endsWith('Count')?Number(e.target.value):e.target.value;
    if(f==='enclosure'&&(s.enclosure==='B'||s.enclosure==='X'))s.ip=s.enclosure==='B'?'0':'2';
    if(f.endsWith('Count')){const p=f.slice(0,-5);if(s[f]===0)s[p+'Type']='X';else if(s[p+'Type']==='X')s[p+'Type']=p==='fibre'?'F':'G';}
    changed();
  }
  const id=e.target.dataset.price;if(id){const p=components.find(p=>p.id===id);const n=e.target.value===''?null:Number(e.target.value);if(n!==null&&(!Number.isFinite(n)||n<0)){notify('Enter a non-negative cost.');render();return;}p.unitCost=n===null?null:Math.round(n*100)/100;p.priceDate=new Date().toISOString().slice(0,10);changed();}
});
$('panel').onclick=e=>{
  if(e.target.id==='csv')download('DPS-BoM.csv','text/csv;charset=utf-8',csv(bom(s,components,extra)));
  if(e.target.id==='print')window.print();
  if(e.target.dataset.remove!==undefined){extra.splice(Number(e.target.dataset.remove),1);changed();}
};
$('panel').addEventListener('submit',e=>{
  e.preventDefault();const data=new FormData(e.target);
  if(e.target.id==='add-line')extra.push({componentId:data.get('component'),quantity:Number(data.get('quantity'))});
  if(e.target.id==='add-component')components.push({id:'custom-'+crypto.randomUUID(),manufacturer:data.get('manufacturer').trim(),partNumber:data.get('partNumber').trim(),description:data.get('description').trim(),unitCost:data.get('unitCost')===''?null:Math.round(Number(data.get('unitCost'))*100)/100,currency:'GBP',priceDate:new Date().toISOString().slice(0,10),source:'User-entered'});
  changed();
});
$('units').onchange=e=>{s.units=Number(e.target.value);changed();};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(generate(s));notify('Part number copied.');}catch{notify('Clipboard unavailable. Select and copy the part number shown above.');}};
$('save').onclick=()=>download('DPS-configuration.json','application/json',JSON.stringify(snapshot(s,components,extra),null,2));
$('load').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2000000)throw new Error('File is too large (maximum 2 MB).');const v=readSnapshot(JSON.parse(await file.text()));s=v.configuration;components=v.components;extra=v.extra;changed();notify('Configuration and prices loaded.');}catch(err){notify('Could not load configuration: '+err.message);}finally{e.target.value='';}};
$('reset').onclick=()=>{if(window.confirm('Reset configuration, extra lines and locally entered prices? Export first if you want to keep them.')){s=defaults();components=structuredClone(c.components);extra=[];step=0;changed();notify('Configuration reset.');}};
render();
