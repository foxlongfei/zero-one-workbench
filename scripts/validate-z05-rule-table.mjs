import fs from "node:fs";

const file = new URL(
  "../research/zero-one/z05-b-24-mountain-rule-table-v0.1.json",
  import.meta.url,
);
const table = JSON.parse(fs.readFileSync(file, "utf8"));
const normalize = (value) => ((value % 360) + 360) % 360;
const decide = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value))
    return { error: "REJECT_INVALID_INPUT" };
  const normalized = normalize(value);
  const index = Math.floor(((normalized + 7.5) % 360) / 15);
  const sector = table.sectors[index];
  return {
    normalized,
    index,
    mountain: sector.mountain,
    center_degrees: sector.center_degrees,
    interval: sector.interval,
  };
};

if (table.sectors.length !== 24) throw new Error("expected 24 sectors");
table.sectors.forEach((sector, index) => {
  if (sector.index !== index) throw new Error(`non-contiguous index ${index}`);
  if (sector.center_degrees !== index * 15)
    throw new Error(`bad center ${sector.mountain}`);
});
for (const test of table.acceptance_cases) {
  const actual = decide(test.input);
  if (
    test.expected_error
      ? actual.error !== test.expected_error
      : actual.mountain !== test.expected
  ) {
    throw new Error(`case failed: ${JSON.stringify({ test, actual })}`);
  }
}
console.log(
  JSON.stringify(
    {
      passed: true,
      artifact_id: table.artifact_id,
      sectors: 24,
      cases: table.acceptance_cases.length,
    },
    null,
    2,
  ),
);
