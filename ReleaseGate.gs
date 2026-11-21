/** Fail-closed readiness gate. It does not substitute real integration tests. */
function fcPreflight(){
 const p=PropertiesService.getScriptProperties();
 const missing=['FC_CATALOG_ID','FC_STORE_ID','FC_ADMIN_EMAILS'].filter(k=>!p.getProperty(k));
 if(missing.length)throw Error('Configuración incompleta: '+missing.join(', '));
 const rules=fcRules_();if(!Object.keys(rules).length)throw Error('Reglas de clasificación vacías: no se permite activar un motor léxico básico');
 const snapshot=fcReadSnapshot_();if(snapshot.items.length<10)throw Error('Catálogo insuficiente');
 const tests=fcContractTests();return {ok:true,revision:snapshot.revision,items:snapshot.items.length,tests};
}
function fcContractTests(){
 const model={byId:new Map([['08.01',{id:'08.01',blockName:'08.Financiación',functionName:'Préstamos',terms:['prestamos empresariales'],context:[],exclude:[]}],['03.01',{id:'03.01',blockName:'03.Pagos',functionName:'Transferencias',terms:['transferencias bancarias'],context:[],exclude:[]}]]),blocks:new Map([['08',{id:'08',name:'08.Financiación',terms:['financiacion'],exclude:[]}],['03',{id:'03',name:'03.Pagos',terms:['pagos'],exclude:[]}]])};
 model.semantic=fcBuildSemantic_(model);
 const result=fcClassify_({id:'x',text:'Préstamos empresariales y transferencias bancarias'},model,'test');
 if(result.assignments.length!==2)throw Error('Fallo multietiqueta');
 const other=fcClassify_({id:'y',text:'Financiación'},model,'test');
 if(other.assignments.length!==1||other.assignments[0].id!=='08.xx')throw Error('Fallo Otros');
 const none=fcClassify_({id:'z',text:'Tiempo meteorológico'},model,'test');
 if(none.assignments.length)throw Error('Falso positivo');
 const reviewed=fcReviewedAssignmentContractTests();
 return {ok:true,cases:3+reviewed.cases};
}
