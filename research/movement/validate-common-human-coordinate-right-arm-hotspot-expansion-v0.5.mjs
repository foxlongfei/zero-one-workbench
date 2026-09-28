import fs from "node:fs";
const p=process.argv[2]||"research/movement/common-human-coordinate-right-arm-hotspot-expansion-v0.5.json";
const d=JSON.parse(fs.readFileSync(p,"utf8"));
const checks=[
 ["task retained",d.task_id==="COMMON-HUMAN-COORDINATE"],
 ["two hotspots",d.hotspots?.length===2],
 ["target IDs",d.hotspots?.some(x=>x.target_id==="REGION_UPPER_ARM")&&d.hotspots?.some(x=>x.target_id==="REGION_FOREARM")],
 ["right side",d.hotspots?.every(x=>x.side==="RIGHT")],
 ["asset counts",d.hotspots?.find(x=>x.target_id==="REGION_UPPER_ARM")?.asset_refs?.length===3&&d.hotspots?.find(x=>x.target_id==="REGION_FOREARM")?.asset_refs?.length===2],
 ["mainline unchanged",d.mainline_gate?.completed===2&&d.mainline_gate?.total===4]
];
for(const [name,ok] of checks) console.log((ok?"PASS ":"FAIL ")+name);
if(checks.some(([,ok])=>!ok)) process.exit(1);
console.log("RESULT 6/6 PASS");
