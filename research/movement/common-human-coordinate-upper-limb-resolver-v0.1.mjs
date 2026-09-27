import fs from 'node:fs';
const map=JSON.parse(fs.readFileSync(new URL('./common-human-coordinate-upper-limb-alias-map-v0.1.json',import.meta.url),'utf8'));
const suite=JSON.parse(fs.readFileSync(new URL('./common-human-coordinate-upper-limb-alias-cases-v0.1.json',import.meta.url),'utf8'));
const targets=Object.fromEntries(map.canonical_targets.map(x=>[x.id,x]));
export function resolveBodyInput(raw){
  const original=String(raw??'');let text=original.normalize('NFKC').replace(/\s+/g,'');
  if(map.symptom_markers.some(x=>text.includes(x)))return{status:'SAFETY_OR_SYMPTOM',target:null,side:'UNSPECIFIED',goal:'UNSPECIFIED',reason:'symptom language takes precedence over exercise mapping'};
  let side='UNSPECIFIED';for(const [mark,value] of Object.entries(map.side_markers)){if(text.startsWith(mark)){side=value;text=text.slice(mark.length);break}}
  let goal='UNSPECIFIED';for(const [mark,value] of Object.entries(map.goal_markers)){if(text.endsWith(mark)){goal=value;text=text.slice(0,-mark.length);break}}
  if(map.ambiguous_terms[text])return{status:'ASK_DISAMBIGUATION',target:null,side,goal,choices:map.ambiguous_terms[text]};
  if(map.recognized_out_of_sample.includes(text))return{status:'DEFER_OUT_OF_SAMPLE',target:null,side,goal};
  const target=map.aliases[text]??null;
  if(!target)return{status:'NO_MATCH',target:null,side,goal};
  const spec=targets[target];
  const assetStatus=side==='LEFT'?'NOT_MAPPED_LEFT':side==='RIGHT'?spec.asset_completeness:'SIDE_UNSPECIFIED';
  return{status:side==='LEFT'?'RESOLVED_ASSET_PENDING':'RESOLVED',target,side,goal,kind:spec.kind,assets:side==='RIGHT'?spec.right_assets:[],asset_status:assetStatus};
}
const results=suite.cases.map(c=>{const actual=resolveBodyInput(c.input);return{id:c.id,input:c.input,expected:{status:c.expected_status,target:c.expected_target,side:c.expected_side,goal:c.expected_goal},actual,pass:actual.status===c.expected_status&&actual.target===c.expected_target&&actual.side===c.expected_side&&actual.goal===c.expected_goal}});
const checks=[
  {name:'task id preserved',pass:map.task_id==='COMMON-HUMAN-COORDINATE',detail:map.task_id},
  {name:'four canonical targets',pass:map.canonical_targets.length===4,detail:map.canonical_targets.map(x=>x.id)},
  {name:'biceps is two-head composite',pass:targets.MUSCLE_BICEPS_BRACHII.kind==='COMPOSITE_MUSCLE'&&targets.MUSCLE_BICEPS_BRACHII.right_assets.length===2,detail:targets.MUSCLE_BICEPS_BRACHII},
  {name:'forearm is region not muscle',pass:targets.REGION_FOREARM.kind==='ANATOMICAL_REGION'&&targets.REGION_FOREARM.asset_completeness==='PARTIAL_BONY_SUBSET',detail:targets.REGION_FOREARM},
  {name:'broad arm terms require disambiguation',pass:['胳膊','手臂'].every(x=>Array.isArray(map.ambiguous_terms[x])),detail:map.ambiguous_terms},
  {name:'symptom routing precedes exercise mapping',pass:resolveBodyInput('二头疼').status==='SAFETY_OR_SYMPTOM'&&resolveBodyInput('肘麻').status==='SAFETY_OR_SYMPTOM',detail:[resolveBodyInput('二头疼'),resolveBodyInput('肘麻')]},
  {name:'unspecified side stays unspecified',pass:resolveBodyInput('二头').side==='UNSPECIFIED'&&resolveBodyInput('二头').assets.length===0,detail:resolveBodyInput('二头')},
  {name:'left known term does not borrow right assets',pass:resolveBodyInput('左肱二头肌').status==='RESOLVED_ASSET_PENDING'&&resolveBodyInput('左肱二头肌').assets.length===0,detail:resolveBodyInput('左肱二头肌')},
  {name:'twelve cases executed',pass:results.length===12,detail:results.length},
  {name:'all expected outcomes matched',pass:results.every(x=>x.pass),detail:results},
  {name:'page integration not falsely claimed',pass:map.acceptance.page_integration===false&&map.acceptance.public_readback===false,detail:map.acceptance},
  {name:'strict mainline unchanged',pass:map.acceptance.mainline_before==='2/4'&&map.acceptance.mainline_after==='2/4',detail:map.acceptance}
];
const passed=checks.filter(x=>x.pass).length;
console.log(JSON.stringify({validator:'COMMON-HUMAN-COORDINATE-UPPER-LIMB-RESOLVER-V0.1',passed,total:checks.length,checks,case_results:results},null,2));
if(passed!==checks.length)process.exit(1);
