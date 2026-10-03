import fs from "node:fs";

const graph = JSON.parse(
  fs.readFileSync(
    new URL(
      "../research/zero-one/z05-b-site-observation-decision-graph-v0.2.json",
      import.meta.url,
    ),
  ),
);
const classify = (supplied) => {
  const pairs = graph.fields.map((field) => {
    const [value = "", source = ""] = supplied[field] || [];
    return { field, value: value.trim(), source };
  });
  const errors = pairs.flatMap((pair) =>
    pair.value && !pair.source
      ? [`MISSING_SOURCE:${pair.field}`]
      : !pair.value && pair.source
        ? [`ORPHAN_SOURCE:${pair.field}`]
        : [],
  );
  const known = pairs.filter(
    (pair) => pair.value && graph.allowed_sources.includes(pair.source),
  );
  if (errors.length)
    return { result: "DIRECTION_ONLY_INPUT_INCOMPLETE", errors };
  if (known.length === graph.fields.length)
    return { result: "DIRECTION_AND_OBSERVATION_READY", errors };
  if (known.length)
    return { result: "DIRECTION_ONLY_PARTIAL_OBSERVATION", errors };
  return { result: "DIRECTION_ONLY_NO_OBSERVATION", errors };
};

for (const test of graph.acceptance_cases) {
  const actual = classify(test.fields);
  if (actual.result !== test.expected)
    throw new Error(
      `${test.id}: expected ${test.expected}, got ${actual.result}`,
    );
}
console.log(
  JSON.stringify(
    {
      passed: true,
      artifact_id: graph.artifact_id,
      cases: graph.acceptance_cases.length,
    },
    null,
    2,
  ),
);
