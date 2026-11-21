import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
function fixture(baseline=false){
 const events=[],c=vm.createContext({console,Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'UTF-8'},computeDigest:(_algorithm,text,charset)=>Array.from(createHash('sha256').update(charset==='UTF-8'?text:text.replace(/[^\x00-\x7f]/g,'?')).digest()),getUuid:()=> 'synthetic-job'}});
 for(const name of ['Catalog.gs','Classifier.gs','FunctionalEvidence.gs','SemanticEngine.gs','ClassifierTests.gs','ReleaseGate.gs']){
  const source=baseline?execFileSync('git',['show','f96510b:'+name],{cwd:new URL('../',import.meta.url),encoding:'utf8'}):fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
  vm.runInContext(source,c,{filename:name});
 }
 c.fcReadSnapshot_=()=>({revision:'catalogue-1',items:[{id:'03.01',blockName:'03.Pagos',functionName:'Transferencias internacionales',description:''},{id:'08.01',blockName:'08.Financiación',functionName:'Préstamos empresariales',description:''},{id:'17.16',blockName:'17.Enablers',functionName:'API Channel',description:''}]});
 c.fcRules_=()=>({'03.01':{terms:['international bank transfer']},'08.01':{terms:['business loan']},'17.16':{terms:['api channel']}});
 c.fcTranslations_=()=>({});c.fcRecordExecution_=event=>events.push(event);
 const reviews=[{recordId:'approved',contentHash:c.fcHash_('Synthetic editorial decision'),ids:['17.xx'],reference:'synthetic-user-approval'}];
 const pins=()=>({...c.getClassifierRevisions(),caller:'test',jobId:'synthetic-job',requirePinnedRevisions:true,failOnRecordError:true});
 const options=()=>({...pins(),reviewedAssignments:reviews,expectedReviewRevision:c.getReviewedAssignmentsRevision(reviews)});
 return {c,events,reviews,options,pins};
}
const plain=value=>JSON.parse(JSON.stringify(value));
test('explicit reviewed decision changes only the approved ID and keeps evidence honest',()=>{
 const {c,options}=fixture(),out=c.classifyShadowBatch([{id:'approved',text:'Synthetic editorial decision'},{id:'other',text:'Synthetic editorial decision'}],options());
 assert.deepEqual(plain(out.results[0].assignments.map(x=>x.id)),['17.xx']);assert.deepEqual(plain(out.results[1].assignments),[]);
 assert.equal(out.results[0].evidence[0].method,'reviewed-assignment');assert.deepEqual(plain(out.results[0].evidence[0].terms),[]);assert.equal(out.results[0].evidence[0].reference,'synthetic-user-approval');
});
test('changed content or review revision fails before execution is recorded',()=>{
 const {c,options,events}=fixture();assert.throws(()=>c.classifyShadowBatch([{id:'approved',text:'Changed text'}],options()),/REVIEWED_CONTENT_CHANGED/);
 assert.throws(()=>c.classifyShadowBatch([{id:'approved',text:'Synthetic editorial decision'}],{...options(),expectedReviewRevision:'old'}),/REVIEW_REVISION_CHANGED/);assert.equal(events.length,0);
});
test('unknown catalogue target, duplicate IDs and missing provenance fail closed',()=>{
 const {c,reviews,options,events}=fixture();const unknown=[{...reviews[0],ids:['99.xx']}];
 assert.throws(()=>c.classifyBatch([{id:'approved',text:'Synthetic editorial decision'}],{...options(),reviewedAssignments:unknown,expectedReviewRevision:c.getReviewedAssignmentsRevision(unknown)}),/UNKNOWN_REVIEW_ASSIGNMENT/);
 assert.throws(()=>c.getReviewedAssignmentsRevision([reviews[0],reviews[0]]),/INVALID_REVIEW_RECORD_ID/);
 assert.throws(()=>c.getReviewedAssignmentsRevision([{...reviews[0],reference:''}]),/INVALID_REVIEW_PROVENANCE/);assert.equal(events.length,0);
});
test('review order is canonical and revision includes content, targets and provenance',()=>{
 const {c,reviews}=fixture(),a=reviews[0],b={...a,recordId:'second'};assert.equal(c.getReviewedAssignmentsRevision([a,b]),c.getReviewedAssignmentsRevision([b,a]));
 for(const change of [{reference:'different'},{contentHash:'a'.repeat(64)},{ids:['03.xx']}])assert.notEqual(c.getReviewedAssignmentsRevision([a]),c.getReviewedAssignmentsRevision([{...a,...change}]));
});
test('unreviewed ES/EN/TR behaviour is identical with and without unrelated decisions',()=>{
 const {c,pins,options}=fixture();const inputs=['business loan','international bank transfer','API Channel','hava durumu','préstamo empresarial','tiempo meteorológico'].map((text,i)=>({id:'unreviewed-'+i,text}));
 assert.deepEqual(plain(c.classifyBatch(inputs,pins()).results),plain(c.classifyBatch(inputs,options()).results));
});
test('public Apps Script contracts remain executable without live data',()=>{const {c}=fixture();assert.deepEqual(plain(c.fcContractTests()),{ok:true,cases:6});});
test('differential regression against develop preserves unreviewed outputs',()=>{
 const before=fixture(true),after=fixture(),phrases=['business loan','international bank transfer','API Channel','hava durumu','préstamos empresariales','transferencias internacionales','loan repayment','kredi taksiti','credit card repayment','weather forecast'];
 const inputs=Array.from({length:200},(_,i)=>({id:'synthetic-'+i,text:phrases[i%phrases.length]+' '+phrases[Math.floor(i/phrases.length)%phrases.length]}));
 const normalized=results=>plain(results).map(({algorithmVersion,...result})=>result);
 assert.deepEqual(normalized(after.c.classifyBatch(inputs,after.options()).results),normalized(before.c.classifyBatch(inputs,before.pins()).results));
});
test('incomplete pins and malformed reviews do not produce a partial batch',()=>{
 const {c,events,options,reviews}=fixture(),input=[{id:'approved',text:'Synthetic editorial decision'}];
 assert.throws(()=>c.classifyShadowBatch(input,{...options(),expectedReviewRevision:undefined}),/REVIEW_REVISION_CHANGED/);
 assert.throws(()=>c.classifyShadowBatch(input,{...options(),expectedAlgorithmVersion:'old'}),/ALGORITHM_VERSION_CHANGED/);
 for(const review of [{...reviews[0],contentHash:'invalid'},{...reviews[0],ids:[]},{...reviews[0],ids:['17.xx','17.xx']}])assert.throws(()=>c.getReviewedAssignmentsRevision([review]),/INVALID_REVIEW/);
 assert.throws(()=>c.classifyBatch(input,{...options(),reviewedAssignments:false}),/INVALID_REVIEWED_ASSIGNMENTS/);assert.equal(events.length,0);
});

test('reviewed text and provenance use explicit UTF-8 without changing legacy pins',()=>{
 const {c,pins}=fixture(),text='Financiación empresarial — Türkiye',reviews=[{recordId:'utf8',contentHash:createHash('sha256').update(text).digest('hex'),ids:['17.xx'],reference:'Adjudicación explícita'}];
 const revision=c.getReviewedAssignmentsRevision(reviews);assert.equal(revision,createHash('sha256').update(JSON.stringify(reviews)).digest('hex'));
 const result=c.classifyShadowBatch([{id:'utf8',text}],{...pins(),reviewedAssignments:reviews,expectedReviewRevision:revision});assert.equal(result.results[0].assignments[0].id,'17.xx');assert.notEqual(c.fcHash_(text),reviews[0].contentHash);
});
