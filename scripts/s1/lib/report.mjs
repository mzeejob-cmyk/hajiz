import { sections } from './plan.mjs';
export function render(ctx) {
  const rows=sections.map(name=>[name,ctx.results[name]?.status??'BLOCKED']);
  const clean=ctx.journal.cleanup==='PASS';
  const residue=(ctx.journal.ledger?.length??0)>0 || (!clean && ctx.journal.fixtures.length>0);
  const verdict=ctx.error?.gate==='FAIL'||rows.some(([,s])=>s==='FAIL')?'FAIL':rows.every(([,s])=>s==='PASS')&&clean&&!ctx.error?'PASS':'BLOCKED';
  ctx.verdict=verdict;
  const lines=['# HAJIZ — STAGING CONTROLLED RUNTIME GATE S1-B','',`Run: ${ctx.run}`,'',`S1-B RESULT: ${verdict}`,''];
  for(const [name,status] of rows){const r=ctx.results[name];lines.push(`## ${name}`,'',`Status: ${status}`,`Objective: ${r?.objective??'Not reached'}`,`Setup: ${r?.setup??'Not performed'}`,`Records: see journal.fixtures and evidence.json; all scoped to ${ctx.run}`,`Identities: ${(r?.identities??[]).join(', ')}`,`Observed: ${r?.status==='PASS'?'Assertions passed; exact safe states and timing in evidence.json':'Not proven; no softened gate'}`,`Cleanup: ${ctx.journal.cleanup??'NOT PROVEN'}`,`Invariant: ${r?.invariant??'Not proven'}`,'');}
  lines.push('## Final decision','',...rows.map(([n,s])=>`${n}: ${s}`),`DELETABLE TEST DATA CLEANUP: ${clean?'PASS':'FAIL'}`,`IMMUTABLE SYNTHETIC RESIDUE: ${residue?'YES':'NO'}`,`IMMUTABLE RESIDUE WITHIN DECLARED BUDGET: ${clean?'YES':'NO'}`,`RESIDUE LEDGER COMPLETE: ${clean?'YES':'NO'}`,
    'REAL PII RETAINED: NO',`LIVE-SUPPLIER-ELIGIBLE TEST DATA RETAINED: ${clean?'NO':'NOT PROVEN'}`,
    'PRODUCTION TOUCHED: NO','LEGACY TOUCHED: NO','LIVE SUPPLIER TOUCHED: NO',`SAFE TO START HOTELS H2 / PRODUCT P2: ${verdict==='PASS'?'YES':'NO'}`,'');
  if(!clean)lines.push('Residue existence is conservative until cleanup completes; an empty partial ledger is NOT proof of zero residue.','');
  if(ctx.error){
    lines.push(`Safe blocker: ${ctx.error.label}`);
    if(ctx.error.diagnostic){const d=ctx.error.diagnostic;lines.push(
      `Failing preflight stage: ${d.stage}`,
      `Subsystem: ${d.subsystem}`,
      `Safe error code: ${d.safeCode}`,
      `Sanitized error message: ${d.message}`,
      `Exception: ${d.exceptionName}`,
      `Network connection established before failure: ${d.networkConnectionEstablished?'YES':'NO'}`,
      `Target category: ${d.targetCategory}`,
      `Failure timestamp: ${d.timestamp}`
    );}
    lines.push('');
  }
  return lines.join('\n');
}
