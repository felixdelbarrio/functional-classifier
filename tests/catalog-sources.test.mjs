import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
function fixture(custom=false){
 const header=['ID','Bloque funcional','Funcionalidad/Sub Operativa','Descripción'];
 const tables=new Map([
  ['Soluciones Funcionales',[header,['08.01','Financiación','Préstamos','Financiación empresarial'],['17.01','Enablers','Canal API','Canal bancario']]],
  ['Capacidades canal (core y VD)',[header,['19.01','Core','Liquidaciones','Liquidación'],['20.01','Venta Digital','Contratación','Contratación de productos']]],
  ['Custom mirror',[header,['08.01','Financiación','Préstamos','Financiación empresarial']]]
 ]);
 const properties={FC_CATALOG_SHEET:custom?'Custom mirror':'Soluciones Funcionales'},writes=[],translations=[];
 const c=vm.createContext({PropertiesService:{getScriptProperties:()=>({getProperty:key=>properties[key],setProperty:(key,value)=>properties[key]=value})},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,text)=>[...createHash('sha256').update(text).digest()]},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})}});
 vm.runInContext(fs.readFileSync(new URL('../Catalog.gs',import.meta.url),'utf8'),c);
 c.fcBook_=()=>({getSheetByName:name=>tables.has(name)?{getDataRange:()=>({getDisplayValues:()=>tables.get(name)})}:null});
 c.fcSheet_=()=>({});c.fcWriteCatalogChunks_=(_sheet,revision,payload)=>writes.push({revision,items:JSON.parse(payload)});c.fcQueueTranslations_=(items,revision)=>translations.push({items,revision});
 return {c,tables,properties,writes,translations};
}
test('official sync includes functional operations, Core and Digital Sales before switching revision',()=>{
 const {c,writes,translations,properties}=fixture(),result=c.syncCatalog();assert.equal(result.items,4);assert.deepEqual(writes[0].items.map(x=>x.id),['08.01','17.01','19.01','20.01']);assert.equal(translations[0].revision,result.revision);assert.equal(properties.FC_ACTIVE_REV,result.revision);
});
test('missing official second sheet fails before any catalog or translation write',()=>{
 const {c,tables,writes,translations,properties}=fixture();tables.delete('Capacidades canal (core y VD)');assert.throws(()=>c.syncCatalog(),/Pestaña del catálogo ausente/);assert.equal(writes.length,0);assert.equal(translations.length,0);assert.equal(properties.FC_ACTIVE_REV,undefined);
});
test('duplicate IDs across source tabs fail before publishing a partial snapshot',()=>{
 const {c,tables,writes,properties}=fixture();tables.get('Capacidades canal (core y VD)').push(['08.01','Core','Duplicada','']);assert.throws(()=>c.syncCatalog(),/ID duplicado/);assert.equal(writes.length,0);assert.equal(properties.FC_ACTIVE_REV,undefined);
});
test('explicit custom mirror remains a single-sheet source and unchanged revision is idempotent',()=>{
 const {c,tables,writes,translations}=fixture(true);tables.delete('Capacidades canal (core y VD)');assert.equal(c.syncCatalog().items,1);assert.equal(c.syncCatalog().changed,false);assert.equal(writes.length,1);assert.equal(translations.length,1);
});

test('a partial Core/Digital Sales tab cannot become the active official catalog',()=>{
 const {c,tables,writes,properties}=fixture();tables.get('Capacidades canal (core y VD)').pop();assert.throws(()=>c.syncCatalog(),/Catálogo oficial incompleto/);assert.equal(writes.length,0);assert.equal(properties.FC_ACTIVE_REV,undefined);
});

test('official uppercase Otros entries do not conceal missing specific Core or Digital Sales operations',()=>{
 const {c,tables,writes}=fixture();tables.get('Soluciones Funcionales').push(['19.XX','Core','Otros',''],['20.XX','Venta Digital','Otros','']);tables.get('Capacidades canal (core y VD)').pop();assert.throws(()=>c.syncCatalog(),/Catálogo oficial incompleto/);assert.equal(writes.length,0);
});
