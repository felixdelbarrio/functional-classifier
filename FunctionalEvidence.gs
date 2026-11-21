/** Narrow, contextual functional evidence. Not an audience or news filter. */
function fcContextualEvidence_(text, model) {
 const out=new Map();
 const has=p=>fcHas_(text,p);
 const any=arr=>arr.some(has);
 const add=(id,why)=>{if(!out.has(id))out.set(id,[]);out.get(id).push(why);};
 // Loan repayments are financing, not ordinary payments.
 const loan=any(['prestamo','prestamos','loan','loans','kredi','kredisi','kredi taksiti','kredi borcu']);
 const repay=any(['cuota','cuotas','abonar','adelantar','amortizar','pagar','repay','installment','installments','early repayment','taksit','taksitleri','odeme','odemek','oduyorum','odeyemiyorum','odenmiyor','erken odeme']);
 if(loan&&repay && !(any(['kredi karti','kredi kartim','kredi kartimin','kredi kartinin','credit card','tarjeta de credito']) && !any(['prestamo','prestamos','loan','loans','kredi taksiti','kredi borcu'])))add('08.xx','loan-repayment');
 // Transfers must be explicitly mentioned. Do not infer from generic payment or token failure.
 if(any(['transferencia','transferencias','transferir','transferis','transferencia bancaria','bank transfer','bank transfers','transfer money','wire transfer','havale','havalesi','havalesini','havale yapamiyorum','havale yapamıyorum','eft','eft yapamiyorum','para transferi','para transferini']) && !(any(['destinatarios','emisores','recipients','senders']) && any(['movimientos de cuenta','account movements'])) && !any(['palabra transferencia','word transfer appears','kelime havale']))add('03.xx','explicit-transfer');
 if(any(['movimientos','account movements','transactions','hesap hareketleri']) && any(['ver','consultar','consulta','view','see','goremiyorum','goster']))add('02.02','account-movement-consultation');
 const card=any(['tarjeta de credito','tarjetas de credito','credit card','credit cards','kredi karti','kredi kartim','kredi kartimin','kredi kartinin','kredi karti borcu']) || any(['pagar las tarjetas','pay my cards','pay the cards']);
 if(card){
  if(any(['pagar','pago','abonar','saldo','pay off','pay credit card','card payment','odeyemiyorum','odemek','kart borcu','kart borcunu','kart borcumu','borc odeme','borcunu ode','borcumu ode','borcunu odeyemiyorum','borcunu odemek','borc odemesi']))add('09.09','credit-card-repayment');
  if(any(['consulta','consultar','movimientos','compra','compras','aparece','ver','statement','transactions','purchases','view','hareket','hareketleri','islem','islemleri']))add('09.04','credit-card-consultation');
 }
 if(any(['fatura','faturalar','faturayi','faturalarimi']) && any(['odenmiyor','odeyemiyorum','odeme','odemek','oduyorum','fatura odeme']))add('06.xx','bill-payment-tr');
 return out;
}
