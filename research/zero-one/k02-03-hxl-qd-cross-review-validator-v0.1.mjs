import fs from 'node:fs';
const contract=JSON.parse(fs.readFileSync(new URL('./k02-03-hxl-qd-cross-review-contract-v0.1.json',import.meta.url),'utf8'));
const suite=JSON.parse(fs.readFileSync(new URL('./k02-03-hxl-qd-cross-review-cases-v0.1.json',import.meta.url),'utf8'));
const hash=/^[0-9a-f]{64}$/;
const banned=new Set(contract.blindness_guards.forbidden_pre_freeze_fields);
const hasBanned=x=>x&&typeof x==='object'&&(Object.keys(x).some(k=>banned.has(k))||Object.values(x).some(hasBanned));
const norm=s=>String(s??'').normalize('NFKC').replace(/[\s，。；：、,.!?;:'"“”‘’]/g,'');
function validReturn(x,role){
  return x?.reviewer_role===role&&x.source_sha256_verified===true&&x.independence_declaration===true&&
    ['located_pdf_page','leaf_side','column_span','transcription','uncertain_characters','revocation_chain_present','judicial_continuation_present','confidence'].every(k=>Object.hasOwn(x,k))&&
    Array.isArray(x.uncertain_characters)&&hash.test(x.freeze?.output_sha256??'')&&!Number.isNaN(Date.parse(x.freeze?.frozen_at??''))&&!hasBanned(x);
}
function evaluate(c){
  if(!validReturn(c.q,'Q')||!validReturn(c.d,'D'))return 'HOLD_INVALID_RETURN';
  const start=Date.parse(c.cross_review_started_at),qf=Date.parse(c.q.freeze.frozen_at),df=Date.parse(c.d.freeze.frozen_at);
  if(!Number.isFinite(start)||start<=qf||start<=df||c.q.freeze.output_sha256===c.d.freeze.output_sha256)return 'HOLD_INVALID_RETURN';
  const exact=['source_sha256_verified','located_pdf_page','leaf_side','column_span','revocation_chain_present','judicial_continuation_present'];
  if(exact.some(k=>JSON.stringify(c.q[k])!==JSON.stringify(c.d[k]))||norm(c.q.transcription)!==norm(c.d.transcription))return 'HOLD_CONFLICT';
  return 'READY_FOR_CROSS_REVIEW';
}
const results=suite.cases.map(c=>({id:c.id,expected:c.expected,actual:evaluate(c)}));
const checks=[
  {name:'task id preserved',pass:contract.task_id==='K02-03-HXL-01',detail:contract.task_id},
  {name:'contract contains no expected answer',pass:!hasBanned(contract)&&!/(P-A|甲乙|located_pdf_page"\s*:)/.test(JSON.stringify(contract.inputs)),detail:contract.status},
  {name:'strict count unchanged',pass:contract.acceptance.mainline_before==='0/5'&&contract.acceptance.mainline_after==='0/5',detail:contract.acceptance},
  {name:'six cases executed',pass:results.length===6,detail:results.length},
  {name:'one ready case only',pass:results.filter(x=>x.actual==='READY_FOR_CROSS_REVIEW').length===1,detail:results},
  {name:'all expected outcomes matched',pass:results.every(x=>x.expected===x.actual),detail:results},
  {name:'conflict never auto-repaired',pass:results.find(x=>x.id==='CR-04-LOCATION-CONFLICT')?.actual==='HOLD_CONFLICT',detail:results}
];
const passed=checks.filter(x=>x.pass).length;
console.log(JSON.stringify({validator:'K02-03-HXL-01-QD-CROSS-REVIEW-VALIDATOR-V0.1',passed,total:checks.length,checks,results},null,2));
if(passed!==checks.length)process.exit(1);
