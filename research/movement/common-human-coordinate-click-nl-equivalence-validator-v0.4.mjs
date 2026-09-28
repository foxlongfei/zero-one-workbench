import fs from "node:fs";

const path = new URL("./common-human-coordinate-click-nl-equivalence-v0.4.json", import.meta.url);
const data = JSON.parse(fs.readFileSync(path, "utf8"));

const checks = [
  ["task retained", data.task_id === "COMMON-HUMAN-COORDINATE"],
  ["target is right elbow", data.target === "JOINT_ELBOW" && data.side === "RIGHT"],
  ["click and NL resolve identically", data.acceptance?.same_structure_id === true && data.acceptance?.same_side === true],
  ["same three reference assets", data.acceptance?.same_asset_refs === true && data.expected?.asset_refs?.length === 3],
  ["proxy boundary remains explicit", data.acceptance?.complete_joint_asset === false && /proxy|代理/i.test(data.expected?.boundary || "")]
];

for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
const passed = checks.filter(([, ok]) => ok).length;
console.log(`RESULT ${passed}/${checks.length}`);
if (passed !== checks.length) process.exit(1);
