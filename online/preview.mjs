import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.join(here,'dist','Index.html'),'utf8');
const mock='<script>'+
'let previewRecord={revision:0,updatedAt:null,state:{version:2,transactions:[],subscriptions:[],budgets:{},dismissed:[],imports:[]}};'+
'const runner={success:null,failure:null,withSuccessHandler(fn){this.success=fn;return this},withFailureHandler(fn){this.failure=fn;return this},loadState(){setTimeout(()=>this.success({...previewRecord,sheetUrl:"#preview-sheet"}),0)},saveState(payload){setTimeout(()=>{if(payload.expectedRevision!==previewRecord.revision)return this.failure(new Error("Revízióütközés"));previewRecord={revision:previewRecord.revision+1,updatedAt:new Date().toISOString(),state:structuredClone(payload.state)};this.success({revision:previewRecord.revision,updatedAt:previewRecord.updatedAt,transactions:previewRecord.state.transactions.length})},0)}};'+
'window.google={script:{run:runner}};'+
'</script>';
const html=source.replace('</head>',mock+'</head>');
const port=Number(process.env.PORT||4298);
http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html)}).listen(port,'127.0.0.1',()=>console.log('Online előnézet: http://127.0.0.1:'+port+'/'));

