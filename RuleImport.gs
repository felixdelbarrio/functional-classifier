/** One-time import of reviewed rule JSON from SeedRules.json.
 * Paste the contents into the Apps Script editor via the administrator's
 * approved configuration process. Do not silently overwrite live rules.
 * The imported rule arrays have the shape [terms, required, excluded].
 */
function fcImportRuleSeed(jsonText) {
  fcAdminGuard_();
  const seed=JSON.parse(jsonText), out={};
  for(const [id, value] of Object.entries(seed)) {
    if(!/^\d{2}\.\d{2}$/.test(id)||!Array.isArray(value)||value.length!==3||value.some(a=>!Array.isArray(a)||a.some(x=>typeof x!=='string')))throw Error('Semilla inválida '+id);
    out[id]={terms:value[0],context:value[1],exclude:value[2]};
  }
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const sh=fcSheet_('FC_RULES',['id','terms','context','exclude']);
    const rows=Object.entries(out).sort(([a],[b])=>a.localeCompare(b)).map(([id,r])=>[id,JSON.stringify(r.terms),JSON.stringify(r.context),JSON.stringify(r.exclude)]);
    const old=sh.getLastRow();
    // Clear converted date cells before applying plain-text format.
    // Formatting an existing date does not restore the original rule ID.
    if(old>1)sh.getRange(2,1,old-1,4).clearContent();
    const idColumn=sh.getRange(2,1,Math.max(rows.length,old-1,1),1);
    idColumn.setNumberFormat('@');
    if(rows.length){
      sh.getRange(2,1,rows.length,4).setValues(rows);
      SpreadsheetApp.flush();
      const saved=sh.getRange(2,1,rows.length,1).getDisplayValues().map(r=>r[0]);
      const invalid=saved.findIndex((id,i)=>id!==rows[i][0]);
      if(invalid>=0)throw Error('FC_RULES.id no preservado como texto en fila '+(invalid+2));
    }
    return {count:rows.length,revision:fcHash_(JSON.stringify(out))};
  } finally {lock.releaseLock();}
}
