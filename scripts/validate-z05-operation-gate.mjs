import fs from "node:fs";

const graph = JSON.parse(
  fs.readFileSync(
    new URL("../research/zero-one/z05-b-source-bound-operation-gate-v0.3.json", import.meta.url),
    "utf8",
  ),
);

function execute(operationId) {
  const operation = graph.registry.find((item) => item.operation_id === operationId);
  if (!operation) return "REJECT_UNREGISTERED_OPERATION";
  if (operation.kind === "ENVIRONMENTAL" && !operation.source_binding) {
    return "BLOCKED_NO_SOURCE_BINDING";
  }
  return operation.result;
}

let passed = 0;
for (const test of graph.acceptance_cases) {
  const actual = execute(test.operation_id);
  if (actual !== test.expected) {
    throw new Error(`${test.operation_id}: expected ${test.expected}, got ${actual}`);
  }
  passed += 1;
}

console.log(`Z05 source-bound operation gate: ${passed}/${graph.acceptance_cases.length} PASS`);
