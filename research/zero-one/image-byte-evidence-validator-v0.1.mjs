import fs from "node:fs";

const SHA256 = /^[0-9a-f]{64}$/;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);
const ROLE_EVIDENCE = new Set(["VISUAL_INSPECTION", "EXPLICIT_FIGURE_LABEL"]);

export function validateImageByteEvidence(record) {
  const violations = [];
  const bytesPresent = record.byte_status === "ACQUIRED";

  if (!bytesPresent) {
    if (record.asset_presence === "ABSENT") violations.push("IB-04");
    if (record.resolved_role !== "UNKNOWN") violations.push("IB-03");
    return { accepted: violations.length === 0, audit_status: "BYTES_PENDING", violations };
  }

  if (!(Number.isInteger(record.byte_length) && record.byte_length > 0)) violations.push("IB-01");
  if (!SHA256.test(record.sha256 ?? "")) violations.push("IB-01");
  if (!IMAGE_TYPES.has(record.content_type)) violations.push("IB-02");
  if (record.decode_status !== "PASS") violations.push("IB-02");
  if (!(Number.isInteger(record.width_px) && record.width_px > 0 &&
        Number.isInteger(record.height_px) && record.height_px > 0)) violations.push("IB-02");

  if (record.resolved_role !== "UNKNOWN" &&
      !ROLE_EVIDENCE.has(record.role_evidence)) violations.push("IB-03");

  return {
    accepted: violations.length === 0,
    audit_status: violations.length === 0 ? "BYTE_EVIDENCE_ACCEPTED" : "BYTE_EVIDENCE_REJECTED",
    violations: [...new Set(violations)]
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const cases = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  let passed = 0;
  for (const tc of cases) {
    const got = validateImageByteEvidence(tc.input);
    const ok = JSON.stringify(got) === JSON.stringify(tc.expected);
    console.log(`${ok ? "PASS" : "FAIL"} ${tc.id}`);
    if (!ok) console.log(JSON.stringify({ got, expected: tc.expected }, null, 2));
    passed += Number(ok);
  }
  console.log(`${passed}/${cases.length} PASS`);
  process.exitCode = passed === cases.length ? 0 : 1;
}
