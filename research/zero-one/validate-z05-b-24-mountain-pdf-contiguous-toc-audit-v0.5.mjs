import fs from "node:fs";const d=JSON.parse(fs.readFileSync(new URL("./z05-b-24-mountain-pdf-contiguous-toc-audit-v0.5.json",import.meta.url),"utf8"));const c=[
d.task_id==="Z05"&&d.method_component==="24_MOUNTAIN_ORDER",
JSON.stringify(d.contiguous_audit?.pdf_pages)==JSON.stringify([80,81,82,83,84,85,86,87,88,89,90]),
d.contiguous_audit?.complete===true&&d.contiguous_audit?.headings_observed?.length===12,
d.contiguous_audit?.target_heading_visible===false&&/does not establish absence/.test(d.contiguous_audit?.bounded_inference||""),
JSON.stringify(d.volume_one_locator?.pdf_pages)==JSON.stringify([97,98,99])&&d.volume_one_locator?.headings_observed?.length>=15,
d.source_decision?.status==="CANDIDATE_DEPRIORITIZED_FOR_EXACT_24_MOUNTAIN_SEQUENCE",
d.historical_source_verified===false&&d.exact_archive_leaf===null&&d.exact_column===null,
/sibling scans\/volumes/.test(d.next_action||"")
];c.forEach((x,i)=>console.log((x?"PASS":"FAIL")+" "+(i+1)));if(c.some(x=>!x))process.exit(1);console.log("8/8 PASS");
