import fs from 'node:fs';
const binding=JSON.parse(fs.readFileSync(new URL('./z05-b-24-mountain-source-binding-v0.2.json',import.meta.url),'utf8'));
const method=JSON.parse(fs.readFileSync(new URL('./z05-b-24-mountain-orientation-normalizer-v0.1.json',import.meta.url),'utf8'));
const labels=['子','癸','丑','艮','寅','甲','卯','乙','辰','巽','巳','丙','午','丁','未','坤','申','庚','酉','辛','戌','乾','亥','壬'];
const seq=binding.textual_locator.located_sequence;
const circularFromZi=seq.slice(seq.indexOf('子'))+seq.slice(0,seq.indexOf('子'));
const checks=[
  {name:'task retained',pass:binding.task_id==='Z05'&&binding.method_component==='24_MOUNTAIN_ORDER'},
  {name:'24-name order matches executable model',pass:circularFromZi===labels.join('')},
  {name:'text locator URL bound',pass:/^https:\/\/ctext\.org\//.test(binding.textual_locator.url)},
  {name:'facsimile identity bound',pass:binding.facsimile_candidate.identifier==='06056502.cn'&&binding.facsimile_candidate.pages===237},
  {name:'scan page remains honestly open',pass:binding.facsimile_candidate.passage_page===null&&binding.status==='TEXT_LOCATOR_BOUND_SCAN_PAGE_OPEN'},
  {name:'unsupported geometry conventions not attributed',pass:binding.binding_decision.equal_15_degree_segmentation_supported_by_locator===false&&binding.binding_decision.north_zero_clockwise_convention_supported_by_locator===false},
  {name:'method remains historically unverified',pass:method.validity_boundary.historical_source_verified===false&&binding.binding_decision.historical_source_verified===false}
];
const passed=checks.filter(x=>x.pass).length;console.log(JSON.stringify({validator:'Z05-B-24-MOUNTAIN-SOURCE-BINDING-V0.2',passed,total:checks.length,checks},null,2));if(passed!==checks.length)process.exit(1);
