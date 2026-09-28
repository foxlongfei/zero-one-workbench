import fs from "node:fs";const d=JSON.parse(fs.readFileSync(new URL("./common-human-coordinate-right-shoulder-region-proxy-v0.7.json",import.meta.url),"utf8"));const c=[
d.task_id==="COMMON-HUMAN-COORDINATE",
d.entry?.target_id==="REGION_SHOULDER_ENTRY_PROXY"&&d.entry?.kind==="REGION_ENTRY_PROXY",
d.entry?.side==="RIGHT",
JSON.stringify(d.entry?.asset_refs)==='[["BP9206","FJ3368"],["BP5558","FJ1512"],["BP5566","FJ1478"]]',
["肩关节","肩膀","肩"].every(x=>d.entry?.aliases?.includes(x)),
/肩胛骨/.test(d.limitation||"")&&/锁骨/.test(d.limitation||"")&&/非完整肩关节模型/.test(d.limitation||""),
d.equivalence_contract?.length===4,
d.mainline_gate?.completed===2&&d.mainline_gate?.total===4
];c.forEach((x,i)=>console.log((x?"PASS":"FAIL")+" "+(i+1)));if(c.some(x=>!x))process.exit(1);console.log("8/8 PASS");
