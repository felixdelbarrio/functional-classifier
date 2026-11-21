# Functional Classifier — versión 5.8.5

## Alcance
Biblioteca Google Apps Script independiente para categorizar textos en cero, una o varias funcionalidades del catálogo global. `NN.xx` se asigna únicamente cuando hay evidencia del bloque sin suboperativa específica. El motor **no** filtra audiencia BEI, elegibilidad de noticias ni geografía. Si no encuentra evidencia, devuelve `assignments: []` y `matched: false`. **Market Pulse debe convertir ese resultado en `Generalista` en su adaptador, no dentro de la biblioteca.**

## Código incluido
Los archivos `.gs`, `Dashboard.html`, `appsscript.json` y `SeedRules.gs (objeto JavaScript; no copiar JSON como archivo .gs)` son los únicos artefactos de aplicación; no se incluyen informes ni código histórico de iteraciones. `SeedRules.gs (objeto JavaScript; no copiar JSON como archivo .gs)` es una semilla que requiere importación administrativa y revisión: no sustituye el catálogo maestro.

## Instalación
1. Crear un proyecto Apps Script independiente y copiar los archivos `.gs`, HTML y manifiesto. **No crear un archivo `SeedRules.gs` pegando JSON sin envolver**; usar el `SeedRules.gs` suministrado.
2. Configurar `FC_CATALOG_ID` (Google Sheet maestro), `FC_CATALOG_SHEET=CatalogoFuncional`, `FC_STORE_ID` (Google Sheet de control independiente, distinto del maestro) y `FC_ADMIN_EMAILS` (administradores). La pestaña oficial contiene `id`, `bloque`, `nombre`, `descripcion`. El catálogo maestro se lee, nunca se modifica.
3. Revisar `SeedRules.gs (objeto JavaScript; no copiar JSON como archivo .gs)` y cargarlo una sola vez mediante `fcImportBundledRuleSeed()` (o `fcImportRuleSeed(jsonText)` si se importa manualmente) con una sesión administradora autorizada. No se importa automáticamente ni se sobrescriben reglas de producción sin aprobación.
4. Ejecutar `syncCatalog()`, `updatePendingTranslations(100)` repetidamente hasta completar, `fcPreflight()` e `installCatalogWatcher()`; comprobar manualmente traducciones bancarias críticas ES/EN/TR.
5. Publicar una versión de biblioteca y fijar esa versión en cada consumidor. Los cambios del algoritmo requieren actualizar la dependencia en los consumidores.

## API
- `classifyText(text)` devuelve `{id, assignments, matched, evidence, revision, algorithmVersion}`.
- `getClassifierRevisions()` obtiene las cuatro revisiones para fijar un job.
- `classifyBatch(records, {caller, jobId, requirePinnedRevisions:true, failOnRecordError:true, ...getClassifierRevisions()})` clasifica hasta 3000 registros por llamada; **el supervisor debe ajustar el tamaño a sus cuotas y tiempo disponible**.
- `reportJobProgress({caller,jobId,status,processed,total})` informa del avance entre lotes; el panel no puede observar internamente ejecuciones remotas sin este aviso.
- `fcAdminStatus()` requiere acceso administrativo; `doGet()` sirve el panel HTML.

## Integración en consumidores
- News Radar: conservar sus filtros de elegibilidad, supervisor, checkpoints, snapshots y persistencia. Solo sustituir la asignación funcional tras validar el mapeo de identificadores; `assignments:[]` significa sin categoría.
- Market Pulse: conservar audiencia BEI, supervisor, índice y persistencia. Mapear `assignments:[]` a la categoría **Generalista** en el adaptador de Market Pulse. No crear `Generalista` en el catálogo global ni forzar `NN.xx` sin evidencia.
- En ambos: fijar revisiones al iniciar job, no confirmar checkpoint si hay errores y registrar progreso después de persistir el lote. No sustituir automáticamente clasificadores anteriores sin comparación en modo sombra.

## Verificación y límites
El ZIP está **limpio y listo para instalar en un entorno Apps Script de validación**, pero **NO está certificado como reemplazo en producción**: no incluye adaptadores implementados en los repositorios de News Radar y Market Pulse, ni pruebas de ejecución reales bajo sus permisos, ni precisión ES/EN/TR adjudicada independientemente. `fcPreflight()` y los tests locales son necesarios, pero no suficientes para autorizar el cambio. La semilla de reglas y el motor contextual proceden de iteraciones anteriores, con limitaciones de generalización conocidas.

