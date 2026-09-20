(function(root){
'use strict';
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function money(value){
 if(typeof value==='number'){if(!Number.isFinite(value))throw Error('Érvénytelen összeg');return round(value);}
 let s=String(value??'').trim().replace(/(?:HUF|EUR|Ft|€)/gi,'').replace(/[\s\u00a0\u202f]/g,'').replace(/−/g,'-');
 if(!/^[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(s)) throw Error('Nem egyértelmű magyar összeg: '+value);
 return round(Number(s.replace(/\./g,'').replace(',','.')));
}
function date(value){
 if(value instanceof Date&&!isNaN(value))return value.toISOString().slice(0,10);
 let s=String(value??'').trim(),m=s.match(/^(\d{4})[.\/-](\d{2})[.\/-](\d{2})\.?$/);
 if(!m){const months=['jan','febr','marc','apr','maj','jun','jul','aug','szept','okt','nov','dec'];const h=norm(s).match(/^(\d{4})\.\s*([a-z]+)\.\s*(\d{1,2})\.$/);if(h&&months.includes(h[2]))m=[s,h[1],String(months.indexOf(h[2])+1).padStart(2,'0'),h[3].padStart(2,'0')];}
 if(!m)throw Error('Érvénytelen dátum: '+s);
 const iso=`${m[1]}-${m[2]}-${m[3]}`;if(new Date(iso+'T12:00:00Z').toISOString().slice(0,10)!==iso)throw Error('Érvénytelen dátum: '+s);return iso;
}
function rows(items){const out=[];for(const item of [...items].sort((a,b)=>a.y-b.y||a.x-b.x)){let row=out.at(-1);if(!row||Math.abs(row.y-item.y)>2){row={y:item.y,items:[]};out.push(row);}row.items.push(item);}return out.map(r=>({...r,items:r.items.sort((a,b)=>a.x-b.x)}));}
const txt=(r,a=-Infinity,b=Infinity)=>r.items.filter(i=>i.x>=a&&i.x<b).map(i=>i.text).join(' ').trim();
const subscriptionPattern=/netflix|spotify|youtube|google (?:play|one)|microsoft|scribd|openai|chatgpt|claude|anthropic|apple\.com|icloud|disney|hbo|canva|simplep cloud/i;
function classify(t){const s=norm(t.desc+' '+(t.bankCategory||''));if(/feltoltes|atvaltas|devizavaltas|sajat szamlarol/.test(s))return 'Belső pénzmozgás';if(subscriptionPattern.test(t.desc))return 'Előfizetés';if(t.amount>0)return /visszater|visszafiz/.test(s)?'Visszatérítés':'Bevétel';if(/lidl|aldi|kifli|spar|tesco|auchan|jonas|manna|pek|stud enac|studenac/.test(s))return 'Élelmiszer';if(/vinted|shein|dm |rossmann|regio/.test(s))return 'Vásárlás';if(/foxpost|gls|autoceste|mav|bkk|shell|mol /.test(s))return 'Közlekedés és szállítás';if(/dij|kamat/.test(s))return 'Banki díjak';if(/bar|etterem|kave|kantin/.test(s))return 'Vendéglátás';return 'Egyéb';}
function parsePDF(pages){
 const all=pages.flat().map(i=>i.text).join(' '),bank=/HITELSZÁMLA FORGALOM/.test(all)?'Erste':/Revolut/.test(all)?'Revolut':null;
 if(!bank)throw Error('Nem támogatott kivonatformátum. Erste hitelkártya- vagy Revolut egyedi kivonat szükséges.');
 const transactions=[],errors=[],checks=[],expected={},opening={};let pending=null,currency='HUF',summaryCurrency='HUF',active=false,account='';
 const iban=all.match(/HU\d{2}(?:\s*\d){24}/);account=bank+' '+(iban?iban[0].replace(/\s/g,'').slice(-8):'számla');
 function finish(){if(!pending)return;try{
  const t=pending;if(bank==='Revolut'){
   const a=t.amountLines.join(' '),b=t.balanceLines.join(' ');const number='[+-]?[\\d \\u00a0]+,\\d{2}';
   const amountMatch=a.match(new RegExp('('+number+')\\s*'+(t.currency==='EUR'?'€':'HUF')));const balanceMatch=b.match(new RegExp('('+number+')\\s*'+(t.currency==='EUR'?'€':'HUF')));
   if(!amountMatch||!balanceMatch)throw Error('Hiányzó összeg vagy egyenleg');t.amount=money(amountMatch[1]);t.balance=money(balanceMatch[1]);
   if(t.currency==='EUR'){const h=a.match(new RegExp('('+number+')\\s*HUF'));if(h)t.amountHuf=money(h[1]);}
   t.desc=t.descriptions.join(' ');t.bankCategory=t.categories.join(' ');
  }else{
   const detail=t.details.join(' ');const merchant=detail.match(/ATM,POS-Cím\s+(.*?)(?=Kártyaszám|$)/i);
   if(merchant)t.desc=merchant[1].replace(/^Google Pay\s+\S+\s*/i,'').trim();
   else t.desc=[t.desc,...t.details.filter(s=>!/IBAN|azonosító|idopontja|Kártyaszám/i.test(s))].join(' ');
   t.reference=detail.match(/Kártyaszám-Tr\. azon\.\s*\S+\s*-\s*(\d+)/)?.[1]||detail.match(/Tranzakció azonosító:\s*(\S+)/)?.[1]||'';
  }
  if(!t.desc||!Number.isFinite(t.amount)||!Number.isFinite(t.balance))throw Error('Hiányos tétel');
  const clean={date:t.date,bookingDate:t.bookingDate||t.date,desc:t.desc.trim(),amount:t.amount,currency:t.currency,bank,account,reference:t.reference||'',balance:t.balance,page:t.page,bankCategory:t.bankCategory||'',category:classify(t)};
  if(t.amountHuf!==undefined)clean.amountHuf=t.amountHuf;
  transactions.push(clean);
 }catch(e){errors.push(`${pending.page}. oldal, ${pending.date}: ${e.message}`);}pending=null;}
 for(let p=0;p<pages.length;p++){
  const lines=rows(pages[p]),pageText=lines.map(r=>txt(r)).join('\n');
  const section=pageText.match(/Személyes számla\s*\((HUF|EUR)\)/);if(section)summaryCurrency=section[1];
  for(const r of lines){const s=txt(r);if(/Nyitóegyenleg/.test(s)){try{opening[summaryCurrency]=money(s.replace(/^.*Nyitóegyenleg\s*/,''));}catch{}}}
  if(bank==='Erste'){
   if(!pageText.includes('HITELSZÁMLA FORGALOM'))continue;
   for(const r of lines){const s=txt(r);if(r.y<135||/^\d+\/\d+ oldal/.test(s))continue;
    if(/^Összes terhelés/.test(s)){finish();expected.expense=money(s.replace('Összes terhelés',''));continue;}
    if(/^Összes jóváírás/.test(s)){expected.income=money(s.replace('Összes jóváírás',''));continue;}
    if(/^Záró egyenleg/.test(s)){expected.close=money(s.replace('Záró egyenleg',''));continue;}
    const dates=txt(r,0,125).match(/\d{4}\.\d{2}\.\d{2}\./g)||[];
    if(dates.length===1&&!transactions.length&&!pending&&txt(r,435,520)){opening.HUF=money(txt(r,435,520));continue;}
    if(dates.length===2){finish();try{pending={date:date(dates[1]),bookingDate:date(dates[0]),desc:txt(r,125,370),amount:money(txt(r,370,435)),balance:money(txt(r,435,520)),currency:'HUF',page:p+1,details:[]};}catch(e){errors.push(`${p+1}. oldal: ${e.message}`);} }
    else if(pending&&r.y<795){const d=txt(r,125,370);if(d)pending.details.push(d);}
   }
  }else{
   const header=pages[p].find(i=>i.text==='Dátum'),description=pages[p].find(i=>i.text==='Leírás'),cat=pages[p].find(i=>i.text==='Kategória'),amount=pages[p].find(i=>i.text==='Pénz be-'),bal=pages[p].find(i=>i.text==='Egyenleg'),tax=pages[p].find(i=>i.text==='Általad');
   if(!header||!description||!cat||!amount||!bal||!tax)continue;
   if(section){finish();currency=section[1];}active=true;
   for(const r of lines){if(r.y<=header.y+14)continue;
    const d=txt(r,0,description.x-1);let a=txt(r,amount.x-1,bal.x-1),b=txt(r,bal.x-1,tax.x-1);const joined=a.match(/^(.+?HUF)\s+([+-]?[\d ]+,\d{2})$/);if(joined&&!b){a=joined[1];b=joined[2];}
    if(d==='Végösszeg'){finish();if(a){try{expected[currency]=money(a);}catch(e){errors.push('Nem olvasható végösszeg: '+currency);}}active=false;continue;}
    if(!active)continue;
    if(/^\d{4}\.\s/.test(d)){finish();try{pending={date:date(d),currency,page:p+1,descriptions:[],categories:[],amountLines:[],balanceLines:[]};}catch(e){errors.push(`${p+1}. oldal: ${e.message}`);}}
    if(pending){const desc=txt(r,description.x-1,cat.x-1),c=txt(r,cat.x-1,amount.x-1);if(desc)pending.descriptions.push(desc);if(c)pending.categories.push(c);if(a)pending.amountLines.push(a);if(b)pending.balanceLines.push(b);}
   }
  }
 }
 finish();
 function check(label,actual,want){const ok=Number.isFinite(want)&&Math.abs(round(actual-want))<0.011;checks.push({label,actual:round(actual),expected:want,ok});if(!ok)errors.push(label+': az összeg nem egyezik a kivonattal.');}
 for(const c of [...new Set(transactions.map(t=>t.currency))]){const ts=transactions.filter(t=>t.currency===c);let prev=opening[c];if(prev===undefined)errors.push('Hiányzó nyitóegyenleg: '+c);let mismatches=0;for(const t of ts){if(prev!==undefined&&Math.abs(round(prev+t.amount-t.balance))>0.011)mismatches++;prev=t.balance;}checks.push({label:`${c}: ${ts.length} tétel egyenleglánca`,ok:!mismatches&&opening[c]!==undefined});if(mismatches)errors.push(`${c}: ${mismatches} tételnél eltér az egyenleg.`);if(bank==='Revolut')check(c+' végösszeg',ts.reduce((s,t)=>s+t.amount,0),expected[c]);}
 if(bank==='Erste'){check('Összes terhelés',transactions.reduce((s,t)=>s+Math.max(0,-t.amount),0),expected.expense);check('Összes jóváírás',transactions.reduce((s,t)=>s+Math.max(0,t.amount),0),expected.income);check('Záró egyenleg',(opening.HUF||0)+transactions.reduce((s,t)=>s+t.amount,0),expected.close);}
 if(!transactions.length)errors.push('Nem található feldolgozható tranzakció.');
 return {bank,transactions,checks,errors};
}
function key(t){return JSON.stringify([t.account||t.bank||'',t.currency||'HUF',t.bookingDate||t.date,t.date,t.amount,t.reference||t.desc,t.balance??'']);}
function merge(existing,incoming){const counts=new Map();for(const t of existing)counts.set(key(t),(counts.get(key(t))||0)+1);const seen=new Map(),added=[];let duplicates=0;for(const t of incoming){const k=key(t),n=(seen.get(k)||0)+1;seen.set(k,n);if(n<=(counts.get(k)||0))duplicates++;else added.push(t);}return {added,duplicates};}
const api={money,date,rows,parsePDF,round,norm,classify,key,merge,subscriptionPattern};if(typeof module!=='undefined')module.exports=api;root.BudgetCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
