import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const c=vm.createContext({});
for(const file of ['LanguageLexicon.gs','Classifier.gs','SemanticEngine.gs','FunctionalEvidence.gs'])vm.runInContext(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),c);
test('sharp s spelling variants retain whole words without merging neighbouring words',()=>{
 for(const text of ['Straße','STRAẞE','Strasse'])assert.equal(c.fcNorm_(text),'strasse');
 assert.equal(c.fcNorm_('Straße / Zahlungen'),'strasse zahlungen');
 assert.equal(c.fcHas_(c.fcNorm_('Grosszahlungen im Geschäftskonto'),'Großzahlungen'),true);
 assert.equal(c.fcHas_(c.fcNorm_('Grosszahlungen im Geschäftskonto'),'Gross'),false);
});
test('German aliases match the actual engine, retain exclusions and do not affect unrelated text',()=>{
 const model=c.fcCompile_({items:[{id:'03.01',blockName:'03.Zahlungsverkehr',functionName:'Spezifische Überweisung',description:''}]},{'03.01':{terms:['Großzahlungen'],exclude:['Testverfahren']}},{});
 const ids=text=>Array.from(c.fcClassify_({id:'synthetic',text},model,'synthetic').assignments,x=>x.id);
 assert.deepEqual(ids('Grosszahlungen im Geschäftskonto'),['03.01']);
 assert.deepEqual(ids('Großzahlungen im Testverfahren'),[]);
 assert.deepEqual(ids('Grossartige Wettervorhersage'),[]);
});
test('Turkish, Romanian, Dutch and mixed text keep existing accent and boundary behaviour',()=>{
 for(const [text,expected] of [['İŞLETME IŞIK ı','isletme isik i'],['șț ăîâ','st aia'],['financiële liquiditeitsbeheer','financiele liquiditeitsbeheer'],['Straße ödeme plăți','strasse odeme plati']])assert.equal(c.fcNorm_(text),expected);
});
