import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createHash} from 'node:crypto';
function runtime(){const c=vm.createContext({Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'UTF-8'},computeDigest:(_,text,charset)=>[...createHash('sha256').update(charset==='UTF-8'?text:text.replace(/[^\x00-\x7f]/g,'?')).digest()],getUuid:()=> 'synthetic'}});for(const file of ['Catalog.gs','LanguageLexicon.gs','Classifier.gs','SemanticEngine.gs','FunctionalEvidence.gs','EvidenceRanking.gs','EvidenceBatch.gs','FunctionalRuntime.gs'])vm.runInContext(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),c);return c;}
const plain=x=>JSON.parse(JSON.stringify(x));
test('native APAC transfer evidence is recognized by the real feedback and shared runtime APIs',()=>{
 const c=runtime(),items=[{id:'03.13',blockName:'03.Pagos',functionName:'Transferencias internacionales',description:''}],definitions=[{id:'block',palanca:'03.Pagos',subpalanca:'',terms:[],emerging:[]},{id:'caller-transfer',palanca:'03.Pagos',subpalanca:'03.13.Transferencias internacionales',terms:['transferencias internacionales'],description:''},{id:'caller-other',palanca:'03.Pagos',subpalanca:'03.xx Otros',terms:[],description:''}];
 c.fcReadSnapshot_=()=>({revision:'synthetic-catalogue',items});c.fcRules_=()=>({'03.13':{terms:[]}});c.fcTranslations_=()=>({});c.fcRecordExecution_=()=>{};
 const locales=c.getFunctionalLanguageLexicon().filter(row=>['zh-Hans','zh-Hant','ja','ko','id','ms','vi','th','hi'].includes(row.language));assert.equal(locales.length,9);
 const records=locales.map(row=>({id:row.language,text:row.internationalTransfers[0]})),pins={...c.getClassifierRevisions(),caller:'test',jobId:'apac',requirePinnedRevisions:true,failOnRecordError:true},feedback=c.classifyBatch(records,pins);
 for(let i=0;i<records.length;i++){
  assert.deepEqual(plain(feedback.results[i].assignments.map(a=>a.id)),['03.13'],records[i].id);
  const matched=c.matchFunctionalEvidence(records[i].text,definitions,records[i].text);assert.equal(matched.matches[0].row.id,'caller-transfer',records[i].id);assert.equal(matched.matches[0].evidence.method,'literal');
  assert.equal(c.matchFunctionalEvidence(locales[i].excludedTransfers[0],definitions,'').matches.length,0,records[i].id+' exclusion');
 }
 const negated=locales.map(row=>({id:row.language,text:row.excludedTransfers[0]}));assert( c.classifyBatch(negated,{...pins,jobId:'negative'}).results.every(r=>!r.matched));
 for(const text of ['天气预报','天気予報','날씨예보','พยากรณ์อากาศ','मौसम पूर्वानुमान'])assert.equal(c.matchFunctionalEvidence(text,definitions,text).matches.length,0);
});
test('Unicode normalization preserves native letters and combining marks and folds fullwidth Latin',()=>{
 const c=runtime();for(const text of ['国际汇款','外国送金','해외송금','โอนเงินต่างประเทศ','अंतरराष्ट्रीय धन हस्तांतरण'])assert(c.fcNorm_(text).length>0,text);assert.equal(c.fcNorm_('ＡＰＩ channel'),'api channel');assert.equal(c.fcNorm_('अंतरराष्ट्रीय धन हस्तांतरण').includes('हस्तांतरण'),true);
});

test('European languages and both Portuguese variants share literal transfers and contextual exclusions',()=>{
 const c=runtime(),rows=[{id:'b',palanca:'03.Pagos',subpalanca:'',terms:[],emerging:[]},{id:'specific',palanca:'03.Pagos',subpalanca:'03.13.Transferencias internacionales',terms:['transferencias internacionales'],description:''},{id:'other',palanca:'03.Pagos',subpalanca:'03.xx Otros',terms:[]}];
 for(const language of ['tr','de','fr','it','ro','nl','pt-PT','pt-BR']){const lex=c.getFunctionalLanguageLexicon().find(row=>row.language===language);assert(lex,language);assert.equal(c.matchFunctionalEvidence(lex.internationalTransfers[0],rows,'').matches[0].row.id,'specific',language);assert.equal(c.matchFunctionalEvidence(lex.excludedTransfers[0],rows,'').matches.length,0,language+' excluded');}
});
