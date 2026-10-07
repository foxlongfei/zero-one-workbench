const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "portal/data/k4-evidence-layers.json"), "utf8"));
const page = fs.readFileSync(path.join(root, "portal/k02-board.html"), "utf8");
const requiredLayers = ["COMPUTED_FACT", "TRADITIONAL_TEXT", "MODERN_HYPOTHESIS", "UNVERIFIED_CLAIM"];
const checks = {
  schema: data.schema === "zero-one.k4.evidence-layers.v0.1",
  records: Array.isArray(data.layers) && data.layers.length >= 6,
  requiredLayers: requiredLayers.every(layer => data.layers.some(item => item.layer === layer)),
  computedFacts: data.layers.filter(x => x.layer === "COMPUTED_FACT").every(x => x.provenance?.artifact && x.provenance?.scope),
  traditionalWitnesses: data.layers.filter(x => x.layer === "TRADITIONAL_TEXT").every(x => x.source?.work && x.source?.attributionStatus),
  unverifiedBlocked: data.layers.some(x => x.layer === "UNVERIFIED_CLAIM" && /Do not use|不得|Do not/.test(x.prohibitedUse)),
  geometryHonest: data.caseBoundary.geometryContinuity === "NOT_PROVEN",
  pageIntegration: page.includes('id="k4-evidence-layer"') && page.includes("assets/k4-evidence-layer-v0.1.js"),
  status: page.includes("K4｜PENDING_ACCEPTANCE")
};
console.log(JSON.stringify({schema:data.schema,caseId:data.caseId,records:data.layers.length,checks,passed:Object.values(checks).every(Boolean)}, null, 2));
if (!Object.values(checks).every(Boolean)) process.exit(1);