## Seguridad y operación
Restringir acceso al Sheet de control y al panel, no incluir textos completos de usuarios en telemetría, controlar retención de `FC_EXECUTIONS`/`FC_JOBS` y revisar cuotas de Apps Script. La traducción automática debe validarse para vocabulario bancario.


### Corrección 5.8.3
`SeedRules.gs` contiene un objeto JavaScript literal (125 reglas), evitando errores de comillas y caracteres especiales al guardar en Apps Script. Ejecutar `fcImportBundledRuleSeed()` una vez tras configurar el proyecto. No crear un archivo `SeedRules.json` dentro del editor Apps Script.

### Corrección 5.8.4
`Catalog.gs` lee exclusivamente la pestaña configurada por `FC_CATALOG_SHEET` (por defecto `CatalogoFuncional`), interpreta los encabezados reales `id`, `bloque`, `nombre`, `descripcion`, valida ID y bloque, y conserva la generación de snapshots y la cola de traducciones. Verificado localmente con las 324 filas de datos de la descarga de producción del 21/11/2026; la ejecución remota Apps Script no está verificada. No modificar el Sheet maestro para acomodar el lector.


## Correccion 5.8.7: IDs de reglas como texto

Actualizar RuleImport.gs y Classifier.gs. Ejecutar fcImportBundledRuleSeed() como administrador una vez para restaurar los 125 IDs originales. La importacion reemplaza reglas actuales; respaldar cambios manuales previos. No modificar el catalogo maestro. Verificar FC_RULES.id en Google Sheets.

## Inicializacion automatica

En un proyecto Apps Script nuevo, copia todos los archivos `.gs` y `Dashboard.html`,
configura los permisos solicitados y ejecuta **`fcSetup()`** desde el editor.
Esta funcion configura solo las propiedades ausentes, comprueba permisos administrativos,
sincroniza el catalogo maestro, importa las reglas si faltan o sus identificadores no
coinciden, procesa un lote acotado de traducciones e instala un unico trigger horario
`fcScheduledMaintenance` para continuar las traducciones y detectar cambios.

Valores iniciales en `Config.gs`: catalogo maestro BBVA Empresas, pestana
`Soluciones Funcionales`, hoja operativa EDC-CatalogClassifier-Data y administrador
corporativo autorizado. Ajustar `FC_SETUP_DEFAULTS_` antes del primer uso en otro entorno.
La inicializacion **no modifica el catalogo maestro**. No sobrescribe propiedades
existentes diferentes ni reglas con IDs correctos; no garantiza equivalencia funcional
con otros proyectos. Ejecuta `fcSetupStatus()` para consultar el avance.

Nota: `fcSetup()` requiere ejecutar como administrador autorizado; no debe exponerse
como API de clasificacion a consumidores externos.

## Adjudicaciones explícitas por registro (5.8.5)

`classifyBatch` y `classifyShadowBatch` admiten `reviewedAssignments`: una lista de `{recordId, contentHash, ids, reference}`. Es una decisión humana trazable, no una regla inferida del tema ni una excepción codificada por titular o ID en el motor. `contentHash` es SHA-256 hexadecimal del texto UTF-8 exacto enviado en `record.text`. El consumidor prepara esta lista desde una referencia aprobada; nunca se deduce de propuestas automáticas.

Fijar `expectedReviewRevision` al resultado de `getReviewedAssignmentsRevision(reviewedAssignments)` junto con las cuatro revisiones normales. El hash incluye ID, contenido, destinos y referencia; cambia al modificar cualquiera. Sin decisiones devuelve `null`. Mantener la lista y su revisión durante todos los lotes del job. Una revisión diferente, contenido modificado o destino ausente del catálogo aborta antes de registrar la ejecución.

Una adjudicación solo afecta al ID y texto exactos indicados. La evidencia usa `method: reviewed-assignment`, referencia y hash; no inventa coincidencias literales. Las categorías del catálogo conservan su ID; `NN.xx` exige que exista el bloque. La API sin adjudicaciones conserva el motor previo. No se cambia la relevancia BEI ni la elegibilidad del consumidor.

Validación local: `npm run check && npm test` (Node >=24, sin dependencias adicionales). El CI ejecuta ambos comandos. Estas pruebas no autorizan una migración histórica: se requieren corpus vivo congelado, regresión por bloque/idioma y publicación de una versión inmutable fijada en cada consumidor. Esta versión de código no implica un número de versión de biblioteca ya publicado.
