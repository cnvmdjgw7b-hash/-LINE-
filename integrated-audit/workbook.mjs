export async function workbook(file){
 const raw=await file.arrayBuffer(),bytes=new Uint8Array(raw),view=new DataView(raw),dec=new TextDecoder();
 let e=bytes.length-22;
 for(;e>=Math.max(0,bytes.length-65557);e--)if(view.getUint32(e,true)===0x06054b50)break;
 if(e<0||view.getUint32(e,true)!==0x06054b50)throw Error('無法辨識 XLSX 檔');
 let offset=view.getUint32(e+16,true),parts={},expanded=0;
 for(let i=0;i<view.getUint16(e+10,true);i++){
 if(view.getUint32(offset,true)!==0x02014b50)throw Error('XLSX 索引損毀');
 const method=view.getUint16(offset+10,true),size=view.getUint32(offset+20,true),expected=view.getUint32(offset+24,true),length=view.getUint16(offset+28,true),loc=view.getUint32(offset+42,true);
 const name=dec.decode(bytes.subarray(offset+46,offset+46+length));
 offset+=46+length+view.getUint16(offset+30,true)+view.getUint16(offset+32,true);
 if(!/^xl\/(?:workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(name))continue;
 expanded+=expected;if(expanded>80e6)throw Error('工作簿解壓後超過 80 MB，請拆分工作表');
 if(![0,8].includes(method))throw Error('不支援此 XLSX 壓縮格式');
 const start=loc+30+view.getUint16(loc+26,true)+view.getUint16(loc+28,true);
 const chunk=bytes.subarray(start,start+size);
 const stream=new Blob([chunk]).stream();
 const value=method===0?chunk:await new Response(stream.pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
 const doc=new DOMParser().parseFromString(dec.decode(value),'application/xml');
 if(doc.querySelector('parsererror'))throw Error('XLSX 工作表內容損毀');
 parts[name]=doc;
 }
 const nodes=(p,n)=>Array.from(p?.getElementsByTagNameNS('*',n)??[]);
 const str=e=>nodes(e,'t').map(x=>x.textContent).join('');
 const shared=nodes(parts['xl/sharedStrings.xml'],'si').map(str);
 const relationships=new Map(nodes(parts['xl/_rels/workbook.xml.rels'],'Relationship').map(r=>[r.getAttribute('Id'),r.getAttribute('Target')]));
 const tabs=nodes(parts['xl/workbook.xml'],'sheet').map(s=>{
 const id=s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')||s.getAttribute('r:id');
 const target=relationships.get(id)||'';
 const path=target.startsWith('/')?target.slice(1):'xl/'+target;
 return {name:s.getAttribute('name'),doc:parts[path]};
 });
 if(!tabs.length)throw Error('找不到 XLSX 工作表');
 return tabs.map(({name,doc})=>{
 if(!doc)throw Error('無法讀取工作表 '+name);
 return {name,rows:nodes(doc,'row').map((r,i)=>{
 const cells=[];
 for(const c of nodes(r,'c')){
 const ref=c.getAttribute('r')||'', letters=ref.match(/^[A-Z]+/)?.[0]||'';
 const col=[...letters].reduce((n,v)=>n*26+v.charCodeAt(0)-64,0)-1;
 if(col<0||col>16383)continue;
 const type=c.getAttribute('t'),v=nodes(c,'v')[0]?.textContent??'';
 cells[col]=type==='s'?shared[+v]??'':type==='inlineStr'?str(c):v;
 }
 return {line:+r.getAttribute('r')||i+1,cells};
 })};
 });
}
