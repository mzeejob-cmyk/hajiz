import { connect } from './connection.mjs';
import { commit } from './inventory.mjs';
import { assert, blocked } from './plan.mjs';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
// A holds its real RPC transaction open. B executes the competing RPC on another physical backend.
// Observer records pg_blocking_pids(B) containing A before A is permitted to commit.
export async function compete(ctx, observer, label, action) {
  const a=await connect(ctx.config,'A'), b=await connect(ctx.config,'B');
  let pending;
  try {
    const pidA=(await a.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const pidB=(await b.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    assert(pidA!==pidB,'INDEPENDENT_BACKENDS');
    await Promise.all([a.query('BEGIN'),b.query('BEGIN')]);
    const begin=(await observer.query('SELECT clock_timestamp()::text AS time')).rows[0].time;
    const resultA=await action(a);
    pending=action(b).then(rows=>({rows}),e=>({code:/^[A-Z0-9]{5}$/.test(e.code??'')?e.code:'FAILED'}));
    let lock;
    for(let i=0;i<40;i++) {
      const r=(await observer.query(`SELECT pid,state,wait_event_type,wait_event,query_start::text,xact_start::text,
        clock_timestamp()::text AS observed,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=$1`,[pidB])).rows[0];
      if(r?.blockers.includes(pidA)&&r.wait_event_type==='Lock') { lock=r; break; }
      await pause(100);
    }
    if(!lock) blocked('REAL_LOCK_COMPETITION_NOT_OBSERVED');
    await commit(a,ctx);
    const resultB=await pending;
    if(resultB.code) await b.query('ROLLBACK'); else await commit(b,ctx);
    const end=(await observer.query('SELECT clock_timestamp()::text AS time')).rows[0].time;
    const safe=rows=>rows?.map(r=>Object.fromEntries(['execution_id','operation_id','execution_state','should_send','replayed','booking_status','payment_status','ticket_count','can_download_ticket'].filter(k=>k in r).map(k=>[k,r[k]])));
    ctx.evidence.push({test:label,pidA,pidB,begin,lock,end,transactionA:'BEGIN/RPC/COMMIT',transactionB:resultB.code?'BEGIN/RPC/ROLLBACK':'BEGIN/RPC/COMMIT',A:safe(resultA),B:resultB.code??safe(resultB.rows)}); ctx.save();
    return {a:resultA,b:resultB.rows,code:resultB.code};
  } finally {
    try{await a.query('ROLLBACK');}catch{}
    if(pending) await pending;
    try{await b.query('ROLLBACK');}catch{}
    await Promise.allSettled([a.end(),b.end()]);
  }
}
