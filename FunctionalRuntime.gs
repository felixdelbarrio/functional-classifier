/** Pure functional policy shared by ingestion, classification and catalogue analysis.
 * Definitions and assignment persistence remain owned by the caller. No Sheets,
 * translation, execution logging or network calls occur through these functions.
 */
function getFunctionalRuntimePolicy(){return {version:FC_EVIDENCE_POLICY.version,algorithmVersion:FC_VERSION,maxAssignments:FC_EVIDENCE_POLICY.maxAssignments};}
function normalizeFunctionalText(value){return fcEvidenceTaxonomyText_(value);}
function evaluateFunctionalContext(value){return fcEvidenceFunctionalContext_(value);}
function getFunctionalFinancingPurpose(value){return fcEvidenceFinancingPurpose_(value);}
function getFunctionalPrimary(value){return fcEvidenceFunctionalPrimary_(value);}
const fcFunctionalRuntimeModels_=new WeakMap();
function matchFunctionalEvidence(text,definitions,headline){
 let model=fcFunctionalRuntimeModels_.get(definitions);
 if(!model){const original=new Map(),rows=definitions.map(row=>{const code=row.subpalanca?.match(/^\d{2}\.\d{2}(?=[. ]|$)/)?.[0]||'',copy={...row,terms:[...new Set([...row.terms,...fcFunctionalAliases_(code)].map(fcEvidenceTaxonomyText_))],context:(row.context||[]).map(fcEvidenceTaxonomyText_),exclude:[...(row.exclude||[]),...fcFunctionalExclusions_(code)].map(fcEvidenceTaxonomyText_)};original.set(copy,row);return copy;});model={rows,original};fcFunctionalRuntimeModels_.set(definitions,model);}
 const decision=fcEvidenceTaxonomyDecision_(fcEvidenceTaxonomyText_(text),model.rows,headline||'');
 return {...decision,matches:decision.matches.map(match=>({...match,row:model.original.get(match.row)}))};
}
function countFunctionalTerms(text,terms){return fcEvidenceTaxonomyTermCounts_(text,terms);}
function isIndependentFunctionalEvidence(evidence,used){return fcEvidenceTaxonomyIndependentEvidence_(evidence,used);}
function hasFunctionalEvidence(text,terms){return [...fcEvidenceTaxonomyTermCounts_(fcEvidenceTaxonomyText_(text),terms.map(fcEvidenceTaxonomyText_)).keys()].some(term=>fcEvidenceWords_(term).some(word=>!fcEvidenceRankingStopWords_.has(fcEvidenceRankingWord_(word))));}
function getFunctionalFallback(text,labels,definitions){
 const result=fcEvidenceFallback_(fcEvidenceTaxonomyText_(text),{capabilities:labels.capacidades||[],signal:labels.evento||''},definitions);
 return result?{id:result.row.id,...result.evidence}:{};
}
