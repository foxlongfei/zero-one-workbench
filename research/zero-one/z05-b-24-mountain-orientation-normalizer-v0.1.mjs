import fs from 'node:fs';
const model=JSON.parse(fs.readFileSync(new URL('./z05-b-24-mountain-orientation-normalizer-v0.1.json',import.meta.url),'utf8'));
const suite=JSON.parse(fs.readFileSync(new URL('./z05-b-24-mountain-orientation-normalizer-cases-v0.1.json',import.meta.url),'utf8'));
const labels=['子','癸','丑','艮','寅','甲','卯','乙','辰','巽','巳','丙','午','丁','未','坤','申','庚','酉','辛','戌','乾','亥','壬'];
export function normalizeOrientation(value){
  if(typeof value!=='number'||!Number.isFinite(value))return{state:'INVALID_INPUT'};
  const d=((value%360)+360)%360;
  const index=Math.floor(((d+7.5)%360)/15);
  const center=index*15;
  const low=(center-7.5+360)%360,high=(center+7.5)%360;
  return{state:'NORMALIZED',normalized_degrees:d,mountain:labels[index],center_degrees:center,interval:{low,high,left_closed:true,right_open:true,crosses_zero:low>high}};
}
const results=suite.cases.map(c=>{const actual=normalizeOrientation(c.degrees);const got=actual.state==='NORMALIZED'?actual.mountain:actual.state;return{id:c.id,expected:c.expected,actual:got,pass:got===c.expected}});
const checks=[
  {name:'task and route retained',pass:model.task_id==='Z05'&&model.route_id==='ROUTE_KANYU'},
  {name:'exact source remains open',pass:model.source_binding.state==='OPEN_EXACT_PASSAGE_REQUIRED'&&!model.validity_boundary.historical_source_verified},
  {name:'no fortune claim',pass:model.validity_boundary.fortune_or_effect_claim===false},
  {name:'24 unique labels',pass:labels.length===24&&new Set(labels).size===24},
  {name:'ten boundary cases pass',pass:results.length===10&&results.every(x=>x.pass)}
];
const passed=checks.filter(x=>x.pass).length;console.log(JSON.stringify({validator:'Z05-B-24-MOUNTAIN-ORIENTATION-NORMALIZER-V0.1',passed,total:checks.length,checks,case_results:results},null,2));if(passed!==checks.length)process.exit(1);
