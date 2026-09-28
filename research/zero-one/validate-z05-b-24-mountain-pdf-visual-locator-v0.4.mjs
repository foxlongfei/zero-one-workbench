import fs from "node:fs";
const d=JSON.parse(fs.readFileSync(new URL("./z05-b-24-mountain-pdf-visual-locator-v0.4.json",import.meta.url),"utf8"));
const checks=[
 ["task continuity",d.task_id==="Z05"&&d.method_component==="24_MOUNTAIN_ORDER"],
 ["stable source",d.source?.archive_identifier==="06056502.cn"&&d.source?.page_count===237],
 ["four inspected samples",d.visual_samples?.length===4&&[1,20,40,80].every((p,i)=>d.visual_samples[i]?.pdf_page===p)],
 ["toc locator",d.locator_progress?.toc_start_pdf_page===80&&d.locator_progress?.status==="TOC_START_LOCATED_TARGET_ENTRY_OPEN"],
 ["negative bounded",d.inference_policy?.some(x=>/not absence/.test(x))],
 ["historical gate unchanged",d.historical_source_verified===false],
 ["exact next checkpoint",/80–90/.test(d.next_action||"")]
];
for(const [n,ok] of checks) console.log((ok?"PASS":"FAIL")+" "+n);
if(checks.some(([,ok])=>!ok)) process.exit(1);
console.log("7/7 PASS");
