import fs from 'node:fs';
const crosswalk=JSON.parse(fs.readFileSync(new URL('./bodyparts3d-upper-limb-id-crosswalk-v0.1.json',import.meta.url),'utf8'));
const cases=JSON.parse(fs.readFileSync(new URL('./common-human-coordinate-asset-reference-cases-v0.2.json',import.meta.url),'utf8'));
const targetBp={MUSCLE_BICEPS_BRACHII:['BP5558','BP5566'],JOINT_ELBOW:['BP9206','BP8464','BP8233'],REGION_FOREARM:['BP8464','BP8233'],REGION_UPPER_ARM:['BP9206','BP5558','BP5566']};
const byBp=new Map(crosswalk.mappings.map(x=>[x.bp_representation_id,x]));
export function decorateAssetReferences(result){const base={...result,asset_refs:[]};if(result?.status!=='RESOLVED'||result.side!=='RIGHT'||!targetBp[result.target])return base;return{...base,asset_refs:targetBp[result.target].map(bp=>{const x=byBp.get(bp);return{bp_representation_id:bp,mesh_element_id:x?.mesh_element_id??null,obj_path:x?.obj_path??null}})}}
const results=cases.cases.map(c=>{const actual=decorateAssetReferences(c.input);return{id:c.id,pass:actual.asset_refs.length===c.expected_count&&actual.asset_refs.map(x=>x.mesh_element_id).join(',')===c.expected_mesh_ids.join(','),actual}});
const checks=[];const check=(name,pass,detail)=>checks.push({name,pass:Boolean(pass),detail});
check('four canonical targets covered',Object.keys(targetBp).length===4,targetBp);
check('right biceps resolves both heads',decorateAssetReferences({status:'RESOLVED',target:'MUSCLE_BICEPS_BRACHII',side:'RIGHT'}).asset_refs.length===2,null);
check('left never borrows right assets',decorateAssetReferences({status:'RESOLVED_ASSET_PENDING',target:'MUSCLE_BICEPS_BRACHII',side:'LEFT'}).asset_refs.length===0,null);
check('unspecified side stays asset-free',decorateAssetReferences({status:'RESOLVED',target:'MUSCLE_BICEPS_BRACHII',side:'UNSPECIFIED'}).asset_refs.length===0,null);
check('all resolved paths use FJ mesh ids',Object.values(targetBp).flat().every(bp=>/^FJ\d+$/u.test(byBp.get(bp)?.mesh_element_id??'')),crosswalk.mappings);
check('six decorator cases pass',results.length===6&&results.every(x=>x.pass),results);
const passed=checks.filter(x=>x.pass).length;console.log(JSON.stringify({validator:'COMMON-HUMAN-COORDINATE-ASSET-REFERENCE-DECORATOR-V0.2',passed,total:checks.length,checks,case_results:results},null,2));if(passed!==checks.length)process.exit(1);
