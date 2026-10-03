const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
test('az Apps Script telepítés csak a tulajdonos számára érhető el',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'src','appsscript.json'),'utf8'));
  assert.equal(manifest.webapp.executeAs,'USER_DEPLOYING');
  assert.equal(manifest.webapp.access,'MYSELF');
  assert.deepEqual(manifest.oauthScopes.sort(),['https://www.googleapis.com/auth/spreadsheets','https://www.googleapis.com/auth/userinfo.email'].sort());
});
test('a szerver zárolást, revízióellenőrzést és A/B mentést használ',()=>{
  const code=fs.readFileSync(path.join(__dirname,'src','Code.gs'),'utf8');
  for(const marker of ['LockService.getScriptLock','expectedRevision !== current.revision',"=== 'B' ? 'A' : 'B'",'digest_(text)','validateState_'])assert.match(code,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});
test('az online kliens a Google-adattárat használja',()=>{
  const html=fs.readFileSync(path.join(__dirname,'dist','Index.html'),'utf8');
  assert.match(html,/google\.script\.run/);
  assert.match(html,/Privát Google-felhőben tárolva/);
  assert.match(html,/saveState/);
  assert.doesNotMatch(html,/openStorageDB\(/);
  assert.match(html,/transactionAccountFilter/);
});

test('a szerver ment, visszaolvas és elutasítja az elavult revíziót',()=>{
  const vm=require('node:vm'),crypto=require('node:crypto');
  const properties=new Map(),sheets=new Map();
  const range=(sheet,r,c,rows,cols)=>({
    setNumberFormat(){return this},
    setValues(values){for(let i=0;i<values.length;i++)sheet.rows[r-1+i]=values[i].slice();return this},
    setValue(value){sheet.rows[r-1]??=[];sheet.rows[r-1][c-1]=value;return this}
  });
  const book={
    id:'book-1',getId(){return this.id},
    getUrl(){return 'https://docs.google.com/spreadsheets/d/book-1/edit'},
    getSheets(){return [...sheets.values()]},
    getSheetByName(name){return sheets.get(name)||null},
    insertSheet(name){const sheet=makeSheet(name);sheets.set(name,sheet);return sheet}
  };
  function makeSheet(name){return {name,rows:[],setName(next){sheets.delete(this.name);this.name=next;sheets.set(next,this);return this},getLastRow(){return this.rows.length},getDataRange(){return {getDisplayValues:()=>this.rows.map(row=>row.map(v=>v instanceof Date?v.toISOString():String(v))) }},clearContents(){this.rows=[]},getRange(r,c,rows=1,cols=1){return range(this,r,c,rows,cols)},autoResizeColumns(){}}}
  const first=makeSheet('Sheet1');sheets.set('Sheet1',first);
  const context={
    console,Date,JSON,Number,Object,Array,String,Set,Map,Error,
    Session:{getActiveUser:()=>({getEmail:()=> 'dobronyikrisztina@gmail.com'}),getEffectiveUser:()=>({getEmail:()=> 'dobronyikrisztina@gmail.com'})},
    LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>properties.get(key)||null,setProperty:(key,value)=>properties.set(key,value)})},
    SpreadsheetApp:{create:()=>book,openById:()=>book,flush(){}},
    Utilities:{Charset:{UTF_8:'utf8'},DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_alg,text)=>[...crypto.createHash('sha256').update(text).digest()],base64Encode:bytes=>Buffer.from(bytes).toString('base64')},
    HtmlService:{createHtmlOutputFromFile:()=>({setTitle(){return this},addMetaTag(){return this}})}
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'src','Code.gs'),'utf8'),context);
  const initial=context.loadState();
  assert.equal(initial.revision,0);
  const state={version:2,transactions:[{id:'t1',date:'2026-10-03',desc:'Próba',amount:-100,currency:'HUF',category:'Egyéb',account:'Erste 78911004'}],subscriptions:[],budgets:{},dismissed:[],imports:[]};
  const saved=context.saveState({expectedRevision:0,state});
  assert.equal(saved.revision,1);
  assert.equal(context.loadState().state.transactions.length,1);
  assert.throws(()=>context.saveState({expectedRevision:0,state}),/Másik eszközön módosult/);
  assert.ok(sheets.has('B'));
});


