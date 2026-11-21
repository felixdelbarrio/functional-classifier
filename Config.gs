/**
 * EDC-CatalogClassifier: one-time, repeatable setup.
 * Run fcSetup() from the Apps Script editor as an authorized administrator.
 * Does not modify the official catalog spreadsheet.
 */
const FC_SETUP_DEFAULTS_ = Object.freeze({
  FC_CATALOG_ID: '1hsFp-ZiiSsSt_ka73oKAWFlHEySdmJM_IrkBmK6YfH8',
  FC_CATALOG_SHEET: 'Soluciones Funcionales',
  FC_STORE_ID: '13N7MpXz5g8JjO9gVaq-AQqt1hgHPY59qYSfvG1ensJ4',
  FC_ADMIN_EMAILS: 'felix.delbarrio@bbva.com'
});

function fcSetup() {
  const props = PropertiesService.getScriptProperties();
  const existing = props.getProperties();
  const added = [];
  for (const [key, value] of Object.entries(FC_SETUP_DEFAULTS_)) {
    if (!existing[key]) {
      props.setProperty(key, value);
      added.push(key);
    } else if (existing[key] !== value && key !== 'FC_ADMIN_EMAILS') {
      throw Error('Configuracion distinta en ' + key + '. Revisar antes de continuar; no se sobrescribe.');
    }
  }
  if (props.getProperty('FC_CATALOG_ID') === props.getProperty('FC_STORE_ID')) {
    throw Error('El catalogo maestro y el almacenamiento operativo deben ser diferentes');
  }
  // Fail closed: only an explicitly configured administrator can initialize rules.
  fcAdminGuard_();
  const catalog = syncCatalog();
  const rulesSheet = fcSheet_('FC_RULES', ['id','terms','context','exclude']);
  const stored = rulesSheet.getLastRow() > 1
    ? rulesSheet.getRange(2,1,rulesSheet.getLastRow()-1,1).getDisplayValues().map(r=>r[0])
    : [];
  const seedIds = Object.keys(FC_SEED_RULES).sort();
  const storedIds = stored.slice().sort();
  const needsImport = storedIds.length !== seedIds.length ||
    storedIds.some((id,i)=>id!==seedIds[i]);
  // Re-import only if missing or invalid; never overwrite valid custom rule sets.
  const rules = needsImport ? fcImportBundledRuleSeed() : {count:stored.length, skipped:true};
  // Run one bounded batch now; the hourly watcher drains the remainder.
  const translations = updatePendingTranslations(80);
  const watcher = installCatalogWatcher();
  const result = {configured:added, catalog, rules, translations, watcher,
    activeRevision:props.getProperty('FC_ACTIVE_REV')};
  console.log('FC_SETUP ' + JSON.stringify(result));
  return result;
}

/** Read-only health summary; does not translate, import rules, or change triggers. */
function fcSetupStatus() {
  const props = PropertiesService.getScriptProperties();
  const catalog = fcReadSnapshot_();
  const rules = fcSheet_('FC_RULES',['id','terms','context','exclude']);
  const translations = fcSheet_('FC_TRANSLATIONS',
    ['id','language','sourceHash','source','translation','status','updatedAt']);
  const statuses = translations.getLastRow()>1
    ? translations.getRange(2,6,translations.getLastRow()-1,1).getDisplayValues().map(r=>r[0]) : [];
  const counts = statuses.reduce((a,s)=>(a[s]=(a[s]||0)+1,a),{});
  const triggers = ScriptApp.getProjectTriggers()
    .filter(t=>t.getHandlerFunction()==='fcScheduledMaintenance').length;
  const result = {catalogItems:catalog.items.length, catalogRevision:catalog.revision,
    rules:Math.max(0,rules.getLastRow()-1), translations:counts,
    maintenanceTriggers:triggers,
    configured:Object.keys(FC_SETUP_DEFAULTS_).every(k=>Boolean(props.getProperty(k)))};
  console.log('FC_SETUP_STATUS '+JSON.stringify(result));
  return result;
}
