const FC_DEFAULT_CATALOG_SHEET = 'CatalogoFuncional';
function fcCatalogSheetName_(){
 return (PropertiesService.getScriptProperties().getProperty('FC_CATALOG_SHEET') || FC_DEFAULT_CATALOG_SHEET).trim();
}
function fcCatalogSheetNames_(){
 const name=fcCatalogSheetName_();
 // The official master separates customer functionality from Core and Digital Sales.
 return name==='Soluciones Funcionales'?[name,'Capacidades canal (core y VD)']:[name];
}
function fcCatalogRows_(book,name=fcCatalogSheetName_()){
 const sh=book.getSheetByName(name);
 if(!sh)throw Error('Pestaña del catálogo ausente: '+name);
 const rows=sh.getDataRange().getDisplayValues();
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
 const aliases={id:['id'],bloque:['bloque funcional','bloque'],nombre:['funcionalidad/sub operativa','nombre'],descripcion:['descripcion']};
 let header=-1,index=null;
 for(let i=0;i<Math.min(rows.length,30);i++){
  const cells=rows[i].map(normalize),found={};
  for(const key of Object.keys(aliases))found[key]=cells.findIndex(x=>aliases[key].includes(x));
  if(Object.values(found).every(v=>v>=0)){header=i;index=found;break;}
 }
 if(header<0)throw Error('Cabeceras del catálogo no reconocidas en '+name);
 return {rows:rows.slice(header+1),index,name};
}
function fcHash_(text){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,text).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');}
function fcBook_(){const id=PropertiesService.getScriptProperties().getProperty('FC_CATALOG_ID');if(!id)throw Error('Configurar FC_CATALOG_ID');return SpreadsheetApp.openById(id);}
function fcStore_(){const id=PropertiesService.getScriptProperties().getProperty('FC_STORE_ID');if(!id)throw Error('Configurar FC_STORE_ID (Google Sheets de control independiente)');return SpreadsheetApp.openById(id);}
function fcSheet_(name,headers){const ss=fcStore_();let sh=ss.getSheetByName(name);if(!sh){sh=ss.insertSheet(name);sh.appendRow(headers);sh.setFrozenRows(1);}return sh;}
function syncCatalog(){
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  const book=fcBook_(),items=new Map();
  for(const name of fcCatalogSheetNames_()){
   const source=fcCatalogRows_(book,name);
   for(const row of source.rows){
   const get=key=>String(row[source.index[key]]||'').trim();
   const id=get('id');
   if(!id)continue;
   if(!/^\d{2}(?:\.\d{2}){1,2}$|^\d{2}\.XX$/.test(id))throw Error('ID inválido en catálogo: '+id);
   const block=get('bloque'),name=get('nombre');
   if(!block||!name)throw Error('Fila incompleta: '+id);
   const prefix=id.slice(0,2);
   const item={id,blockName:block,functionName:name,description:get('descripcion')};
   if(items.has(id))throw Error('ID duplicado: '+id);
   items.set(id,item);
   }
  }
  const data=[...items.values()].sort((a,b)=>a.id.localeCompare(b.id));if(!data.some(x=>x.id.startsWith('08.')))throw Error('Catálogo sin bloque 08');
  if(!data.length)throw Error('Catálogo vacío');
  if(fcCatalogSheetName_()==='Soluciones Funcionales'&&['19.','20.'].some(prefix=>!data.some(item=>item.id.startsWith(prefix)&&/^\d{2}\.\d{2}$/.test(item.id))))throw Error('Catálogo oficial incompleto: faltan Core o Venta Digital');
  // Los IDs .XX oficiales se preservan; el fallback .xx se calcula por separado.
  const payload=JSON.stringify(data);
  const revision=fcHash_(payload);
  const sh=fcSheet_('FC_CATALOG',['revision','payload','createdAt']);
  const props=PropertiesService.getScriptProperties();if(props.getProperty('FC_ACTIVE_REV')===revision)return {changed:false,revision,items:data.length};
  // Append before switching active revision. Existing jobs retain their snapshot.
  fcWriteCatalogChunks_(sh,revision,payload);fcQueueTranslations_(data,revision);props.setProperty('FC_ACTIVE_REV',revision);return {changed:true,revision,items:data.length};
 }finally{lock.releaseLock();}
}
function fcWriteCatalogChunks_(sh,revision,payload){
 const chunks=payload.match(/[\s\S]{1,40000}/g)||[];
 if(!chunks.length)throw Error('Snapshot vacío');
 const rows=chunks.map((chunk,index)=>[revision,JSON.stringify({part:index,total:chunks.length,data:chunk}),new Date().toISOString()]);
 sh.getRange(sh.getLastRow()+1,1,rows.length,3).setValues(rows);
 const check=fcCatalogPayload_(sh,revision);
 if(fcHash_(check)!==revision)throw Error('Escritura incompleta del catálogo');
}
function fcCatalogPayload_(sh,revision){
 const rows=sh.getDataRange().getValues().slice(1).filter(r=>String(r[0])===revision);
 if(!rows.length)throw Error('Revisión no encontrada');
 const parts=[];
 for(const row of rows){const raw=String(row[1]);let item;
  try{item=JSON.parse(raw);}catch(e){item=null;}
  if(item&&Number.isInteger(item.part)&&Number.isInteger(item.total)&&typeof item.data==='string')parts.push(item);
  else if(Array.isArray(item))return raw; // lectura de snapshots anteriores
 }
 if(!parts.length||parts.length!==parts[0].total)throw Error('Snapshot incompleto');
 parts.sort((a,b)=>a.part-b.part);
 if(parts.some((p,i)=>p.part!==i||p.total!==parts.length))throw Error('Snapshot inconsistente');
 return parts.map(p=>p.data).join('');
}
function fcReadSnapshot_(){
 const rev=PropertiesService.getScriptProperties().getProperty('FC_ACTIVE_REV');
 if(!rev)throw Error('Ejecutar syncCatalog primero');
 const payload=fcCatalogPayload_(fcSheet_('FC_CATALOG',['revision','payload','createdAt']),rev);
 if(fcHash_(payload)!==rev)throw Error('Snapshot corrupto');
 return {revision:rev,items:JSON.parse(payload)};
}
function installCatalogWatcher(){const handler='fcScheduledMaintenance';ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===handler).forEach(t=>ScriptApp.deleteTrigger(t));ScriptApp.newTrigger(handler).timeBased().everyHours(1).create();return fcScheduledMaintenance();}
function fcScheduledMaintenance(){const sync=syncCatalog();const translation=updatePendingTranslations(80);return {sync,translation};}
