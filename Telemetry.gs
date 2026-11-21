function fcRecordExecution_(event){
 try{const sh=fcSheet_('FC_EXECUTIONS',['jobId','caller','startedAt','endedAt','total','processed','failed','durationMs','revision','status']);sh.appendRow([event.jobId,event.caller,new Date(event.started).toISOString(),new Date().toISOString(),event.total,event.processed,event.failed,Date.now()-event.started,event.revision,event.failed?'WARNING':'OK']);}
 catch(e){console.error('FC_TELEMETRY '+e.message);}
}
/** Consumers call this between chunks; progress cannot be streamed from synchronous library calls. */
function reportJobProgress(job){
 if(!job||!job.jobId||!job.caller)throw Error('jobId y caller obligatorios');
 const processed=Number(job.processed),total=Number(job.total);
 if(!Number.isSafeInteger(processed)||!Number.isSafeInteger(total)||processed<0||total<0||processed>total)throw Error('Progreso inválido');
 const status=String(job.status||'RUNNING');
 if(!['PENDING','RUNNING','PAUSED','COMPLETED','FAILED','CANCELLED'].includes(status))throw Error('Estado inválido');
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  const sh=fcSheet_('FC_JOBS',['jobId','caller','status','processed','total','updatedAt','detail']);
  const values=sh.getDataRange().getValues();
  const index=values.findIndex((r,i)=>i>0&&r[0]===String(job.jobId)&&r[1]===String(job.caller));
  const row=index<0?sh.getLastRow()+1:index+1;
  if(index>=0&&processed<Number(values[index][3])&&status!=='PENDING')throw Error('Progreso no monotónico');
  sh.getRange(row,1,1,7).setValues([[String(job.jobId).slice(0,100),String(job.caller).slice(0,80),status,processed,total,new Date().toISOString(),String(job.detail||'').slice(0,200)]]);
  return {ok:true};
 }finally{lock.releaseLock();}
}
function getClassifierStatus(){const p=PropertiesService.getScriptProperties(),sh=fcSheet_('FC_JOBS',['jobId','caller','status','processed','total','updatedAt','detail']);const rows=sh.getDataRange().getValues().slice(1).slice(-100).map(r=>({jobId:r[0],caller:r[1],status:r[2],processed:r[3],total:r[4],updatedAt:r[5],detail:r[6]}));const executions=fcSheet_('FC_EXECUTIONS',['jobId','caller','startedAt','endedAt','total','processed','failed','durationMs','revision','status']).getDataRange().getValues().slice(1).slice(-30);return {revision:p.getProperty('FC_ACTIVE_REV'),version:FC_VERSION,jobs:rows,executions:executions.map(r=>({jobId:r[0],caller:r[1],endedAt:r[3],total:r[4],failed:r[6],durationMs:r[7],status:r[9]}))};}
function doGet(){fcAdminGuard_();return HtmlService.createHtmlOutputFromFile('Dashboard').setTitle('Functional Classifier | Control');}
function fcAdminGuard_(){const admins=(PropertiesService.getScriptProperties().getProperty('FC_ADMIN_EMAILS')||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);const email=Session.getActiveUser().getEmail().toLowerCase();if(!email||!admins.includes(email))throw Error('Acceso denegado: administrador no autorizado');return true;}
function fcAdminStatus(){fcAdminGuard_();return getClassifierStatus();}
