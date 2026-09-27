import fs from 'node:fs';
const gate=JSON.parse(fs.readFileSync(new URL('./testset-01-m03-clean-context-gate-v0.1.json',import.meta.url),'utf8'));
const suite=JSON.parse(fs.readFileSync(new URL('./testset-01-m03-clean-context-gate-cases-v0.1.json',import.meta.url),'utf8'));
const exact=gate.frozen_manifest;
const mutated={...exact,'RAW-T01-06_PROXY_5FPS.mp4':'0'.repeat(64)};
const plusHistory={...exact,'TESTSET-01_CQD_CROSS-REVIEW_ROUND-1_V0.1.md':'1'.repeat(64)};
const manifests={FROZEN_MANIFEST_EXACT:exact,FROZEN_MANIFEST_ONE_HASH_MUTATED:mutated,FROZEN_MANIFEST_PLUS_HISTORICAL_REVIEW:plusHistory};
const sameManifest=m=>JSON.stringify(Object.entries(m).sort())===JSON.stringify(Object.entries(exact).sort());
function evaluate(c){
  const forbidden=c.context_classes.some(x=>gate.forbidden_context_classes.includes(x));
  if(forbidden||c.never_received_q_or_c_outputs!==true||c.preexisting_d_result!==false||c.worker_role!=='D')return 'BLOCKED_CONTEXT_CONTAMINATION';
  if(!c.context_classes.every(x=>gate.allowed_context_classes.includes(x))||!sameManifest(manifests[c.manifest_ref]??{}))return 'BLOCKED_INPUT_MISMATCH';
  return 'READY_FOR_M03_D';
}
const results=suite.cases.map(c=>({id:c.id,expected:c.expected,actual:evaluate(c)}));
const checks=[
  {name:'task id preserved',pass:gate.task_id==='M03',detail:gate.task_id},
  {name:'frozen manifest 8 objects',pass:Object.keys(gate.frozen_manifest).length===8,detail:Object.keys(gate.frozen_manifest)},
  {name:'D task hash pinned',pass:gate.frozen_manifest['TESTSET-01_D_BLIND_TASK_V0.1.md']==='c5e6e85378176858e27ad3909678db3d6ba6f9cca27ea31ece2527318f78c58d',detail:gate.frozen_manifest['TESTSET-01_D_BLIND_TASK_V0.1.md']},
  {name:'protocol alias hash pinned',pass:gate.frozen_manifest['TESTSET-01_D_PROTOCOL_SNAPSHOT_V0.1.md']==='0dc2a612cabf509c7c793a583f7f00ad84ef760c4ee43511a44dd7d4097ae5fc',detail:gate.frozen_manifest['TESTSET-01_D_PROTOCOL_SNAPSHOT_V0.1.md']},
  {name:'six cases executed',pass:results.length===6,detail:results.length},
  {name:'one ready case only',pass:results.filter(x=>x.actual==='READY_FOR_M03_D').length===1,detail:results},
  {name:'all expected outcomes matched',pass:results.every(x=>x.expected===x.actual),detail:results},
  {name:'M03 not falsely completed',pass:gate.acceptance.m03_completed===false&&gate.acceptance.strict_before==='2/4'&&gate.acceptance.strict_after==='2/4',detail:gate.acceptance}
];
const passed=checks.filter(x=>x.pass).length;
console.log(JSON.stringify({validator:'TESTSET-01-M03-CLEAN-CONTEXT-GATE-VALIDATOR-V0.1',passed,total:checks.length,checks,results},null,2));
if(passed!==checks.length)process.exit(1);
