import {clean,types,isAudit,date,audit,effective,mapped,parse,fields} from './engine.mjs';
import {workbook} from './workbook.mjs';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=(a,first='')=>(first?'<option value="">'+esc(first)+'</option>':'')+a.map(x=>'<option>'+esc(x)+'</option>').join('');
const now=()=>new Date().toISOString(), id=()=>crypto.randomUUID();
const taipei=t=>new Date(t).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false});
const localDate=t=>{const y=date(t);return y?(+y.slice(0,4)-1911)+'/'+y.slice(5).replace('-','/'):'日期缺口'};
let db,rows=[],tab='audit',current,photoURL,display=[],rules={modules:{},triggers:[]},page=0;
const PAGE=60;
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open('yhn-visit-audit-1',1);r.onupgradeneeded=()=>r.result.createObjectStore('rows',{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
function transaction(mode,fn){return new Promise((res,rej)=>{const t=db.transaction('rows',mode),r=fn(t.objectStore('rows'));t.oncomplete=()=>res(r?.result);t.onerror=t.onabort=()=>rej(t.error||Error('交易已取消'));});}
async function reload(){rows=await transaction('readonly',s=>s.getAll());render();}
async function insert(list){
 if(!list.length)throw Error('沒有可匯入的紀錄');
 const batch=id(),at=now();
 await transaction('readwrite',s=>list.forEach(row=>s.add({id:id(),batch,at,history:[],...row})));
 await reload();
 $('message').textContent='已匯入 '+list.length+' 筆，請依來源列檢核。';
}
const visitProblems=r=>{
 const d=effective(r),issues=[];
 if(!r.version)issues.push('資料缺口：未填來源版本');
 if(r.problem&&!r.fix)issues.push(r.problem);
 if(!date(d.date))issues.push('資料缺口：紀錄日期');
 if(!d.name)issues.push('資料缺口：個案姓名');
 if(!d.supervisor)issues.push('資料缺口：督導');
 if(!d.detail&&!d.change&&!d.action)issues.push('資料缺口：未登錄原件所述狀況、異動或處置');
 if((r.photo||r.ocr)&&!r.review?.approved)issues.push('待人工確認：請對照原件逐欄檢查');
 return issues;
};
const refs=[];
function setTab(t){tab=t;page=0;
 document.querySelectorAll('[data-tab]').forEach(b=>b.dataset.tab===t?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current'));
 $('workflow').hidden=t==='sources';$('sources').hidden=t!=='sources';
 const kinds=t==='audit'?types.slice(0,4):types.slice(4);
 $('kind').innerHTML=options(kinds);$('filterType').innerHTML=options(kinds,'全部類型');$('search').value='';$('status').value='';$('month').value='';render();
}
function render(){
 if(tab==='sources'){
 const groups=new Map();
 for(const r of rows){if(!groups.has(r.batch))groups.set(r.batch,[]);groups.get(r.batch).push(r);}
 $('refs').innerHTML='<p>來源試算表由管理者在授權環境設定，公開儲存庫不保存私人來源網址。</p>'+refs.map(([title,key,desc])=>'<div class="ref"><a target="_blank" rel="noreferrer" href="https://docs.google.com/spreadsheets/d/'+key+'/edit">'+esc(title)+'</a>　'+esc(desc)+'</div>').join('')+'<p>家電訪規則採用兩份內容相同的研發草案。V48 為介面與流程參考。<a href="rules.json" target="_blank">檢視測試規則</a></p>';
 $('batches').innerHTML=[...groups.values()].reverse().map(g=>'<div class="item">'+esc(taipei(g[0].at))+'｜'+g.length+' 筆｜'+esc([...new Set(g.map(r=>r.source))].join('、'))+'｜'+esc([...new Set(g.map(r=>r.version||'資料缺口：來源版本'))].join('、'))+'</div>').join('')||'尚無匯入批次。';
 const history=rows.flatMap(r=>r.history.map(h=>({...h,r}))).sort((a,b)=>b.at.localeCompare(a.at));
 $('logs').innerHTML=history.map(h=>'<details class="item"><summary>'+esc(taipei(h.at))+'｜'+esc(h.actor)+'｜'+esc(h.approved?'人工確認':'修正')+'｜'+esc(h.r.source)+' #'+esc(h.r.line)+'｜第 '+h.rev+' 版</summary><p>'+esc(h.reason)+'</p><pre>'+esc(JSON.stringify({修正前:h.before,修正後:h.after,來源版本:h.version},null,2))+'</pre></details>').join('')||'尚無修正紀錄。';
 return;
 }
 const relevant=rows.filter(r=>isAudit(r.type)===(tab==='audit'));
 const months=[...new Set(relevant.map(r=>date(effective(r).date).slice(0,7)||'日期缺口'))].sort().reverse();
 const oldMonth=$('month').value;
 $('month').innerHTML=options(months,'所有月份');if(months.includes(oldMonth))$('month').value=oldMonth;
 const groups=tab==='audit'?audit(relevant):relevant.map(r=>({rows:[{r,d:effective(r)}],issues:visitProblems(r),diff:''}));
 for(const g of groups)g.approved=g.rows.every(p=>p.r.review?.approved);
 const flags=new Map();groups.forEach(g=>g.issues.forEach(k=>flags.set(k,(flags.get(k)||0)+1)));
 const q=clean($('search').value).toLowerCase(),month=$('month').value,st=$('status').value,kind=$('filterType').value;
 display=groups.filter(g=>{
 const m=date(g.rows[0].d.date).slice(0,7)||'日期缺口';
 return (!month||m===month)&&(!kind||g.rows.some(p=>p.r.type===kind))&&(!q||g.rows.some(p=>[p.d.name,p.d.worker,p.d.supervisor,p.d.code,p.r.source].some(x=>clean(x).toLowerCase().includes(q))))&&(!st||(st==='approved'?g.approved:st==='open'?g.issues.length&&!g.approved:!g.issues.length));
 }).sort((a,b)=>date(b.rows[0].d.date).localeCompare(date(a.rows[0].d.date))||a.rows[0].r.line-b.rows[0].r.line);
 $('stats').innerHTML=[[relevant.length,'原始紀錄列'],[groups.length,tab==='audit'?'檢核組數':'清冊筆數'],[groups.filter(g=>g.issues.length&&!g.approved).length,'需人工覆核'],[groups.filter(g=>g.approved).length,'已人工確認']].map(([n,s])=>'<div class="stat"><b>'+n+'</b><span>'+s+'</span></div>').join('');
 $('resultTitle').textContent=tab==='audit'?'逐筆服務稽核':'督導清冊與個案服務進展';
 $('shown').textContent='符合 '+display.length+' 組／'+display.reduce((n,g)=>n+g.rows.length,0)+' 筆來源列';
 $('counts').innerHTML=[...flags].map(([k,n])=>'<span class="pill warn">'+esc(k)+' '+n+'</span>').join('');
 page=Math.min(page,Math.max(0,Math.ceil(display.length/PAGE)-1));
 $('list').innerHTML=display.slice(page*PAGE,(page+1)*PAGE).map(card).join('')||'<p class="empty">此篩選範圍沒有資料。可先匯入原始檔或載入虛構測試資料。</p>';
 if(display.length>PAGE)$('list').insertAdjacentHTML('beforeend','<div class="actions"><button data-page="-1" '+(page===0?'disabled':'')+'>上一頁</button><span>第 '+(page+1)+'／'+Math.ceil(display.length/PAGE)+' 頁</span><button data-page="1" '+((page+1)*PAGE>=display.length?'disabled':'')+'>下一頁</button></div>');
}
function visitSummary(d){return [['個案狀況',d.detail],['服務變化',d.change],['處置',d.action],['後續安排',d.next]].filter(([,v])=>v).map(([k,v])=>k+'：'+v).join('。');}
function card(g){
 const d=g.rows[0].d;
 return '<article class="item"><div class="row"><h3>'+esc(d.name||'未辨識個案')+'　<small>'+esc(localDate(d.date))+'</small></h3><span class="pill '+(g.issues.length&&!g.approved?'warn':'')+'">'+(g.approved?'已人工確認':g.issues.length?'需人工覆核':tab==='audit'?'比對相符':'欄位齊全')+'</span></div>'+
 (g.issues.length?'<p class="alert">'+esc(g.issues.join('｜'))+'</p>':'')+(g.diff?'<p>'+esc(g.diff)+'</p>':'')+(tab==='visit'&&visitSummary(d)?'<p>'+esc(visitSummary(d))+'</p>':'')+
 g.rows.map(({r,d})=>'<div class="source-row"><div><b>'+esc(r.type)+'</b>　'+esc([d.worker,d.supervisor,d.code,[d.start,d.end].filter(Boolean).join('–')].filter(Boolean).join('｜'))+'<br><small>'+esc(r.source)+' · 第 '+esc(r.line)+' 列'+(r.review?.approved?' · 已覆核':'')+'</small></div><button data-id="'+esc(r.id)+'">檢核原件</button></div>').join('')+'</article>';
}
function bytesText(bytes){try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return new TextDecoder('big5',{fatal:true}).decode(bytes);}}
function batchRows(table,type,source,version){
 return mapped(table,type).map(({line,cells,data,problem})=>({line,raw:JSON.stringify(cells),data,problem,source,version,type:!isAudit(type)&&types.slice(4).includes(data.type)?data.type:type,ocr:type===types[3]}));
}
async function photoRow(file,type,version){
 let raw='',problem='待人工確認：請開啟原圖辨識手寫欄位';
 if('TextDetector' in globalThis){
 try{const bitmap=await createImageBitmap(file);try{raw=(await new TextDetector().detect(bitmap)).map(x=>x.rawValue).join('\n');}finally{bitmap.close();}}catch{}
 }
 return {line:1,type,source:file.name,version,photo:file,raw,data:{},problem};
}
$('import').onsubmit=async e=>{
 e.preventDefault();e.submitter.disabled=true;
 try{
 const type=$('kind').value,version=clean($('version').value),paste=$('paste').value,list=[];
 for(const f of $('files').files){
 if(f.size>30e6)throw Error(f.name+' 超過單檔 30 MB');
 if(f.type.startsWith('image/')){
 if(isAudit(type)&&type!==types[3])throw Error('服務照片請選「服務照片／OCR」來源');
 list.push(await photoRow(f,type,version));
 }else if(/\.xlsx$/i.test(f.name)){
 for(const sheet of await workbook(f))list.push(...batchRows(sheet.rows,type,f.name+'／'+sheet.name,version));
 }else if(/\.(csv|tsv|txt)$/i.test(f.name)){
 const raw=bytesText(await f.arrayBuffer());
 if(/\.txt$/i.test(f.name)&&!raw.includes('\t')&&!/^(服務日期|日期|訪視日期),/.test(raw))list.push({line:1,type,source:f.name,version,raw,data:{},ocr:type===types[3],problem:'原始文字請逐欄登錄'});
 else list.push(...batchRows(parse(raw),type,f.name,version));
 }else throw Error('不支援的檔案：'+f.name);
 }
 if(clean(paste)){
 const source=clean($('source').value)||'貼上文字';
 const table=parse(paste);
 if(table.some(r=>r.cells.length>1))list.push(...batchRows(table,type,source,version));
 else list.push({line:1,type,source,version,raw:paste,data:{},ocr:type===types[3],problem:'原始文字請逐欄登錄'});
 }
 await insert(list);$('import').reset();
 }catch(err){$('message').textContent='匯入未完成：'+err.message;}finally{e.submitter.disabled=false;}
};
const labels={date:'日期',name:'個案姓名',worker:'居服員',code:'BA碼／服務項目',start:'開始時間',end:'結束時間',minutes:'服務分鐘',supervisor:'督導',interviewee:'訪視對象／身分',information:'資訊來源',detail:'個案狀況或原件內容',change:'服務變化',action:'已做處置',next:'後續安排（寫明誰、何時、做什麼）',version:'來源版本',actor:'覆核人姓名',reason:'修正／確認依據'};
const auditKeys=['date','name','worker','code','start','end','minutes'];
const visitKeys=['date','name','supervisor','worker','code','interviewee','information','detail','change','action','next'];
const formKeys=r=>[...(isAudit(r.type)?auditKeys:visitKeys),'version','actor','reason'];
function openEditor(r,fresh=false){
 current={r,fresh};
 if(photoURL){URL.revokeObjectURL(photoURL);photoURL=null;}
 const d={...effective(r),version:r.version,actor:r.review?.actor};
 const existingTags=d.tags||[];
 $('editTitle').textContent=(fresh?'新增單筆｜':'人工檢核｜')+r.type;
 $('editMessage').textContent='';
 $('evidence').innerHTML='<p><b>原件</b>　'+esc(r.source)+' · 第 '+esc(r.line)+' 列</p>'+(r.raw?'<pre>'+esc(r.raw)+'</pre>':'')+(r.photo?'<p>請以原圖核對辨識結果與欄位。</p>':'');
 if(r.photo){
 photoURL=URL.createObjectURL(r.photo);
 const img=document.createElement('img');img.src=photoURL;img.alt='匯入照片原件';
 const a=document.createElement('a');a.href=photoURL;a.target='_blank';a.rel='noreferrer';a.textContent='開啟原圖';a.append(img);$('evidence').append(a);
 }
 $('editFields').innerHTML=formKeys(r).map(k=>{
 const multiline=['detail','change','action','next','reason'].includes(k);
 return '<label>'+esc(labels[k])+(multiline?'<textarea rows="2" name="'+k+'">'+esc(d[k])+'</textarea>':'<input name="'+k+'" value="'+esc(d[k])+'" '+(k==='date'?'placeholder="115/11/08 或 2026-11-08"':k==='start'||k==='end'?'placeholder="08:30"':'')+'>')+'</label>';
 }).join('');
 $('moduleBox').hidden=isAudit(r.type);
 $('modules').innerHTML=Object.entries(rules.modules).map(([group,tags])=>'<details><summary>'+esc(group)+'</summary>'+tags.map(tag=>'<label><input name="tag" type="checkbox" value="'+esc(group+'='+tag)+'" '+(existingTags.includes(group+'='+tag)?'checked':'')+'>'+esc(tag)+'</label>').join('')+'</details>').join('');
 updateHints();
 $('editor').showModal();
}
function updateHints(){
 const picked=new FormData($('edit')).getAll('tag');
 const hints=rules.triggers.filter(t=>picked.includes(t.when)).map(t=>t.when.split('=')[1]+'需記錄 '+(t.required||t.show||[]).join('、')+(t.fallback?'。'+t.fallback:''));
 if(picked.filter(v=>v.startsWith('服務進展=')).length>1)hints.push('服務進展勾選多項，請核對敘述與比較依據。');
 $('hints').textContent=hints.join('。')||'依本次實際情況勾選。進退需有可比較的紀錄。';
}
$('modules').onchange=updateHints;
$('edit').onsubmit=async e=>{
 e.preventDefault();e.submitter.disabled=true;
 try{
 const {r,fresh}=current,fd=new FormData(e.target),actor=clean(fd.get('actor')),reason=clean(fd.get('reason')),approved=e.submitter.value==='approve';
 if(!actor||!reason)throw Error('請填寫覆核人及修正／確認依據');
 const fix=Object.fromEntries(formKeys(r).filter(k=>!['version','actor','reason'].includes(k)).map(k=>[k,clean(fd.get(k))]));
 const version=clean(fd.get('version'));
 if(!isAudit(r.type))fix.tags=fd.getAll('tag');
 if(approved&&(!version||!date(fix.date)||!fix.name))throw Error('確認前請補齊來源版本、有效日期與個案姓名');
 if(approved&&isAudit(r.type)&&(!fix.worker||!fix.start||!fix.end||r.type!==types[2]&&!fix.code))throw Error('確認前請補齊居服員、起訖時間與適用 BA 碼');
 if(approved&&!isAudit(r.type)&&visitProblems({...r,version,fix,review:{approved:true}}).length)throw Error('確認前請補齊督導姓名與原件記錄內容');
 const review={approved,actor,reason,at:now()};
 const value={...r,fix,version,review,history:[...r.history,{...review,version,rev:r.history.length+1,before:{...effective(r),來源版本:r.version},after:fix}]};
 if(fresh)await transaction('readwrite',s=>s.add(value));
 else await new Promise((resolve,reject)=>{
 const t=db.transaction('rows','readwrite'),s=t.objectStore('rows'),get=s.get(r.id);
 let conflict=false;
 get.onsuccess=()=>{if(get.result?.history.length!==r.history.length){conflict=true;t.abort();}else s.put(value);};
 t.oncomplete=resolve;t.onabort=t.onerror=()=>reject(Error(conflict?'這筆資料已在其他分頁修改，請關閉後重新開啟':'儲存未完成'));
 });
 $('editor').close();await reload();$('message').textContent=approved?'已記錄人工確認與依據。':'已儲存修正及前後版本。';
 }catch(err){$('editMessage').textContent=err.message;}finally{e.submitter.disabled=false;}
};
$('manual').onclick=()=>openEditor({id:id(),batch:id(),line:1,at:now(),history:[],type:$('kind').value,source:clean($('source').value)||'手動登錄',version:clean($('version').value),raw:$('paste').value,data:{}},true);
$('close').onclick=()=>$('editor').close();
$('editor').onclose=()=>{if(photoURL)URL.revokeObjectURL(photoURL);photoURL=null;};
$('list').onclick=e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.page){page+=+b.dataset.page;render();return;}
 const r=rows.find(r=>r.id===b.dataset.id);if(r)openEditor(r);
};
const safe=v=>{const x=String(v??'').replace(/[\r\n\t]+/g,' ');return /^\s*[=+\-@]/.test(x)?"'"+x:x;};
const headers=['紀錄識別碼','日期','個案姓名','居服員','督導','來源類型','BA碼／服務項目','開始時間','結束時間','服務分鐘','來源檔名','來源列','來源版本','差異值','判定原因','原始內容','人工修正','確認狀態','覆核人','確認依據','覆核時間','個案狀況','服務變化','已做處置','後續安排','個案服務摘要'];
function exportText(){
 const table=display.flatMap(g=>g.rows.map(({r,d})=>[r.id,localDate(d.date),d.name,d.worker,d.supervisor,r.type,d.code,d.start,d.end,d.minutes,r.source,r.line,r.version,g.diff,g.issues.join('｜'),r.raw,r.fix?JSON.stringify(r.fix):'',r.review?.approved?'已人工確認':'尚未人工確認',r.review?.actor,r.review?.reason,r.review?.at?taipei(r.review.at):'',d.detail,d.change,d.action,d.next,visitSummary(d)]));
 return [headers,...table].map(row=>row.map(safe).join('\t')).join('\r\n');
}
function download(content,name){
 const url=URL.createObjectURL(new Blob(['\uFEFF',content],{type:'text/tab-separated-values;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('template').onclick=()=>{
 const keys=isAudit($('kind').value)?auditKeys:visitKeys;
 download(keys.map(k=>fields[k]?.[0]||labels[k]).join('\t')+'\r\n','永護寧_匯入欄位.tsv');
};
$('export').onclick=()=>download(exportText(),'永護寧_'+(tab==='audit'?'服務稽核':'督導清冊')+'.tsv');
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(exportText());$('message').textContent='已複製 '+display.reduce((n,g)=>n+g.rows.length,0)+' 筆來源列，可貼至工作表。';}catch{$('message').textContent='瀏覽器未授權剪貼簿，請使用下載 TSV。';}};
$('sample').onclick=async e=>{
 e.target.disabled=true;
 try{
 if(rows.some(r=>r.sample)){$('message').textContent='已載入虛構測試資料，可搜尋「測試案」。';return;}
 const item=(type,line,data)=>({type,line,data,source:'【虛構】'+type,version:'測試 1.0',raw:JSON.stringify(data),sample:true});
 const base={date:'115/11/08',name:'測試案甲',worker:'測試居服員',code:'BA01',start:'12:30',end:'13:00'};
 await insert([
 item(types[0],2,base),item(types[1],2,{...base,code:'BA02',start:'12:31',end:'13:01'}),item(types[2],2,{...base,code:'',start:'12:30',end:'13:00'}),
 item(types[0],3,{...base,name:'測試案乙',code:'BA01、BA20',start:'08:00',end:'09:00'}),
 item(types[1],3,{...base,name:'測試案乙',start:'08:00',end:'08:30'}),
 item(types[1],4,{...base,name:'測試案乙',code:'BA20',start:'08:30',end:'09:00'}),
 item(types[2],3,{...base,name:'測試案乙',code:'',start:'08:00',end:'09:00'}),
 item(types[5],2,{date:'115/11/06',name:'測試案甲',supervisor:'測試督導',change:'11/9 下午進班改為 16:30',action:'已電話告知案女與居服員。',next:'督導於 11/9 核對首次調整後的進班時間。'}),
 item(types[7],3,{date:'115/11/09',name:'測試案甲',supervisor:'測試督導',detail:'案女表示當日服務於 16:30 開始。',action:'督導已核對當日打卡。'})
 ]);
 }catch(err){$('message').textContent='無法載入測試資料：'+err.message;}finally{e.target.disabled=false;}
};
for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>setTab(b.dataset.tab);
for(const k of ['search','month','status','filterType'])$(k).oninput=()=>{page=0;render();};
try{
 db=await openDB();setTab('audit');await reload();
 try{rules=await (await fetch('./rules.json')).json();}catch{$('message').textContent='模組規則載入失敗，請重新整理。';}
}catch(err){$('message').textContent='本機儲存無法開啟：'+err.message;}
