import fs from 'node:fs';
const map=JSON.parse(fs.readFileSync(new URL('./common-human-coordinate-elbow-composite-map-v0.3.json',import.meta.url),'utf8'));
const cases=JSON.parse(fs.readFileSync(new URL('./common-human-coordinate-elbow-composite-map-cases-v0.3.json',import.meta.url),'utf8'));
const crosswalk=JSON.parse(fs.readFileSync(new URL('./bodyparts3d-upper-limb-id-crosswalk-v0.1.json',import.meta.url),'utf8'));
const byBp=new Map(crosswalk.mappings.map(x=>[x.bp_representation_id,x]));
function resolve(side){return side==='RIGHT'?map.asset_refs:[]}
const results=cases.cases.map(c=>{const refs=resolve(c.side);return{id:c.id,pass:refs.length===c.expected_count&&refs.map(x=>x.mesh_element_id).join(',')===c.expected_mesh_ids.join(',')}});
const checks=[
  {name:'proxy type explicit',pass:map.mapping_type==='ARTICULATING_BONES_PROXY'},
  {name:'three verified bones',pass:map.asset_refs.length===3&&map.asset_refs.every(x=>byBp.get(x.bp_representation_id)?.mesh_element_id===x.mesh_element_id)},
  {name:'joint completeness denied',pass:map.acceptance.complete_joint_asset===false&&/not a dedicated elbow-joint surface/.test(map.boundary)},
  {name:'left remains unmapped',pass:map.acceptance.left_side_mapped===false&&resolve('LEFT').length===0},
  {name:'three side cases pass',pass:results.length===3&&results.every(x=>x.pass)}
];
const passed=checks.filter(x=>x.pass).length;console.log(JSON.stringify({validator:'COMMON-HUMAN-COORDINATE-ELBOW-COMPOSITE-MAP-V0.3',passed,total:checks.length,checks,case_results:results},null,2));if(passed!==checks.length)process.exit(1);
