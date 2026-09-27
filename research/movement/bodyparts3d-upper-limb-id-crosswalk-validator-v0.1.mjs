import fs from 'node:fs';
const crosswalk=JSON.parse(fs.readFileSync(new URL('./bodyparts3d-upper-limb-id-crosswalk-v0.1.json',import.meta.url),'utf8'));
const source=JSON.parse(fs.readFileSync(new URL('./bodyparts3d-upper-limb-obj-byte-manifest-v0.1.json',import.meta.url),'utf8'));
const cases=JSON.parse(fs.readFileSync(new URL('./bodyparts3d-upper-limb-id-crosswalk-cases-v0.1.json',import.meta.url),'utf8'));
const byBp=new Map(crosswalk.mappings.map(x=>[x.bp_representation_id,x]));
export function resolveMeshId(bpId){const hit=byBp.get(bpId);return hit?{status:'RESOLVED',bp_representation_id:bpId,mesh_element_id:hit.mesh_element_id,obj_path:hit.obj_path}:{status:'UNMAPPED',bp_representation_id:bpId,mesh_element_id:null,obj_path:null}}
const results=cases.cases.map(c=>{const actual=resolveMeshId(c.input);return{id:c.id,pass:actual.status===c.expected_status&&actual.mesh_element_id===c.expected_mesh_element_id,actual}});
const checks=[];const check=(name,pass,detail)=>checks.push({name,pass:Boolean(pass),detail});
check('five unique BP records',crosswalk.mappings.length===5&&new Set(crosswalk.mappings.map(x=>x.bp_representation_id)).size===5,crosswalk.mappings);
check('five unique FJ mesh elements',new Set(crosswalk.mappings.map(x=>x.mesh_element_id)).size===5,crosswalk.mappings);
check('every mapping matches official byte manifest',crosswalk.mappings.every(x=>source.objects.some(o=>o.bp_id===x.bp_representation_id&&o.element_id===x.mesh_element_id&&x.obj_path.endsWith(o.path))),source.objects);
check('viewer paths are FJ OBJ paths',crosswalk.mappings.every(x=>/^assets\/bodyparts3d\/FJ\d+\.obj$/u.test(x.obj_path)),crosswalk.mappings.map(x=>x.obj_path));
check('BP ids are never treated as mesh filenames',crosswalk.mappings.every(x=>!x.obj_path.includes(x.bp_representation_id)),crosswalk.mappings);
check('six positive and negative cases',results.length===6&&results.every(x=>x.pass),results);
check('mainline unchanged',crosswalk.acceptance.mainline_before==='2/4'&&crosswalk.acceptance.mainline_after==='2/4',crosswalk.acceptance);
const passed=checks.filter(x=>x.pass).length;console.log(JSON.stringify({validator:'BODYPARTS3D-UPPER-LIMB-ID-CROSSWALK-V0.1',passed,total:checks.length,checks,case_results:results},null,2));if(passed!==checks.length)process.exit(1);
