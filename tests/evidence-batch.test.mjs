import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import vm from'node:vm';import{createHash}from'node:crypto';
function fixture(){
 const events=[],c=vm.createContext({Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,value)=>[...createHash('sha256').update(value).digest()]}});
 for(const name of['Classifier.gs','EvidenceRanking.gs','EvidenceBatch.gs'])vm.runInContext(fs.readFileSync(new URL('../'+name,import.meta.url),'utf8'),c);
 const pins={expectedRevision:'catalog',expectedRulesRevision:'rules',expectedTranslationsRevision:'translations',expectedAlgorithmVersion:'algorithm'};c.getClassifierRevisions=()=>({...pins});c.fcRecordExecution_=event=>events.push(event);
 const row=(block,operation,terms=[])=>({block,operation,description:'',terms,context:[],exclude:[],emerging:[]}),definitions=[row('03.Pagos','',['transferencias internacionales']),row('03.Pagos','03.xx Otros'),row('03.Pagos','03.01.Transferencias internacionales',['transferencias internacionales']),row('17.Enablers','',['canal api empresarial']),row('17.Enablers','17.xx Otros'),row('17.Enablers','17.16.API Channel',['canal api empresarial'])];
 const input=(id,text,extra={})=>({id,text,headline:text,eligible:true,context:{digital:true,capabilities:[],signal:''},...extra}),options=()=>({...pins,caller:'synthetic',jobId:'job',expectedEvidenceModelRevision:c.getEvidenceModelRevision(definitions)});
 return {c,events,pins,definitions,row,input,options};
}
const plain=value=>JSON.parse(JSON.stringify(value));
test('pinned consumer definitions yield mapped paths and honest literal evidence',()=>{
 const {c,definitions,input,options,events}=fixture(),result=c.classifyEvidenceBatch([input('a','Transferencias internacionales para empresas')],definitions,options());assert.deepEqual(plain(result.results[0].assignments.map(x=>x.id)),['03.01']);assert.equal(result.results[0].assignments[0].suboperationName,'03.01.Transferencias internacionales');assert.equal(result.results[0].evidence[0].method,'literal');assert.equal(events.length,1);
});
test('admission remains explicit; approved content-bound decisions do not change other records',()=>{
 const {c,definitions,input,options}=fixture(),text='Adjudicación explícita — Türkiye',reviews=[{recordId:'approved',contentHash:createHash('sha256').update(text).digest('hex'),ids:['17.xx'],reference:'synthetic-review'}];
 const result=c.classifyEvidenceBatch([input('approved',text,{eligible:false}),input('other',text,{eligible:false})],definitions,{...options(),reviewedAssignments:reviews,expectedReviewRevision:c.getReviewedAssignmentsRevision(reviews)});assert.deepEqual(plain(result.results.map(r=>r.assignments.map(a=>a.id))),[['17.xx'],[]]);assert.equal(result.results[0].evidence[0].method,'reviewed-assignment');
});
test('a changed model, pin, text or review revision aborts before execution metadata is written',()=>{
 const {c,definitions,input,options,events}=fixture(),records=[input('a','Transferencias internacionales')],changed=plain(definitions);changed[2].terms.push('nuevo concepto');assert.throws(()=>c.classifyEvidenceBatch(records,changed,options()),/MODEL_REVISION_CHANGED/);assert.throws(()=>c.classifyEvidenceBatch(records,definitions,{...options(),expectedRulesRevision:'changed'}),/PIN_CHANGED/);
 const reviews=[{recordId:'a',contentHash:'a'.repeat(64),ids:['17.xx'],reference:'synthetic'}],reviewOptions={...options(),reviewedAssignments:reviews,expectedReviewRevision:c.getReviewedAssignmentsRevision(reviews)};assert.throws(()=>c.classifyEvidenceBatch(records,definitions,reviewOptions),/CONTENT_CHANGED/);assert.throws(()=>c.classifyEvidenceBatch(records,definitions,{...reviewOptions,expectedReviewRevision:'changed'}),/REVIEW_REVISION_CHANGED/);assert.equal(events.length,0);
});
test('capability fallback preserves its derivation without fabricating a quoted term',()=>{
 const {c,definitions,input,options}=fixture(),record=input('a','Novedad empresarial',{context:{digital:true,capabilities:['Empresas: Pagos'],signal:'Mejora de oferta'}}),result=c.classifyEvidenceBatch([record],definitions,options()).results[0];assert.equal(result.assignments[0].id,'03.xx');assert.equal(result.reason,'capability-fallback');assert.equal(result.evidence[0].terms,undefined);assert.equal(result.evidence[0].rule,'03.xx');
});
test('duplicate definitions and ambiguous reviewed codes cannot silently choose an internal category',()=>{
 const {c,definitions,row,input,options,events}=fixture();assert.throws(()=>c.getEvidenceModelRevision([...definitions,definitions[0]]),/DUPLICATE/);
 const ambiguous=[...definitions,row('13.Salud',''),row('13.Salud','13.xx Otros'),row('13.Sostenibilidad',''),row('13.Sostenibilidad','13.xx Otros')],review=[{recordId:'a',contentHash:createHash('sha256').update('Synthetic').digest('hex'),ids:['13.xx'],reference:'synthetic'}];assert.throws(()=>c.classifyEvidenceBatch([input('a','Synthetic')],ambiguous,{...options(),expectedEvidenceModelRevision:c.getEvidenceModelRevision(ambiguous),reviewedAssignments:review,expectedReviewRevision:c.getReviewedAssignmentsRevision(review)}),/AMBIGUOUS_REVIEW/);assert.equal(events.length,0);
});
test('revision drift at the end of the batch rejects the output before recording success',()=>{
 const {c,definitions,input,options,pins,events}=fixture();let calls=0;c.getClassifierRevisions=()=>({...pins,expectedRulesRevision:++calls===1?'rules':'changed'});assert.throws(()=>c.classifyEvidenceBatch([input('a','Transferencias internacionales')],definitions,options()),/PINS_CHANGED_DURING_BATCH/);assert.equal(events.length,0);
});

test('consumer aliases normalize accents and case before hashing and matching',()=>{
 const {c,definitions,input,options}=fixture(),equivalent=plain(definitions);equivalent[2].terms=['TRANSFERENCIAS INTERNACIONALES'];assert.equal(c.getEvidenceModelRevision(equivalent),c.getEvidenceModelRevision(definitions));assert.equal(c.classifyEvidenceBatch([input('a','Transferencias internacionales')],equivalent,options()).results[0].assignments[0].id,'03.01');
});

test('evidence API also matches sharp s spelling variants and respects the exclusion',()=>{
 const {c,row,input,options}=fixture(),definitions=[row('03.Pagos','',['Großzahlungen']),row('03.Pagos','03.xx Otros'),{...row('03.Pagos','03.01.Großzahlungen',['Großzahlungen']),exclude:['Testverfahren']}],opts={...options(),expectedEvidenceModelRevision:c.getEvidenceModelRevision(definitions)};
 assert.equal(c.classifyEvidenceBatch([input('a','Grosszahlungen für Geschäftskunden')],definitions,opts).results[0].assignments[0].id,'03.01');
 assert.equal(c.classifyEvidenceBatch([input('b','Grosszahlungen im Testverfahren')],definitions,opts).results[0].assignments.some(a=>a.id==='03.01'),false);
});
