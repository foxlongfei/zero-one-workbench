import fs from "node:fs";

const gate = JSON.parse(fs.readFileSync(new URL("../research/zero-one/z05-b-source-scope-compatibility-gate-v0.4.json", import.meta.url), "utf8"));
const known = new Set(["DIRECTION_NORMALIZATION","ENV_OPENING_RELATION","ENV_ROAD_RELATION","ENV_WATER_RELATION","ENV_SLOPE_RELATION"]);

function evaluate(test) {
  if (!known.has(test.operation_id)) return "REJECT_UNREGISTERED_OPERATION";
  if (!test.candidate_binding) return "BLOCKED_NO_SOURCE_BINDING";
  const available = new Set(gate.verified_source.verified_scope_tags);
  if (!test.required_scope_tags.every((tag) => available.has(tag))) return "BLOCKED_SOURCE_SCOPE_MISMATCH";
  return test.operation_id === "DIRECTION_NORMALIZATION" ? "EXECUTION_ALLOWED_NON_ENVIRONMENTAL" : "SOURCE_SCOPE_COMPATIBLE_PENDING_LOCATOR";
}

let passed = 0;
for (const test of gate.operations) {
  const actual = evaluate(test);
  if (actual !== test.expected) throw new Error(`${test.operation_id}: expected ${test.expected}, got ${actual}`);
  passed += 1;
}
console.log(`Z05 source-scope compatibility gate: ${passed}/${gate.operations.length} PASS`);
