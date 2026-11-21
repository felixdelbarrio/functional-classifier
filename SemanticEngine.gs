/** Shared deterministic evidence engine. No audience, publication or source filters. */
const FC_STOP_WORDS = new Set(('de del la el los las y para por con que en un una mi tu su al se no banco banca empresa negocio empresarial aplicacion app digital plataforma servicio operacion cuenta tarjeta pago transferencia usuario gestion sistema informacion proceso permite realizar solicitar cliente the and of to in for with a an on from my your our bank banking business company account payment card transfer service platform user ve bir bu icin ile banka bankacilik sirket isletme odeme hesap kart').split(' '));
function fcRankWord_(word){return word.length>4?word.replace(/s$/,''):word;}
function fcRankTerms_(value){return fcNorm_(value).split(' ').map(fcRankWord_).filter(w=>w.length>2&&!FC_STOP_WORDS.has(w));}
function fcBuildSemantic_(model){
 const entries=[],df=new Map();
 for(const row of model.byId.values()){
  const descriptive=new Set(fcRankTerms_(row.description||''));
  const words=new Set([...descriptive,...fcRankTerms_(row.terms.join(' '))]);
  for(const word of words)df.set(word,(df.get(word)||0)+1);
  entries.push({row,descriptive});
 }
 const idf=new Map([...df].map(([word,count])=>[word,1+Math.log((1+entries.length)/(1+count))]));
 const minimumIdf=Math.min(4.8,1+Math.log((1+entries.length)/2));
 const literal=new Map(),semantic=new Map();
 const add=(index,key,value)=>{if(!index.has(key))index.set(key,[]);index.get(key).push(value);};
 for(const {row,descriptive} of entries){
  for(const phrase of row.terms){
   const words=phrase.split(' '),ranked=fcRankTerms_(phrase);
   const mean=ranked.length?ranked.reduce((sum,w)=>sum+(idf.get(w)||1),0)/ranked.length:1;
   add(literal,words[0],{row,phrase,weight:mean*(1+Math.log(1+words.length))});
  }
  const norm=[...descriptive].reduce((sum,w)=>sum+(idf.get(w)||1)**2,0);
  for(const word of descriptive)if((idf.get(word)||0)>=minimumIdf)add(semantic,word,{row,norm,weight:idf.get(word)**2});
 }
 return {literal,semantic};
}
function fcEligible_(text,row){return (!row.context.length||row.context.some(t=>fcHas_(text,t)))&&!row.exclude.some(t=>fcHas_(text,t));}
function fcSemanticMatches_(text,model){
 const words=[...new Set(text.split(' '))],byPhrase=new Map(),scores=new Map(),evidence=new Map();
 for(const word of words)for(const entry of model.semantic.literal.get(word)||[]){
  if(!fcHas_(text,entry.phrase)||!fcEligible_(text,entry.row))continue;
  if(!byPhrase.has(entry.phrase))byPhrase.set(entry.phrase,new Set());
  byPhrase.get(entry.phrase).add(entry.row.id);
  scores.set(entry.row.id,(scores.get(entry.row.id)||0)+entry.weight);
  if(!evidence.has(entry.row.id))evidence.set(entry.row.id,[]);
  evidence.get(entry.row.id).push(entry.phrase);
 }
 const matches=new Set(),ambiguousBlocks=new Set();
 // Resolve competition per phrase, not across independent phrases.
 for(const ids of byPhrase.values()){
  const ranked=[...ids].sort((a,b)=>scores.get(b)-scores.get(a)||a.localeCompare(b));
  if(ranked.length===1){matches.add(ranked[0]);continue;}
  const top=scores.get(ranked[0]);
  if(scores.get(ranked[1])<top*.85){matches.add(ranked[0]);continue;}
  if(ranked.every(id=>id.slice(0,2)===ranked[0].slice(0,2)))ambiguousBlocks.add(ranked[0].slice(0,2));
 }
 // Secondary descriptive matches require independent evidence and a conservative threshold.
 const semanticScores=new Map();
 for(const word of new Set(fcRankTerms_(text)))for(const entry of model.semantic.semantic.get(word)||[]){
  if(!semanticScores.has(entry.row.id))semanticScores.set(entry.row.id,{row:entry.row,norm:entry.norm,terms:new Set(),coverage:0,rank:0});
  const score=semanticScores.get(entry.row.id);if(score.terms.has(word))continue;
  score.terms.add(word);score.coverage+=entry.weight;score.rank+=entry.weight;
 }
 const ranked=[...semanticScores.values()].filter(s=>s.terms.size>=3&&s.norm>0&&s.coverage/s.norm>=.25&&fcEligible_(text,s.row))
  .map(s=>({id:s.row.id,score:s.rank/Math.sqrt(s.norm),terms:s.terms}))
  .sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
 for(const candidate of ranked){
  if(matches.has(candidate.id))continue;
  // Do not promote weak overlaps or description-only generic matches.
  if(ranked.some(other=>other.id!==candidate.id&&other.score>=candidate.score*.85&&other.score<=candidate.score/0.85&&other.id.slice(0,2)===candidate.id.slice(0,2)))continue;
  matches.add(candidate.id);evidence.set(candidate.id,['description']);
 }
 // Explicit contextual evidence complements (never replaces) catalogue rules.
 const contextual=fcContextualEvidence_(text,model);
 for(const [id,why] of contextual){
  if(id.endsWith('.xx')||model.byId.has(id)){
   matches.add(id);evidence.set(id,why);
  }
 }
 const blocks=new Set([...matches].map(id=>id.slice(0,2)));
 for(const block of ambiguousBlocks)if(!blocks.has(block))matches.add(block+'.xx');
 for(const [block,row] of model.blocks){
  if(blocks.has(block)||matches.has(block+'.xx')||row.exclude.some(t=>fcHas_(text,t)))continue;
  if(row.terms.some(t=>fcHas_(text,t)))matches.add(block+'.xx');
 }
 return {ids:[...matches].filter(id=>!id.endsWith('.xx')||![...matches].some(other=>other.startsWith(id.slice(0,2)+'.')&&!other.endsWith('.xx'))).sort(),evidence};
}
