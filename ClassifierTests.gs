/** Synthetic contract cases; no production text, Sheets or configuration writes. */
function fcReviewedAssignmentContractTests(){
 const model={byId:new Map(),blocks:new Map([['17',{id:'17',name:'17.Enablers',terms:[],exclude:[]}]])};
 model.semantic=fcBuildSemantic_(model);
 const input={id:'review-case',text:'Synthetic editorial decision'},review={recordId:input.id,contentHash:fcHash_(input.text),ids:['17.xx'],reference:'synthetic-reviewed-reference'};
 const parsed=fcReviewedAssignments_([review]),decision=fcClassify_(input,model,'synthetic',parsed.byId.get(input.id));
 if(decision.assignments.length!==1||decision.assignments[0].id!=='17.xx'||decision.evidence[0].method!=='reviewed-assignment')throw Error('Reviewed assignment contract failed');
 if(fcClassify_({...input,id:'unreviewed'},model,'synthetic').assignments.length)throw Error('Reviewed assignment leaked to unreviewed input');
 if(getReviewedAssignmentsRevision([review])===getReviewedAssignmentsRevision([{...review,reference:'changed'}]))throw Error('Review provenance is not pinned');
 return {ok:true,cases:3};
}
