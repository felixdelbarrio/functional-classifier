/** Evidence-based classification against an explicitly pinned consumer catalog.
 * Catalog data is supplied by the consumer; no historic article labels are model inputs.
 * Admission, geography, LLM precedence and publication remain consumer responsibilities.
 */
function fcEvidenceStrings_(value,max=100){
 if(!Array.isArray(value)||value.length>max||value.some(x=>typeof x!=='string'||!x.trim()||x.length>200))throw Error('INVALID_EVIDENCE_TERMS');return value.map(fcEvidenceTaxonomyText_);
}
function fcEvidenceModel_(definitions){
 if(!Array.isArray(definitions)||!definitions.length||definitions.length>1500)throw Error('INVALID_EVIDENCE_MODEL');
 const keys=new Set(),byCode=new Map(),rows=definitions.map(item=>{
  if(!item||typeof item.block!=='string'||!/^\d{2}\..{1,150}$/.test(item.block)||typeof item.operation!=='string'||item.operation.length>300||typeof item.description!=='string'||item.description.length>10000)throw Error('INVALID_EVIDENCE_DEFINITION');
  const code=item.operation.match(/^\d{2}\.(?:\d{2}(?:\.\d{2})?|xx|XX)(?=[. ]|$)/)?.[0]||'';
  if(item.operation&&(!code||code.slice(0,2)!==item.block.slice(0,2)))throw Error('INVALID_EVIDENCE_CATALOGUE_ID');
  const key=item.block+'|'+item.operation;if(keys.has(key))throw Error('DUPLICATE_EVIDENCE_DEFINITION');keys.add(key);
  const emerging=item.emerging??[];if(!Array.isArray(emerging)||emerging.length>20)throw Error('INVALID_EVIDENCE_CONCEPTS');
  const concepts=emerging.map(concept=>{if(!concept||typeof concept.name!=='string'||!concept.name||concept.name.length>100)throw Error('INVALID_EVIDENCE_CONCEPT');return {name:concept.name,terms:fcEvidenceStrings_(concept.terms,24),context:fcEvidenceStrings_(concept.context??[],24),exclude:fcEvidenceStrings_(concept.exclude??[],24)};});
  const normalized={block:item.block,operation:item.operation,description:item.description,terms:fcEvidenceStrings_(item.terms),context:fcEvidenceStrings_(item.context??[],24),exclude:fcEvidenceStrings_(item.exclude??[],24),emerging:concepts};
  const row={id:key,palanca:normalized.block,subpalanca:normalized.operation,description:normalized.description,terms:normalized.terms,context:normalized.context,exclude:normalized.exclude,emerging:normalized.emerging,code};
  if(code){if(!byCode.has(code))byCode.set(code,[]);byCode.get(code).push(row);}return {normalized,row};
 });
 const blocks=new Set(rows.filter(x=>!x.row.subpalanca).map(x=>x.row.palanca));
 if(rows.some(x=>!blocks.has(x.row.palanca)))throw Error('EVIDENCE_BLOCK_DEFINITION_MISSING');
 const normalized=rows.map(x=>x.normalized),revision=fcReviewHash_(JSON.stringify({schema:1,policy:FC_EVIDENCE_POLICY.version,definitions:normalized}));
 return {rows:rows.map(x=>x.row),byCode,revision};
}
function getEvidenceModelRevision(definitions){return fcEvidenceModel_(definitions).revision;}
function fcEvidenceFallback_(text,context,rows){
 const capabilities=new Set(context.capabilities.map(value=>value.replace(/^Empresas:\s*/,''))),event=context.signal,functional=fcEvidenceFunctionalContext_(text);let prefix='';
 if(functional.financing)prefix='08.xx';
 else if(functional.acquiring)prefix='11.xx';
 else if(functional.card&&!functional.transfer)prefix='09.xx';
 else if(event==='Indisponibilidad / Incidencia operativa')prefix=/\b(?:login|log in|logins|acceso)\b/.test(text)?'16.xx':/\b(?:pago|pagos|payment|payments|transferencia|transferencias|bizum)\b/.test(text)?'03.xx':/\b(?:app|web|portal|banca|banking|canal)\b/.test(text)?'17.xx':'19.xx';
 else if(capabilities.has('Transferencias')||capabilities.has('Pagos'))prefix='03.xx';
 else if(capabilities.has('Adquirencia y terminales'))prefix='11.xx';
 else if(capabilities.has('Cobros y recaudación'))prefix='07.xx';
 else if(capabilities.has('Financiación digital')||capabilities.has('Préstamos y líneas de crédito'))prefix='08.xx';
 else if(capabilities.has('Autenticación y seguridad')||capabilities.has('Biometría'))prefix='16.xx';
 else if(capabilities.has('API bancarias')||capabilities.has('Aplicaciones móviles empresariales')||capabilities.has('Banca electrónica corporativa'))prefix='17.xx';
 const row=prefix&&rows.find(row=>row.subpalanca.startsWith(prefix));return row?{row,evidence:{method:'capability-fallback',rule:prefix,capabilities:[...capabilities].sort(),signal:event}}:null;
}
function classifyEvidenceBatch(records,definitions,options){
 if(!Array.isArray(records)||!records.length||records.length>3000)throw Error('INVALID_EVIDENCE_BATCH');
 const seen=new Set();for(const record of records){
  if(!record||typeof record.id!=='string'||!record.id.trim()||record.id.length>200||seen.has(record.id)||typeof record.text!=='string'||typeof record.headline!=='string'||typeof record.eligible!=='boolean')throw Error('INVALID_EVIDENCE_RECORD');seen.add(record.id);
  const context=record.context;if(!context||typeof context.digital!=='boolean'||typeof context.signal!=='string'||context.signal.length>120)throw Error('INVALID_EVIDENCE_CONTEXT');fcEvidenceStrings_(context.capabilities,80);
 }
 const started=Date.now(),opts=options||{},pins=getClassifierRevisions();
 if(!opts.caller||!opts.jobId)throw Error('MISSING_JOB_IDENTITY');
 for(const key of ['expectedRevision','expectedRulesRevision','expectedTranslationsRevision','expectedAlgorithmVersion'])if(!opts[key]||opts[key]!==pins[key])throw Error('EVIDENCE_PIN_CHANGED: '+key);
 const model=fcEvidenceModel_(definitions);if(opts.expectedEvidenceModelRevision!==model.revision)throw Error('EVIDENCE_MODEL_REVISION_CHANGED');
 const reviews=fcReviewedAssignments_(opts.reviewedAssignments??[]);if(reviews.items.length&&opts.expectedReviewRevision!==reviews.revision)throw Error('REVIEW_REVISION_CHANGED');
 for(const review of reviews.items)for(const id of review.ids)if(model.byCode.get(id)?.length!==1)throw Error('UNKNOWN_OR_AMBIGUOUS_REVIEW_ASSIGNMENT');
 for(const record of records){const review=reviews.byId.get(record.id);if(review&&review.contentHash!==fcReviewHash_(record.text))throw Error('REVIEWED_CONTENT_CHANGED: '+record.id);}
 const results=records.map(record=>{
  const review=reviews.byId.get(record.id),text=fcEvidenceTaxonomyText_(record.text);let decision;
  if(review)decision={matches:review.ids.map(id=>({row:model.byCode.get(id)[0],evidence:{method:'reviewed-assignment',terms:[],reference:review.reference,contentHash:review.contentHash}})),reason:'reviewed-assignment'};
  else if(!record.eligible)decision={matches:[],reason:'insufficient'};
  else{decision=fcEvidenceTaxonomyDecision_(text,model.rows,record.headline);if(!decision.matches.length&&record.context.digital){const fallback=fcEvidenceFallback_(text,record.context,model.rows);if(fallback)decision={matches:[fallback],reason:'capability-fallback'};}}
  const assignments=decision.matches.map(({row})=>({id:row.code,blockId:row.palanca.slice(0,2),blockName:row.palanca,suboperationName:row.subpalanca,isOther:row.code.endsWith('.xx')})),evidence=decision.matches.map(({row,evidence})=>({id:row.code,blockName:row.palanca,suboperationName:row.subpalanca,...evidence}));
  return {id:record.id,assignments,evidence,matched:assignments.length>0,reason:decision.reason,revision:pins.expectedRevision,algorithmVersion:pins.expectedAlgorithmVersion,evidenceModelRevision:model.revision};
 });
 if(JSON.stringify(getClassifierRevisions())!==JSON.stringify(pins))throw Error('EVIDENCE_PINS_CHANGED_DURING_BATCH');
 fcRecordExecution_({jobId:String(opts.jobId).slice(0,100),caller:String(opts.caller).slice(0,80),total:records.length,processed:results.length,failed:0,started,revision:pins.expectedRevision});
 return {results,revision:pins.expectedRevision,rulesRevision:pins.expectedRulesRevision,translationsRevision:pins.expectedTranslationsRevision,algorithmVersion:pins.expectedAlgorithmVersion,evidenceModelRevision:model.revision,...(reviews.items.length?{reviewedAssignmentsRevision:reviews.revision}:{}),elapsedMs:Date.now()-started};
}
