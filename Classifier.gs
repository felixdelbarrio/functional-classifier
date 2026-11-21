/** Functional Classifier: ES/EN/TR, multi-label, deterministic. */
const FC_VERSION = '5.8.6-evidence-batch';
function fcNorm_(value) { return String(value ?? '').replace(/İ/g,'i').replace(/I/g,'i').toLowerCase().replace(/ı/g,'i').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' '); }
function fcHas_(text,phrase) { const p=fcNorm_(phrase); return p.length>=3 && (' '+text+' ').includes(' '+p+' '); }
function fcRules_() {
  const sh=fcSheet_('FC_RULES',['id','terms','context','exclude']);
  const out={};
  for(const row of sh.getDataRange().getDisplayValues().slice(1)) {
    const id=String(row[0]).trim();if(!id)continue;
    if(!/^\d{2}(?:\.\d{2})?$/.test(id)||out[id])throw Error('ID de regla inválido o duplicado: '+id);
    const rule={};
    for(let i=1;i<=3;i++){
      const val=row[i]?JSON.parse(String(row[i])):[];
      if(!Array.isArray(val)||val.some(x=>typeof x!=='string'))throw Error('Regla inválida: '+id);
      rule[['terms','context','exclude'][i-1]]=val;
    }
    out[id]=rule;
  }
  if(!Object.keys(out).length)throw Error('FC_RULES vacío: importar reglas verificadas');
  return out;
}
function fcCompile_(snapshot, rules, translations) {
  const byId=new Map();
  for(const item of snapshot.items) {
    const rule=rules[item.id]||{}, t=translations[item.id]||{};
    const terms=[item.functionName,...(rule.terms||[]),...(t.en||[]),...(t.tr||[])].map(fcNorm_).filter(x=>x.length>=4);
    byId.set(item.id,{...item,terms:[...new Set(terms)],context:(rule.context||[]).map(fcNorm_),exclude:(rule.exclude||[]).map(fcNorm_)});
  }
  const blocks=new Map();for(const row of byId.values())if(!blocks.has(row.id.slice(0,2)))blocks.set(row.id.slice(0,2),{id:row.id.slice(0,2),name:row.blockName,terms:[]});
  for(const [id,block] of blocks){const r=rules[id]||{};block.terms=[block.name.replace(/^\d{2}\./,''),...(r.terms||[]),...((translations[id]||{}).en||[]),...((translations[id]||{}).tr||[])].map(fcNorm_).filter(x=>x.length>=4);block.exclude=(r.exclude||[]).map(fcNorm_);}
  const model={byId,blocks};model.semantic=fcBuildSemantic_(model);return model;
}
function fcClassify_(input,model,revision,review=null) {
 const text=fcNorm_(input.text),matched=review?{ids:review.ids,evidence:new Map()}:text?fcSemanticMatches_(text,model):{ids:[],evidence:new Map()};
 const assignments=matched.ids.map(id=>{const row=model.byId.get(id),block=model.blocks.get(id.slice(0,2));return {id,blockId:id.slice(0,2),blockName:block?.name||'',suboperationName:row?.functionName||'Otros',isOther:id.endsWith('.xx')};});
 const evidence=matched.ids.map(id=>review?{id,terms:[],method:'reviewed-assignment',reference:review.reference,contentHash:review.contentHash}:{id,terms:(matched.evidence.get(id)||[]).slice(0,5),method:matched.evidence.has(id)?'literal-or-semantic':'block-fallback'});
 return {id:String(input.id),assignments,matched:assignments.length>0,evidence,revision,algorithmVersion:FC_VERSION};
}
function classifyText(text) {return classifyBatch([{id:'0',text}]).results[0];}
function classifyBatch(records,options) {
  if(!Array.isArray(records)||records.length===0||records.length>3000)throw Error('Lote inválido: máximo 3000 registros por llamada');
  if(records.some(r=>r && r.id!==undefined && r.id!==null && (String(r.id).trim()==='' || String(r.id).length>200)))throw Error('INVALID_RECORD_ID');
  if(records.some(r=>!r||r.id===undefined||r.id===null||typeof r.text!=='string'))throw Error('Todos los registros deben incluir id y text');
  const recordIds=records.map(r=>String(r.id));
  if(new Set(recordIds).size!==recordIds.length)throw Error('DUPLICATE_RECORD_IDS: identificadores repetidos en el lote');
  const start=Date.now(),snapshot=fcReadSnapshot_(),rules=fcRules_(),translations=fcTranslations_(snapshot.revision),rulesRevision=fcHash_(JSON.stringify(rules)),translationsRevision=fcHash_(JSON.stringify(translations)),model=fcCompile_(snapshot,rules,translations),results=[];
  const opts=options||{},caller=String(opts.caller||'unknown').slice(0,80),jobId=String(opts.jobId||Utilities.getUuid()).slice(0,100);
  if(opts.requirePinnedRevisions && (!opts.caller || !opts.jobId))throw Error('MISSING_JOB_IDENTITY');
  if(opts.requirePinnedRevisions && (!opts.expectedRevision||!opts.expectedAlgorithmVersion||!opts.expectedRulesRevision||!opts.expectedTranslationsRevision))throw Error('UNPINNED_JOB: se requieren las cuatro revisiones para continuar el job');
  if(opts.expectedRevision && opts.expectedRevision!==snapshot.revision)throw Error('CATALOG_REVISION_CHANGED: reintentar el job con una revisión consistente');
  if(opts.expectedAlgorithmVersion && opts.expectedAlgorithmVersion!==FC_VERSION)throw Error('ALGORITHM_VERSION_CHANGED');
  if(opts.expectedRulesRevision && opts.expectedRulesRevision!==rulesRevision)throw Error('RULES_REVISION_CHANGED');
  if(opts.expectedTranslationsRevision && opts.expectedTranslationsRevision!==translationsRevision)throw Error('TRANSLATIONS_REVISION_CHANGED');
  if(opts.requireCompleteTranslations && fcMissingTranslations_(snapshot,translations).length)throw Error('TRANSLATIONS_INCOMPLETE');
  const reviews=fcReviewedAssignments_(opts.reviewedAssignments??[]);
  if(reviews.items.length && opts.expectedReviewRevision!==reviews.revision)throw Error('REVIEW_REVISION_CHANGED: fijar la revisión de las adjudicaciones');
  for(const review of reviews.items)for(const id of review.ids)if(!model.byId.has(id)&&!(/^\d{2}\.xx$/.test(id)&&model.blocks.has(id.slice(0,2))))throw Error('UNKNOWN_REVIEW_ASSIGNMENT: '+id);
  for(const record of records){const review=reviews.byId.get(String(record.id));if(review&&review.contentHash!==fcReviewHash_(record.text))throw Error('REVIEWED_CONTENT_CHANGED: '+record.id);}
  for(const record of records){try{if(!record||record.id===undefined||typeof record.text!=='string')throw Error('id y text obligatorios');results.push(fcClassify_(record,model,snapshot.revision,reviews.byId.get(String(record.id))));}catch(e){results.push({id:String(record?.id??''),error:String(e.message),assignments:[],revision:snapshot.revision});}}
  const failed=results.filter(r=>r.error).length;
  if(opts.failOnRecordError && failed)throw Error('BATCH_RECORD_ERRORS: '+failed+' de '+records.length+'; no confirmar checkpoint');
  fcRecordExecution_({jobId,caller,total:records.length,processed:results.length,failed,started:start,revision:snapshot.revision});
  return {results,revision:snapshot.revision,rulesRevision,translationsRevision,algorithmVersion:FC_VERSION,...(reviews.items.length?{reviewedAssignmentsRevision:reviews.revision}:{}),elapsedMs:Date.now()-start};
}

