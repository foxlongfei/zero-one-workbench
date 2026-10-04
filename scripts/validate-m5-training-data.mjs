import fs from "node:fs";

const file = "portal/data/m5-training-scenarios.json";
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const requiredScenarioIds = new Set(["outdoor-pullup", "home-whole-body-15"]);
const requiredActionFields = ["id", "name", "dose", "demo", "anatomy", "joint", "technique"];

if (data.schema !== "zero-one.m5.training-scenarios.v0.1") throw new Error("unexpected M5 schema");
if (data.release !== "M5_TRAINING_LOOP_V0.1") throw new Error("unexpected M5 release");
if (!Array.isArray(data.scenarios) || data.scenarios.length < 2) throw new Error("M5 requires two scenarios");

for (const scenario of data.scenarios) {
  requiredScenarioIds.delete(scenario.id);
  if (!scenario.title || !scenario.defaults || !Array.isArray(scenario.actions) || scenario.actions.length < 4) {
    throw new Error(`incomplete scenario: ${scenario.id}`);
  }
  for (const field of ["body", "purpose", "minutes", "environment", "equipment", "limitations"]) {
    if (!(field in scenario.defaults)) throw new Error(`${scenario.id} missing parsed field ${field}`);
  }
  for (const action of scenario.actions) {
    for (const field of requiredActionFields) {
      if (!action[field]) throw new Error(`${scenario.id}/${action.id || "unknown"} missing ${field}`);
    }
  }
}

if (requiredScenarioIds.size) throw new Error(`missing scenarios: ${[...requiredScenarioIds].join(", ")}`);
for (const feedback of ["轻松", "合适", "偏吃力", "疼痛或麻木"]) {
  if (!data.feedbackRules?.[feedback]?.decision || !data.feedbackRules[feedback].message) {
    throw new Error(`missing feedback rule: ${feedback}`);
  }
}
if (data.safety?.decision !== "SAFETY_TRIAGE" || data.safety.patterns.length < 7 || !data.safety.message) {
  throw new Error("incomplete safety triage");
}

console.log(JSON.stringify({
  passed: true,
  release: data.release,
  scenarios: data.scenarios.map((scenario) => ({ id: scenario.id, actions: scenario.actions.length })),
  feedbackRules: Object.keys(data.feedbackRules).length,
  safetyPatterns: data.safety.patterns.length
}, null, 2));
