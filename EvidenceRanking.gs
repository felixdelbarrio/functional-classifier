/** Bounded headline evidence, migrated from News Radar taxonomy policy 3.38.0. */
const FC_EVIDENCE_POLICY=Object.freeze({version:'3.39.0',maxAssignments:3});
const fcEvidenceRankingIndexes_=new WeakMap();
function fcEvidenceTaxonomyText_(value){return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ı/g,'i').replace(/ß/g,'ss');}
function fcEvidenceFinancingPurpose_(value){
 const text=fcEvidenceTaxonomyText_(value),match=text.match(/\b(?:fraccionar|fraccionado|aplazar|aplazado|financiar|financiado)\s+(?:el\s+|un\s+|los\s+)?(?:pago|compra|deuda)s?\b|\b(?:aplazamiento|financiacion|fraccionamiento)\s+de\s+(?:pago|compra|deuda)s?\b|\b(?:pago|compra|deuda)s?\s+(?:fraccionad[oa]s?|aplazad[oa]s?|a plazos|en cuotas)\b|\b(?:payment|purchase|debt)\s+(?:instalments?|installments?|deferral|deferred)\b|\binstal?lments? payments? plans?\b|\bdeferred payments?\b|\bbnpl\b|\bbuy now pay later\b/);
 if(!match||/\b(?:no|sin|not|without)\s+(?:(?:se|permite|ofrece|allow|offer)\s+)?(?:fraccionar|aplazar|financiar|defer|deferred|instalments?|installments?|bnpl)\b/.test(text))return null;
 return {evidence:match[0],confirming:/\bconfirming\b/.test(text)&&/\b(?:comprador|buyer|facturas?|invoices?)\b/.test(text)};
}
// Instrument, interface and audience are distinct from generic words such as
// payment, API or AI. Shared by admission, ranking and the conservative fallback.
function fcEvidenceFunctionalContext_(value){
 const text=fcEvidenceTaxonomyText_(value),positive=text.replace(/\b(?:sin|without|no)\s+(?:any\s+)?(?:bank\s+)?(?:transferencias?|transfers?)(?:\s+entre cuentas)?\b/g,' ');
 const card=/\b(?:tarjetas?|cards?)\b/.test(text),transfer=/\b(?:transferencias?|transferir|traspasos?|traspasar|bank transfers?|wire transfers?|sepa transfer|spei|spid|swift transfers?)\b/.test(positive),acquiring=/\b(?:softpos|tpv|acquiring|adquirencia|card acceptance|aceptar pagos con tarjetas?|accept(?:ing)? card payments?|merchant services|payment terminals?|tap to (?:pay|phone))\b/.test(text)||card&&/\b(?:flat transaction rate|merchant fees|tasa de descuento|comisiones de aceptacion)\b/.test(text);
 const api=/\b(?:apis?|mcp|model context protocol|open banking|open finance)\b/.test(text);
 const bankingApi=api&&/\b(?:banking apis?|apis? bancarias?|corporate transaction banking|treasury|tesoreria|payments?|pagos?|account balances?|corporate accounts?|business accounts?|cuentas (?:bancarias|empresariales)|conto business|bank guarantee|trade finance|banking data|datos bancarios|conciliacion bancaria|bank reconciliation|concili[a-z]* (?:sus |las |de )?facturas?|reconcil[a-z]* (?:their )?invoices?|stock de pymes)\b/.test(text);
 const agent=/\b(?:agentic|ai[ -]agents?|agentes? de (?:ia|inteligencia artificial)|(?:banking|digital|virtual) assistants?|asistentes? (?:bancarios?|digitales?|virtuales?))\b/.test(text);
 const staffAgent=agent&&/\b(?:corporate bankers?|relationship managers?|credit risk managers?|gestores?|analistas?|empleados?|bank staff)\b/.test(text)&&/\b(?:credit (?:memos?|assessments?|analysis)|expedientes? de credito|analisis (?:de credito|crediticio)|evaluacion crediticia)\b/.test(text);
 const agentBanking=agent&&(/\b(?:account balances?|transaction history|banking tasks?|saldos? de cuentas?|historial de (?:operaciones|transacciones)|banking assistants?|asistentes? bancarios?)\b/.test(text)||staffAgent);
 return {card,transfer,acquiring,api,bankingApi,agent,staffAgent,agentBanking,financing:fcEvidenceFinancingPurpose_(text)};
}
const fcEvidenceWords_=value=>fcEvidenceTaxonomyText_(value).match(/[\p{L}][\p{L}\p{M}\p{N}]+/gu)||[];
function fcEvidenceTaxonomyTermCounts_(text,terms){
 const counts=new Map();
 for(const term of terms){if(!term)continue;let at=-1,count=0;while((at=text.indexOf(term,at+1))>=0)if((at===0||!/[a-z0-9]/.test(text[at-1]))&&(at+term.length===text.length||!/[a-z0-9]/.test(text[at+term.length])))count++;if(count)counts.set(term,count);}
 return counts;
}
// Compile once per catalogue, then rank bounded phrases by specificity and headline evidence.
const fcEvidenceRankingWord_=word=>word.length>4?word.replace(/s$/,''):word;
const fcEvidenceRankingStopWords_=new Set(fcEvidenceWords_('landing de del la el y para con que en un una los las por se su sus al es esta este como donde todos todas cliente clientes permite permitir funcionalidad funcionalidades operativa canal producto productos información desde hasta sobre entre también actualmente través mediante disponer tener haber ser estar poder así más banco banca bancario empresarial empresa negocio pymes digital solución nuevo nueva sistema plataforma servicio gestión operar realizar uso proceso acceso mejora ofrecer incluir disponible usuario titular pago cobro cuenta crédito financiación tarjeta transferencia operación dato forma opción utilizar solicitud consulta reporte seguimiento the and of for to in on with that this from into a an is are can be will has have their it by as at or our your all more new business businesses enterprise corporate bank banking customer client company companies service product solution platform system digital web online mobile app application internet movil telefono phone linea payment pay money finance financial credit account card operation data use offer enable provide process ve bir bu için ile banka bankacilik şirket işletme hizmet yeni ürün ödeme sistem plataforma servicio pagamento servico empresa novo nuova sistema piattaforma').map(fcEvidenceRankingWord_));
function fcEvidenceRankingIndex_(definitions){
 let index=fcEvidenceRankingIndexes_.get(definitions);if(index)return index;
 const frequencies=new Map(),phrases=new Map(),canonical=new Map(),labels=new Map(),contexts=new Map(),rows=definitions.filter(row=>row.subpalanca);const contextWords=value=>fcEvidenceWords_(value).map(fcEvidenceRankingWord_).filter(word=>!fcEvidenceRankingStopWords_.has(word)&&word.length>2);
 for(const row of rows){
  const tokens=new Set();for(const term of row.terms){if(!phrases.has(term))phrases.set(term,fcEvidenceWords_(term).map(fcEvidenceRankingWord_));for(const word of phrases.get(term))tokens.add(word);}
  for(const word of contextWords(row.description))tokens.add(word);contexts.set(row,new Set(contextWords(row.description)));
  for(const word of tokens)frequencies.set(word,(frequencies.get(word)||0)+1);
  labels.set(row,fcEvidenceTaxonomyText_(row.subpalanca.replace(/^\d{2}\.(?:\d{2}|xx)[. ]*/,'')));canonical.set(row,new Set(fcEvidenceWords_(row.subpalanca).map(fcEvidenceRankingWord_).filter(word=>!fcEvidenceRankingStopWords_.has(word))));
 }
 const weights=new Map([...phrases].map(([term,tokens])=>[term,tokens.reduce((sum,word)=>sum+1+Math.log((1+rows.length)/(1+(frequencies.get(word)||0))),0)/Math.max(1,tokens.length)*(1+Math.log(1+tokens.length))]));
 const idf=new Map([...frequencies].map(([word,count])=>[word,1+Math.log((1+rows.length)/(1+count))]));
 const norms=new Map([...contexts].map(([row,tokens])=>[row,[...tokens].reduce((sum,word)=>sum+(idf.get(word)||0)**2,0)]));const minimumIdf=Math.min(4.8,1+Math.log((1+rows.length)/2));for(const [row,tokens] of contexts)contexts.set(row,[...tokens].filter(word=>(idf.get(word)||0)>=minimumIdf));
 index={weights,phrases,canonical,labels,contexts,norms,idf,blocks:new Map(definitions.filter(row=>!row.subpalanca).map(row=>[row.palanca,row]))};fcEvidenceRankingIndexes_.set(definitions,index);return index;
}
// Prefer a demonstrated customer capability over its enabling instrument.
function fcEvidenceFunctionalPrimary_(value){
 const title=fcEvidenceTaxonomyText_(value),rules=[
  ['11.',/\b(?:checkout|card acceptance|merchant acquiring|aceptacion (?:comercial|de (?:pagos|tarjetas))|adquirencia|softpos|tap to pay)\b/],
  ['11.',/\bgetnet\b.{0,100}\b(?:pagos|cobros|payments?|comercios)\b/],
  ['09.',/\b(?:virtual cards?|tarjetas? virtuales?)\b/],
  ['03.',/\b(?:pagos?|pagar|payments?|transferencias?|transferir|transfers?)\b.{0,80}\bbre-b\b/],
  ['03.',/\bbre-b\b.{0,80}\b(?:pagos?|pagar|payments?|transferencias?|transferir|transfers?)\b/],
  ['03.',/\btokeni[sz](?:ed|ados?|adas?) deposits?\b.{0,80}\b(?:payments?|transfers?|settle)\b/],
  ['03.',/\b(?:payments?|transfers?|settle)\b.{0,80}\btokeni[sz](?:ed|ados?|adas?) deposits?\b/]
 ];
 const financing=fcEvidenceFinancingPurpose_(title);if(financing)return {prefix:'08.',terms:[financing.evidence]};
 for(const [prefix,pattern] of rules){const match=title.match(pattern);if(match)return {prefix,terms:[match[0]]};}
 if(/\b(?:revamps?|revamped|upgraded|all-new|renueva|renovacion|transforma|transforms)\b/.test(title)&&/\b(?:app|platform|plataforma|banca|digital business banking)\b/.test(title)&&/\b(?:business banking|corporate banking|empresas)\b/.test(title)&&!/\b(?:pagos|payments|cuentas|accounts|tarjetas|cards|adquirencia|tpvs?|loans|prestamos)\b/.test(title))return {prefix:'01.',terms:[title]};
 if(/\b(?:app|plataforma|platform)\b/.test(title)&&/\b(?:gestion integral|gestion global|integrated management)\b/.test(title)&&/\b(?:business|corporate|empresas)\b/.test(title))return {prefix:'01.',terms:[title]};
 return null;
}
function fcEvidenceTaxonomyDecision_(text,definitions,headline=''){
 const index=fcEvidenceRankingIndex_(definitions),title=fcEvidenceTaxonomyText_(headline),tokens=new Set(fcEvidenceWords_(text).map(fcEvidenceRankingWord_)),titleWords=new Set(fcEvidenceWords_(title).map(fcEvidenceRankingWord_)),functional=fcEvidenceFunctionalContext_(text);let best,second;const ranked=[];
 for(const row of definitions){
  if(!row.subpalanca||/\.xx Otros$/.test(row.subpalanca))continue;
  if(row.context?.length&&!fcEvidenceTaxonomyTermCounts_(text,row.context).size||row.exclude?.length&&fcEvidenceTaxonomyTermCounts_(text,row.exclude).size)continue;
  if(/(?:^|\.)landing\b/i.test(row.subpalanca)&&!/(?:landing|dashboard|visi[oó]n integral|vista (?:global|agregada)|posici[oó]n (?:global|integrada)|aggregate|aggregated|overview|bütünleşik|genel bakış)/i.test(text))continue;
  const terms=row.terms.filter(term=>(row.context?.length||index.phrases.get(term)?.some(word=>!fcEvidenceRankingStopWords_.has(word))||term===index.labels.get(row)&&index.phrases.get(term).length>1)&&!(row.subpalanca.startsWith('03.13.')&&functional.card&&!functional.transfer&&!/transfer|remittance/.test(term))),counts=fcEvidenceTaxonomyTermCounts_(text,terms),context=index.contexts.get(row),shared=context.filter(word=>tokens.has(word));
  let semantic=0;if(shared.length>=3&&(!title||shared.some(word=>titleWords.has(word)))){const matched=shared.reduce((sum,word)=>sum+index.idf.get(word)**2,0),norm=index.norms.get(row);semantic=Math.sqrt(matched/Math.max(1,norm));}
  if(!counts.size&&semantic<.5)continue;
  const titleCounts=title?fcEvidenceTaxonomyTermCounts_(title,[...counts.keys()]):new Map();
  let score=semantic*8,count=counts.size?0:shared.length;
  for(const [term,frequency]of counts){
   const nameEvidence=index.phrases.get(term)?.some(word=>index.canonical.get(row).has(word))?1.5:1,headlineEvidence=titleCounts.has(term)?4*(1+1/(1+title.indexOf(term)/80)):1;
   score+=(index.weights.get(term)||1)*(1+Math.log(frequency))*nameEvidence*headlineEvidence;count+=frequency;
  }
  const block=index.blocks.get(row.palanca);if(block&&fcEvidenceTaxonomyTermCounts_(text,block.terms).size)score*=1.25;
  const evidence={terms:[...(titleCounts.size?titleCounts.keys():counts.size?counts.keys():shared.map(stem=>fcEvidenceWords_(text).find(word=>fcEvidenceRankingWord_(word)===stem)))].slice(0,3),location:titleCounts.size?'headline':'text',method:counts.size?'literal':'description'},candidate={row,count,score,evidence};
  ranked.push(candidate);
  if(!best||score>best.score||score===best.score&&row.subpalanca.localeCompare(best.row.subpalanca,'es')<0){second=best;best=candidate;}else if(!second||score>second.score)second=candidate;
 }
 const distinct=second&&best.row.subpalanca.replace(/^\d{2}\.(?:\d{2}|xx)[. ]*/, '')!==second.row.subpalanca.replace(/^\d{2}\.(?:\d{2}|xx)[. ]*/, '');
 const ambiguous=best?.evidence.method==='description'&&distinct&&second.score>=best.score*.85;
 const matches=best&&!ambiguous?[best]:[];
 if(matches.length){
  const used=new Set(best.evidence.terms),ordered=ranked.filter(row=>row!==best).sort((a,b)=>b.score-a.score||a.row.subpalanca.localeCompare(b.row.subpalanca,'es'));
  for(const candidate of ordered){
   if(matches.length>=FC_EVIDENCE_POLICY.maxAssignments)break;
   const independent=candidate.score>=best.score*.35&&fcEvidenceTaxonomyIndependentEvidence_(candidate.evidence,[...used]);
   if(!independent)continue;
   matches.push(candidate);for(const term of candidate.evidence.terms)used.add(term);
  }
 }
 // A block fallback requires a discriminating phrase, never a generic banking word.
 const used=new Set(matches.flatMap(match=>match.evidence.terms));
 for(const block of index.blocks.values()){
  if(functional.staffAgent&&block.palanca.startsWith('17.')||block.palanca.startsWith('09.')&&(functional.transfer||functional.acquiring))continue;
  if(matches.some(match=>match.row.palanca===block.palanca)||matches.length>=FC_EVIDENCE_POLICY.maxAssignments)continue;
  const concepts=(block.emerging||[]).filter(concept=>!(functional.staffAgent&&block.palanca.startsWith('17.')&&concept.name==='Agentes de IA')&&(!concept.context?.length||fcEvidenceTaxonomyTermCounts_(text,concept.context.map(fcEvidenceTaxonomyText_)).size)&&!fcEvidenceTaxonomyTermCounts_(text,(concept.exclude||[]).map(fcEvidenceTaxonomyText_)).size);
  const terms=[...fcEvidenceTaxonomyTermCounts_(text,[...block.terms,...concepts.flatMap(concept=>concept.terms.map(fcEvidenceTaxonomyText_))]).keys()].filter(term=>fcEvidenceWords_(term).some(word=>!fcEvidenceRankingStopWords_.has(fcEvidenceRankingWord_(word))));
  const evidence={terms:terms.slice(0,3),method:'literal',location:terms.some(term=>title.includes(term))?'headline':'text'};
  if(!terms.length||matches.length&&!fcEvidenceTaxonomyIndependentEvidence_(evidence,[...used]))continue;
  const row=definitions.find(row=>row.palanca===block.palanca&&/\.xx Otros$/.test(row.subpalanca));
  if(row){matches.push({row,count:terms.length,score:0,evidence});for(const term of evidence.terms)used.add(term);}
 }
 const financing=fcEvidenceFinancingPurpose_(text),focus=financing?{prefix:'08.',terms:[financing.evidence]}:fcEvidenceFunctionalPrimary_(headline);
 if(focus){
  const primary=financing?(financing.confirming?matches.find(match=>match.row.subpalanca.startsWith('08.37.')):null):matches.find(match=>match.row.palanca.startsWith(focus.prefix)),row=primary?.row||financing?.confirming&&definitions.find(row=>row.subpalanca.startsWith('08.37.'))||definitions.find(row=>row.palanca.startsWith(focus.prefix)&&/\.xx Otros$/.test(row.subpalanca));
  if(row){const selected=primary||{row,count:1,score:0,evidence:{terms:focus.terms,method:'literal',location:'headline'}};const secondary=[],used=[...selected.evidence.terms];for(const match of matches)if(match!==primary&&(!financing||!/^(03|09)\./.test(match.row.palanca)||/transferencia|transfer\b/.test(match.evidence.terms.join(' ')))&&fcEvidenceTaxonomyIndependentEvidence_(match.evidence,used)){secondary.push(match);used.push(...match.evidence.terms);}matches.splice(0,matches.length,selected,...secondary.slice(0,FC_EVIDENCE_POLICY.maxAssignments-1));}
 }
 return {matches,reason:matches.length?'matched':ambiguous?'ambiguous':'insufficient'};
}
const fcEvidenceEvidenceWord_=word=>word.length>5?fcEvidenceRankingWord_(word).replace(/[oa]$/,''):fcEvidenceRankingWord_(word);
function fcEvidenceTaxonomyIndependentEvidence_(evidence,used){
 return evidence.method==='literal'&&evidence.terms.some(term=>fcEvidenceWords_(term).length>=2&&fcEvidenceWords_(term).some(word=>!fcEvidenceRankingStopWords_.has(fcEvidenceRankingWord_(word)))&&!used.some(previous=>fcEvidenceWords_(previous).some(word=>!fcEvidenceRankingStopWords_.has(fcEvidenceRankingWord_(word))&&fcEvidenceWords_(term).map(fcEvidenceEvidenceWord_).includes(fcEvidenceEvidenceWord_(word)))));
}