/** Explicit, content-bound human decisions; never inferred from article IDs or topics. */
function fcReviewedAssignments_(items){
 if(!Array.isArray(items)||items.length>3000)throw Error('INVALID_REVIEWED_ASSIGNMENTS');
 const byId=new Map();
 for(const item of items){
  if(!item||typeof item.recordId!=='string'||!item.recordId.trim()||item.recordId.length>200||byId.has(item.recordId))throw Error('INVALID_REVIEW_RECORD_ID');
  if(typeof item.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(item.contentHash)||typeof item.reference!=='string'||!item.reference.trim()||item.reference.length>160)throw Error('INVALID_REVIEW_PROVENANCE');
  if(!Array.isArray(item.ids)||!item.ids.length||new Set(item.ids).size!==item.ids.length||item.ids.some(id=>typeof id!=='string'||!/^\d{2}\.(?:\d{2}(?:\.\d{2})?|xx|XX)$/.test(id)))throw Error('INVALID_REVIEW_ASSIGNMENTS');
  byId.set(item.recordId,{recordId:item.recordId,contentHash:item.contentHash,ids:item.ids.slice(),reference:item.reference});
 }
 const normalized=[...byId.values()].sort((a,b)=>a.recordId.localeCompare(b.recordId)),revision=normalized.length?fcReviewHash_(JSON.stringify(normalized)):null;
 return {items:normalized,byId,revision};
}
function fcReviewHash_(text){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,text,Utilities.Charset.UTF_8).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');}
function getReviewedAssignmentsRevision(items){return fcReviewedAssignments_(items).revision;}

/** Obtain revisions before the first chunk; callers must pin all four for the entire job. */
function getClassifierRevisions(){
  const snapshot=fcReadSnapshot_(),rules=fcRules_(),translations=fcTranslations_(snapshot.revision);
  return {expectedRevision:snapshot.revision,expectedRulesRevision:fcHash_(JSON.stringify(rules)),expectedTranslationsRevision:fcHash_(JSON.stringify(translations)),expectedAlgorithmVersion:FC_VERSION};
}
/** Shadow-only: returns predictions without writing classifications to consumer data. */
function classifyShadowBatch(records,options){
  const opts=Object.assign({},options||{},{requirePinnedRevisions:true,failOnRecordError:true});
  return classifyBatch(records,opts);
}
