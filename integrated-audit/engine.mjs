export const clean=v=>String(v??'').normalize('NFKC').trim();
export const types=['員工班表','中央服務紀錄','打卡紀錄','服務照片／OCR','照會單','異動通報','家訪','電訪','查班'];
export const isAudit=t=>types.slice(0,4).includes(t);
export const fields={interviewee:['訪視對象／身分','訪視對象','受訪身分'],information:['資訊來源','紀錄來源'],date:['服務日期','日期','訪視日期','電訪日期','通報日期','照會日期','服務日','照會日','異動日期','家電訪日期','家訪日期','查班日期','實際訪視日期'],name:['個案姓名','個案','案主','服務對象','姓名','案主姓名'],worker:['居服員','服務人員','員工','員工姓名','照服員','照顧服務員','居服員姓名'],code:['BA碼','服務項目','項目','服務代碼','照顧組合','服務項目代碼'],start:['開始時間','開始','起始時間','上班時間','打卡上班','服務起始時間','服務開始時間'],end:['結束時間','結束','下班時間','打卡下班','服務結束時間'],range:['服務時間','服務時段','時段'],minutes:['服務分鐘','分鐘','服務時數(分鐘)'],hours:['服務時數','時數','小時'],supervisor:['督導','主責督導','訪視人員','居督','督導姓名'],type:['類型','訪視方式','紀錄類型','家電訪類型','訪視類型','家電訪','訪視種類'],detail:['個案狀況','紀錄內容','內容','摘要','追蹤內容','備註'],change:['服務變化','異動內容','變更內容'],action:['處置','處遇','處理情形'],next:['後續安排','後續','追蹤事項']};
export function date(v){
 const s=clean(v);
 if(/^\d{5}(\.0+)?$/.test(s)&&+s>=20000&&+s<80000)return new Date(Date.UTC(1899,11,30)+Number(s)*864e5).toISOString().slice(0,10);
 const m=s.match(/^(?:民國)?(\d{2,4})[-/.年]?(\d{2})[-/.月]?(\d{2})日?$/)||s.match(/^(?:民國)?(\d{2,4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/);
 if(!m)return '';const y=+m[1]+(+m[1]<1911?1911:0), mo=+m[2],d=+m[3];
 if(y<1912||y>2200||mo<1||mo>12||d<1||d>new Date(Date.UTC(y,mo,0)).getUTCDate())return '';
 return [y,mo,d].map(n=>String(n).padStart(2,'0')).join('-');
}
export function time(v){
 const s=clean(v);const m=s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
 if(m&&(+m[1]<24||+m[1]===24&&+m[2]===0&&!(+m[3]))&&+m[2]<60&&(!m[3]||+m[3]<60))return +m[1]*3600 + +m[2]*60 + +(m[3]||0);
 if(/^(?:0(?:\.\d+)?|\.\d+)$/.test(s))return Math.round(+s*86400);
 return null;
}
export const codes=v=>[...clean(v).toUpperCase().matchAll(/\bBA\d{2}(?:-\d+)?\b/g)].map(x=>x[0]).sort();
export function parse(text){
 const first=text.split(/\r?\n/).find(l=>l.trim())||'';
 const sep=first.includes('\t')?'\t':',';
 let rows=[], cells=[],value='',quoted=false,start=1,line=1;
 text=text.replace(/^\uFEFF/,'');
 function finish(){cells.push(value);rows.push({line:start,cells});cells=[];value='';start=line+1;}
 for(let i=0;i<text.length;i++){const c=text[i];
 if(c==='"'&&(quoted||!value)){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
 else if(c===sep&&!quoted){cells.push(value);value='';}
 else if(c==='\n'){if(quoted)value+='\n';else finish();line++;}
 else if(c!=='\r'||quoted)value+=c;
 }
 if(quoted)throw Error('引號沒有關閉，請修正原檔後重新匯入');
 if(value||cells.length)finish();return rows;
}
const header=v=>clean(v).replace(/\s+/g,'');
export function mapping(cells){return Object.fromEntries(Object.entries(fields).map(([k,names])=>[k,cells.findIndex(v=>names.some(n=>header(v)===header(n)))]));}
export function mapped(rows,type){
 const h=rows.findIndex((r,i)=>{if(i>=30)return false;const m=mapping(r.cells);return m.date>=0&&m.name>=0;});
 if(h<0)return rows.filter(r=>r.cells.some(v=>clean(v))).map(r=>({...r,data:{},problem:'未識別表頭，請依原始列人工補登'}));
 const m=mapping(rows[h].cells);
 return rows.flatMap((r,i)=>{
 if(i===h||!r.cells.some(v=>clean(v)))return [];
 if(i<h)return [{...r,data:{},problem:'表頭前文字，請核對是否含有資料'}];
 const data=Object.fromEntries(Object.entries(m).map(([k,col])=>[k,clean(r.cells[col])]));
 if(data.range){let [a,b]=data.range.split(/\s*[~～至–—-]\s*/);data.start||=a;data.end||=b;}
 if(!data.minutes&&data.hours&&/^\d+(\.\d+)?$/.test(data.hours))data.minutes=String(+data.hours*60);
 if(!isAudit(type)&&data.type&&!types.slice(4).includes(data.type))return [{...r,data,problem:'原表類型需人工對照'}];
 return [{...r,data}];
 });
}
const effective=r=>({...r.data,...r.fix});
export function audit(records){
 const parts=records.filter(r=>isAudit(r.type)).map(r=>{
 const d=effective(r), s=time(d.start),e=time(d.end),t=date(d.date),c=codes(d.code),n=d.minutes&&/^\d+(\.\d+)?$/.test(d.minutes)?+d.minutes:null;
 const issues=[];
 if(!r.version)issues.push('資料缺口：未填來源版本');
 if(r.problem&&!r.fix)issues.push(r.problem);
 if((r.photo||r.ocr)&&!r.review?.approved)issues.push('待人工確認：請對照原照片辨識');
 for(const [valid,key] of [[t,'服務日期'],[d.name,'個案'],[d.worker,'居服員'],[s!==null&&e!==null&&e>s,'起訖時間']])if(!valid)issues.push('資料缺口：'+key);
 if(r.type!==types[2]&&!c.length)issues.push('資料缺口：BA 碼');
 if(d.minutes&&n===null)issues.push('資料缺口：時數格式');
 if(n!==null&&s!==null&&e!==null&&Math.abs(n*60-(e-s))>=60)issues.push('服務時數與本列起訖不符');
 return {r,d,s,e,t,c,n,issues,valid:t&&d.name&&d.worker&&s!==null&&e>s&&r.type!==types[3]};
 });
 const groups=new Map();
 for(const p of parts){const key=p.valid?JSON.stringify([p.t,p.d.name,p.d.worker]):p.r.id;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);}
 const out=[];
 const push=(rows,extra=[],diff='')=>out.push({rows,issues:[...new Set([...rows.flatMap(p=>p.issues),...extra])],diff});
 for(const g of groups.values()){
 const a=g.filter(p=>p.r.type===types[0]), b=g.filter(p=>p.r.type===types[1]), clock=g.filter(p=>p.r.type===types[2]);
 if(!g[0].valid){
 const p=g[0];
 if(p.r.type!==types[3]||!p.r.review?.approved||p.issues.length){push(g);continue;}
 const same=parts.filter(y=>y.valid&&y.t===p.t&&y.d.name===p.d.name&&y.d.worker===p.d.worker&&y.r.type===types[0]);
 const exact=same.filter(y=>y.s===p.s&&y.e===p.e);
 const candidates=exact.length?exact:same.filter(y=>y.s<p.e&&y.e>p.s);
 const x=candidates.length===1?candidates[0]:!candidates.length&&same.length===1?same[0]:null;
 if(!x){push(g,[same.length?'待人工確認：照片與多筆班表無法唯一配對':'資料缺口：照片未配到班表']);continue;}
 const ds=p.s-x.s,de=p.e-x.e,flags=[];
 if(Math.abs(ds)>=60||Math.abs(de)>=60)flags.push('照片與班表起訖時間不一致');
 if(Math.abs(de-ds)>=60)flags.push('照片與班表服務時數不一致');
 if(p.c.join()!==x.c.join())flags.push('照片與班表 BA 碼不一致');
 push(g,flags,'照片－班表（分）開始 '+ds/60+'／結束 '+de/60+'／時數 '+(de-ds)/60+'｜班表 '+x.r.source+' #'+x.r.line);
 continue;
 }
 const A=new Set(a),B=new Set(b),C=new Set(clock);
 const bundles=new Map();
 const ordered=b.slice().sort((x,y)=>x.s-y.s);
 for(const x of a){
 if(x.c.length<2||b.some(y=>y.s===x.s&&y.e===x.e))continue;
 for(let i=0;i<ordered.length;i++){
 if(ordered[i].s!==x.s)continue;
 const seq=[ordered[i]];
 for(let j=i+1;j<ordered.length&&ordered[j].s===seq.at(-1).e&&ordered[j].e<=x.e;j++)seq.push(ordered[j]);
 if(seq.length>1&&seq.at(-1).e===x.e&&seq.flatMap(y=>y.c).sort().join()===x.c.join()&&!ordered.some(y=>!seq.includes(y)&&y.s<x.e&&y.e>x.s))bundles.set(x,seq);
 }
 }
 function compare(x,ys,extra=[]){
 const z=ys[0],end=ys.at(-1)?.e;
 const ds=z?.s-x.s,de=end-x.e,dur=(end-z?.s)-(x.e-x.s);
 const flags=[...extra];
 if(Math.abs(ds)>=60||Math.abs(de)>=60)flags.push('班表與中央起訖時間不一致');
 if(Math.abs(dur)>=60)flags.push('班表與中央服務時數不一致');
 if(z&&x.c.join()!==ys.flatMap(p=>p.c).sort().join())flags.push('班表與中央 BA 碼不一致');
 const exact=clock.filter(p=>C.has(p)&&p.s===x.s&&p.e===x.e);
 const overlap=clock.filter(p=>C.has(p)&&p.s<x.e&&p.e>x.s);
 const candidates=exact.length?exact:overlap.length?overlap:a.length===1&&clock.length===1?[...C]:[];
 let pc=candidates.length===1?candidates[0]:null;
 if(pc&&a.some(q=>q!==x&&(exact.length?q.s===pc.s&&q.e===pc.e:q.s<pc.e&&q.e>pc.s)))pc=null;
 let diff=z?'中央－班表（分）開始 '+ds/60+'／結束 '+de/60+'／時數 '+dur/60:'';
 if(pc){C.delete(pc);const cs=pc.s-x.s,ce=pc.e-x.e;
 if(Math.abs(cs)>=60||Math.abs(ce)>=60)flags.push('打卡與班表時間不一致');
 if(pc.c.length&&pc.c.join()!==x.c.join())flags.push('打卡與班表 BA 碼不一致');
 if(Math.abs((pc.e-pc.s)-(x.e-x.s))>=60)flags.push('打卡與班表服務時數不一致');
 diff+=(diff?'；':'')+'打卡－班表（分）開始 '+cs/60+'／結束 '+ce/60+'／時數 '+(ce-cs)/60;
 if(z&&(Math.abs(pc.s-z.s)>=60||Math.abs(pc.e-end)>=60))flags.push('打卡與中央起訖時間不一致');
 }else flags.push(candidates.length?'待人工確認：多筆打卡或班表重疊':'資料缺口：未配到打卡');
 push([x,...ys,...(pc?[pc]:[])],flags,diff);A.delete(x);ys.forEach(p=>B.delete(p));
 }
 for(const [x,ys] of bundles)if(ys.every(y=>[...bundles.values()].filter(z=>z.includes(y)).length===1)&&[...A].filter(q=>q.s<ys.at(-1).e&&q.e>ys[0].s).length===1)compare(x,ys);
 for(const predicate of [(x,y)=>x.s===y.s&&x.e===y.e,(x,y)=>x.s<y.e&&x.e>y.s,()=>a.length===1&&b.length===1]){
 const pairs=[...A].flatMap(x=>{const ys=[...B].filter(y=>predicate(x,y));return ys.length===1&&[...A].filter(q=>predicate(q,ys[0])).length===1?[[x,ys[0]]]:[];});
 for(const [x,y] of pairs)compare(x,[y]);
 }
 const openA=A.size,openB=B.size;
 for(const x of A)compare(x,[],[openB?'待人工確認：與中央未能唯一配對':'班表有、中央無相符列']);
 for(const y of B)push([y],[openA?'待人工確認：與班表未能唯一配對':'中央有、班表無相符列']);
 for(const c of C)push([c],['待人工確認：打卡未配對']);
 }
 return out;
}
export {effective};
