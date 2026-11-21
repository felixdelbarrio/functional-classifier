function fcQueueTranslations_(items,revision){
 const sh=fcSheet_('FC_TRANSLATIONS',['id','language','sourceHash','source','translation','status','updatedAt']);
 const existing=sh.getDataRange().getValues().slice(1),keys=new Set(existing.map(r=>r[0]+'|'+r[1]+'|'+r[2]));const pending=[];
 for(const item of items)for(const lang of ['en','tr']){const source=item.functionName,hash=fcHash_(source);if(!keys.has(item.id+'|'+lang+'|'+hash))pending.push([item.id,lang,hash,source,'','PENDING',new Date().toISOString()]);}
 if(pending.length)sh.getRange(sh.getLastRow()+1,1,pending.length,7).setValues(pending);
 return pending.length;
}
function updatePendingTranslations(limit){const sh=fcSheet_('FC_TRANSLATIONS',['id','language','sourceHash','source','translation','status','updatedAt']);const rows=sh.getDataRange().getValues(),max=Math.min(Math.max(Number(limit)||50,1),100);let done=0,failed=0;
 for(let i=1;i<rows.length&&done+failed<max;i++)if(rows[i][5]==='PENDING'){
  try{const translation=LanguageApp.translate(String(rows[i][3]),'es',String(rows[i][1]));if(!translation)throw Error('Traducción vacía');sh.getRange(i+1,5,1,3).setValues([[translation,'OK',new Date().toISOString()]]);done++;}
  catch(e){sh.getRange(i+1,6,1,2).setValues([['ERROR',new Date().toISOString()]]);failed++;console.error('FC_TRANSLATION '+rows[i][0]+' '+e.message);}
 }
 return {done,failed,pending:Math.max(0,rows.slice(1).filter(r=>r[5]==='PENDING').length-done)};
}
function fcTranslations_(revision){const sh=fcSheet_('FC_TRANSLATIONS',['id','language','sourceHash','source','translation','status','updatedAt']),rows=sh.getDataRange().getValues(),out={};
 const snapshot=fcReadSnapshotForTranslation_(revision);const valid=new Map(snapshot.items.map(item=>[item.id,fcHash_(item.functionName)]));
 for(const row of rows.slice(1))if(row[5]==='OK'&&valid.get(String(row[0]))===String(row[2])){const id=String(row[0]),lang=String(row[1]);if(!out[id])out[id]={};out[id][lang]=[String(row[4])];}return out;
}

function fcReadSnapshotForTranslation_(revision){
 const payload=fcCatalogPayload_(fcSheet_('FC_CATALOG',['revision','payload','createdAt']),revision);
 if(fcHash_(payload)!==revision)throw Error('Snapshot inválido');
 return {items:JSON.parse(payload)};
}

/** Completeness is checked on the exact catalog revision used for the batch. */
function fcMissingTranslations_(snapshot,translations){
 const missing=[];
 for(const item of snapshot.items)for(const lang of ['en','tr']){
  if(!translations[item.id]||!Array.isArray(translations[item.id][lang])||!translations[item.id][lang].some(Boolean))missing.push(item.id+':'+lang);
 }
 return missing;
}
