import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
function runtime(){const c=vm.createContext({});for(const file of ['Classifier.gs','EvidenceRanking.gs','EvidenceBatch.gs','FunctionalRuntime.gs'])vm.runInContext(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),c);return c;}
test('shared runtime is pure and preserves the caller row and discriminating evidence',()=>{
 const c=runtime(),rows=[{id:'block',palanca:'03.Pagos',subpalanca:'',terms:['international bank transfers'],emerging:[]},{id:'specific',palanca:'03.Pagos',subpalanca:'03.01.International transfers',terms:['international bank transfers'],description:''},{id:'other',palanca:'03.Pagos',subpalanca:'03.xx Otros',terms:[],description:''}];
 const result=c.matchFunctionalEvidence('International bank transfers for businesses',rows,'International bank transfers');assert.equal(result.matches[0].row,rows[1]);assert.equal(result.matches[0].evidence.method,'literal');assert.equal(c.matchFunctionalEvidence('Weather forecast',rows,'Weather').matches.length,0);assert.equal(c.getFunctionalFallback('Novedad empresarial',{capacidades:['Empresas: Pagos']},rows).id,'other');
 assert.equal(c.hasFunctionalEvidence('International bank transfers',['international bank transfers']),true);assert.equal(c.hasFunctionalEvidence('Banco digital',['banco']),false);assert.equal(c.evaluateFunctionalContext('BNPL deferred payments').financing!==null,true);
});
test('shared runtime handles accents and sharp s in definitions without changing caller data',()=>{
 const c=runtime(),rows=[{palanca:'03.Pagos',subpalanca:'03.01.Großzahlungen',terms:['Großzahlungen'],context:[],exclude:[],description:''}],before=JSON.stringify(rows);assert.equal(c.matchFunctionalEvidence('Grosszahlungen im Geschäftskonto',rows,'Grosszahlungen').matches[0].row,rows[0]);assert.equal(JSON.stringify(rows),before);assert.equal(c.getFunctionalRuntimePolicy().version,'3.38.1');
});
