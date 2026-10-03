import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/^\uFEFF/,'');
const dist=path.join(here,'dist');
fs.mkdirSync(dist,{recursive:true});

let html=read('index.html');
const style=read('style.css');
const core=read('core.js');
const excel=read('excel.js');
const cloud=read('online/cloud-adapter.js');
let app=read('app.js');

app=app.replace(/^import \* as pdfjs[^\n]*\n/,"const pdfjs=window.pdfjsLib;\n")
   .replace(/pdfjs\.GlobalWorkerOptions\.workerSrc=[^\n]*\n/,"pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';\n");
const storageStart=app.indexOf('function storageStatus(');
const storageEnd=app.indexOf('function mutate(',storageStart);
if(storageStart<0||storageEnd<0)throw Error('A tárolási blokk nem található az app.js fájlban.');
app=app.slice(0,storageStart)+cloud+'\n'+app.slice(storageEnd);

html=html.replace('<link rel="stylesheet" href="style.css">',`<style>${style}</style>`)
  .replace('<script src="vendor/xlsx.full.min.js" defer></script>','<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script><script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>')
  .replace('<script src="core.js" defer></script>','')
  .replace('<script src="excel.js" defer></script>','')
  .replace('<script src="app.js" type="module"></script>','')
  .replace('Saját eszközön tárolva','Privát Google-felhőben tárolva')
  .replace('Automatikus helyi mentés bekapcsolva','Privát Google-adattár betöltése…')
  .replace('A kivonatok feldolgozása helyben történik. Készíts rendszeresen biztonsági mentést.','A kivonat feldolgozása a böngészőben történik; jóváhagyás után a tranzakciók a privát Google-adattárba kerülnek. Készíts rendszeresen biztonsági mentést.')
  .replace('<div><button id="backup" class="quiet">Biztonsági mentés ↓</button>', '<div><a id="dataSheetLink" class="quiet" target="_blank" rel="noopener" hidden>Privát adattábla ↗</a><button id="backup" class="quiet">Biztonsági mentés ↓</button>')
  .replace('Havi költségvetés · Automatikus mentés ezen a böngészőn. Másik eszközhöz használj JSON-mentést.','Havi költségvetés · Privát Google-mentés, több eszközről elérhető. A JSON-mentés külön biztonsági másolat.')
  .replace('</body>',`<script>${core}</script><script>${excel}</script><script type="module">${app}</script></body>`);

fs.writeFileSync(path.join(dist,'Index.html'),html,'utf8');
fs.copyFileSync(path.join(here,'src','Code.gs'),path.join(dist,'Code.gs'));
fs.copyFileSync(path.join(here,'src','appsscript.json'),path.join(dist,'appsscript.json'));

const clientCheck=app.replace(/^const pdfjs=.*$/m,"const pdfjs={GlobalWorkerOptions:{}};");
fs.writeFileSync(path.join(dist,'client-check.js'),clientCheck,'utf8');
console.log(`Elkészült: online/dist/Index.html (${html.length} karakter)`);



