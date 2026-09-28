import fs from "node:fs";
const p=process.argv[2]||"research/zero-one/z05-b-24-mountain-ia-ocr-audit-v0.3.json";
const d=JSON.parse(fs.readFileSync(p,"utf8"));
const checks=[
 ["task retained",d.task_id==="Z05"&&d.method_component==="24_MOUNTAIN_ORDER"],
 ["archive metadata bound",d.source?.archive_identifier==="06056502.cn"&&d.source?.page_count===237],
 ["8 queries recorded",d.query_matrix?.length===8&&d.query_matrix.every(x=>x.match_count===0)],
 ["negative nonconclusive",d.inference_policy==="NEGATIVE_OCR_SEARCH_IS_NONCONCLUSIVE"],
 ["exact page remains open",d.exact_scan_locator?.leaf===null&&d.exact_scan_locator?.status==="OPEN"],
 ["historical gate closed",d.historical_source_verified===false],
 ["visual next step",/Visually inspect/.test(d.next_action||"")]
];
for(const [name,ok] of checks) console.log((ok?"PASS ":"FAIL ")+name);
if(checks.some(([,ok])=>!ok)) process.exit(1);
console.log("RESULT 7/7 PASS");
