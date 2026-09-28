import fs from "node:fs";
const p=new URL("./common-human-coordinate-right-wrist-proxy-v0.6.json",import.meta.url);
const d=JSON.parse(fs.readFileSync(p,"utf8"));
const checks=[
 ["task continuity",d.task_id==="COMMON-HUMAN-COORDINATE"],
 ["canonical target",d.entry?.target_id==="JOINT_WRIST_PROXY"&&d.entry?.kind==="JOINT_PROXY"],
 ["right side",d.entry?.side==="RIGHT"],
 ["radius/ulna refs",JSON.stringify(d.entry?.asset_refs)==='[["BP8464","FJ3349"],["BP8233","FJ3391"]]'],
 ["aliases",["腕关节","手腕","腕"].every(x=>d.entry?.aliases?.includes(x))],
 ["limitation",/非完整腕关节模型/.test(d.limitation||"")],
 ["mainline unchanged",d.mainline_gate?.completed===2&&d.mainline_gate?.total===4]
];
for(const [name,ok] of checks) console.log((ok?"PASS":"FAIL")+" "+name);
if(checks.some(([,ok])=>!ok)) process.exit(1);
console.log("7/7 PASS");
