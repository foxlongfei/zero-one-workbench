import fs from 'node:fs';
const a = JSON.parse(fs.readFileSync(new URL('./testset-01-m02-q-clean-blind-v0.2.json', import.meta.url), 'utf8'));
const checks=[]; const check=(name,pass,detail)=>checks.push({name,pass:Boolean(pass),detail});
const expected={
  'RAW-T01-01':{interval:[16.8,33.4],result:5,complete:5},
  'RAW-T01-02':{interval:[14.6,55.8],result:{min:34,max:36},complete:34,uncertain:2},
  'RAW-T01-03':{interval:[77.0,139.0],result:{min:29,max:31},complete:29,uncertain:2},
  'RAW-T01-04':{interval:[7.0,22.4],result:5,complete:5},
  'RAW-T01-05':{interval:[5.8,49.2],result:37,complete:37},
  'RAW-T01-06':{interval:[84.8,137.8],result:30,complete:29,uncertain:1}
};
const eq=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
check('task id preserved',a.task_id==='M02',a.task_id);
check('schema-only lineage',a.repair_lineage.repair_scope==='SCHEMA_ONLY'&&!a.repair_lineage.observation_or_count_changed,a.repair_lineage);
check('source and C audit pinned',a.repair_lineage.source_commit.length===40&&a.repair_lineage.c_audit_commit.length===40,a.repair_lineage);
check('frozen hashes 8/8',Object.keys(a.frozen_input_sha256).length===8,Object.keys(a.frozen_input_sha256));
check('recording coverage 6/6',a.recordings.length===6,a.recordings.map(x=>x.id));
for(const r of a.recordings){const e=expected[r.id]; check(`${r.id} observations/counts preserved`,e&&eq(r.interval_s,e.interval)&&eq(r.candidate_result,e.result)&&r.complete_candidates===e.complete&&(e.uncertain===undefined||r.uncertain_candidates===e.uncertain),r);}
check('taxonomy complete 6/6',a.recordings.every(r=>['OBSERVED','COUNTED','INTERPRETED','NOT_VISIBLE','UNCERTAIN'].every(k=>Array.isArray(r.evidence_taxonomy[k]))),a.recordings.map(r=>Object.keys(r.evidence_taxonomy)));
check('protocol class allowed',a.recordings.every(r=>a.allowed_protocol_classes.includes(r.classification_summary.rep_classification)),a.recordings.map(r=>r.classification_summary.rep_classification));
check('all classifications remain UNKNOWN',a.recordings.every(r=>r.classification_summary.rep_classification==='UNKNOWN'),a.recordings.map(r=>r.id));
check('candidate-only L1',a.recordings.every(r=>r.classification_summary.candidate_only&&r.classification_summary.evidence_level==='L1'),a.recordings.map(r=>r.classification_summary));
check('30vs60 not established',a.thirty_vs_sixty_observation.startsWith('NOT_ESTABLISHED'),a.thirty_vs_sixty_observation);
check('depth/quality/completeness not established',Object.values(a.boundaries).slice(0,3).every(x=>x==='NOT_ESTABLISHED'),a.boundaries);
check('D independence protected',a.boundaries.d_independence==='PROTECTED',a.boundaries.d_independence);
check('weak pair not synchronized',a.pairings[1].synchronization==='NOT_ESTABLISHED',a.pairings[1]);
const passed=checks.filter(x=>x.pass).length;
console.log(JSON.stringify({validator:'TESTSET-01-M02-Q-CLEAN-BLIND-VALIDATOR-V0.2',passed,total:checks.length,checks},null,2));
if(passed!==checks.length)process.exit(1);
