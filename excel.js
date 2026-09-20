(function(root){
'use strict';
const C=typeof module!=='undefined'?require('./core.js'):root.BudgetCore;
const headers=['Dátum','Leírás','Összeg','Pénznem','Kategória','Bank','Számla','Könyvelés dátuma','Referencia','Egyenleg','Forrás','Forrásoldal','Forint ellenérték'];
function read(wb,X){const sheet=wb.Sheets['Tranzakciók']||wb.Sheets[wb.SheetNames[0]];const grid=X.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true});if(!grid.length)throw Error('Üres munkalap.');const h=grid[0].map(x=>String(x).trim());for(const n of headers.slice(0,4))if(!h.includes(n))throw Error('Hiányzó oszlop: '+n+'. Használd az import-sablont.');
 const transactions=[],errors=[];
 for(let i=1;i<grid.length;i++){const row=grid[i];if(row.every(x=>x===''))continue;const get=n=>row[h.indexOf(n)]??'';try{
  const amountCell=sheet[X.utils.encode_cell({r:i,c:h.indexOf('Összeg')})];if(amountCell?.f)throw Error('Képlet helyett számszerű összeget adj meg.');
  let d=get('Dátum');if(typeof d==='number'){const p=X.SSF.parse_date_code(d,{date1904:!!wb.Workbook?.WBProps?.date1904});if(!p)throw Error('Hibás Excel-dátum');d=`${p.y}-${String(p.m).padStart(2,'0')}-${String(p.d).padStart(2,'0')}`;}
  const currency=String(get('Pénznem')).trim().toUpperCase();if(!['HUF','EUR'].includes(currency))throw Error('Csak HUF vagy EUR pénznem támogatott.');const desc=String(get('Leírás')).trim();if(!desc)throw Error('Hiányzó leírás');const t={date:C.date(d),desc,amount:C.money(get('Összeg')),currency,bank:String(get('Bank')||'Excel'),account:String(get('Számla')||'Excel'),reference:String(get('Referencia')),source:String(get('Forrás')),page:get('Forrásoldal')};
  t.bookingDate=get('Könyvelés dátuma')?C.date(get('Könyvelés dátuma')):t.date;t.category=String(get('Kategória')||C.classify(t));if(get('Egyenleg')!=='')t.balance=C.money(get('Egyenleg'));if(get('Forint ellenérték')!=='')t.amountHuf=C.money(get('Forint ellenérték'));transactions.push(t);
 }catch(e){errors.push(`${i+1}. sor: ${e.message}`);}}
 return {transactions,errors,checks:[{label:'Excel-sorok formai ellenőrzése (banki egyeztetés nélkül)',ok:errors.length===0}]};
}
function build(transactions,subscriptions,X){const wb=X.utils.book_new(),data=[headers,...transactions.map(t=>[t.date,t.desc,t.amount,t.currency,t.category,t.bank||'',t.account||'',t.bookingDate||t.date,t.reference||'',t.balance??'',t.source||'',t.page||'',t.amountHuf??''])];const ws=X.utils.aoa_to_sheet(data);ws['!cols']=[{wch:13},{wch:48},{wch:17},{wch:11},{wch:24},{wch:12},{wch:25},{wch:18},{wch:25},{wch:17},{wch:35},{wch:12},{wch:20}];ws['!autofilter']={ref:ws['!ref']};for(let i=1;i<data.length;i++)for(const c of [2,9,12]){const cell=ws[X.utils.encode_cell({r:i,c})];if(cell?.t==='n')cell.z='#,##0.00';}X.utils.book_append_sheet(wb,ws,'Tranzakciók');if(subscriptions){const ss=X.utils.aoa_to_sheet([['Szolgáltatás','Összeg','Pénznem','Gyakoriság','Következő terhelés','Állapot'],...subscriptions.map(s=>[s.name,s.amount,s.currency,s.cycle,s.next,s.status])]);ss['!cols']=[{wch:30},{wch:15},{wch:12},{wch:15},{wch:22},{wch:15}];X.utils.book_append_sheet(wb,ss,'Előfizetések');}return wb;}
const api={read,build,headers};if(typeof module!=='undefined')module.exports=api;root.BudgetExcel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
