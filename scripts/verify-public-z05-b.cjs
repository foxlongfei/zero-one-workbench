const { chromium } = require("playwright");
const fs = require("fs");
const crypto = require("crypto");

const publicUrl = process.env.PUBLIC_URL || "https://foxlongfei.github.io/zero-one-workbench/portal/k02-board.html";
const outDir = process.env.EVIDENCE_DIR || "docs/v0.1/evidence/z05-b";
const indexUrl = process.env.INDEX_URL || "https://foxlongfei.github.io/zero-one-workbench/portal/index.html";
const statusUrl = process.env.STATUS_URL || "https://foxlongfei.github.io/zero-one-workbench/portal/status-current.md";
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const result = {
    schema: "zero-one.z05-b.public-provenance-verification.v0.1",
    publicUrl,
    verifiedAt: new Date().toISOString(),
    gitSha: process.env.GITHUB_SHA || null,
    checks: {}
  };
  const sha256 = path => crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex");

  try {
    let deployed = false;
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      await page.goto(publicUrl + "?z05verify=" + Date.now(), { waitUntil: "domcontentloaded", timeout: 120000 });
      deployed = (await page.title()).includes("V0.5") && await page.locator("#srcOpening").count() === 1;
      if (deployed) break;
      await page.waitForTimeout(20000);
    }
    if (!deployed) throw new Error("public page did not expose Z05-B V0.5 provenance inputs");

    await page.locator("#sampleRun").click();
    const output = page.locator("#result");
    await output.waitFor({ state: "visible" });
    await page.waitForFunction(() => document.querySelector("#result")?.dataset.run === "REAL_SAMPLE_182_4");
    const sample = await output.evaluate(node => ({
      run: node.dataset.run,
      observationGate: node.dataset.observationGate,
      provenanceGate: node.dataset.provenanceGate,
      text: node.innerText
    }));
    if (sample.observationGate !== "PARTIAL_KNOWN") throw new Error("sample observation gate mismatch");
    if (sample.provenanceGate !== "SOURCE_COMPLETE_FOR_KNOWN_FIELDS") throw new Error("sample provenance gate mismatch");
    for (const expected of ["主要开口=DIRECT_OBSERVATION", "道路=DIRECT_OBSERVATION", "水体=NOT_APPLICABLE", "坡向=NOT_APPLICABLE", "DIRECTION_ONLY"]) {
      if (!sample.text.includes(expected)) throw new Error("sample output missing: " + expected);
    }
    result.checks.publicSample = { passed: true, run: sample.run, observationGate: sample.observationGate, provenanceGate: sample.provenanceGate };

    await page.locator("#srcOpening").selectOption("");
    await page.getByRole("button", { name: "运行二十四山归一化", exact: true }).click();
    const counterexample = await output.evaluate(node => ({
      observationGate: node.dataset.observationGate,
      provenanceGate: node.dataset.provenanceGate,
      text: node.innerText
    }));
    if (counterexample.provenanceGate !== "MISSING_SOURCE") throw new Error("missing-source counterexample did not close provenance gate");
    if (!counterexample.text.includes("缺来源=主要开口") || !counterexample.text.includes("DIRECTION_ONLY")) {
      throw new Error("missing-source counterexample output is incomplete");
    }
    result.checks.missingSourceCounterexample = { passed: true, observationGate: counterexample.observationGate, provenanceGate: counterexample.provenanceGate };

    let synced = false;
    let indexText = "";
    let statusText = "";
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      await page.goto(indexUrl + "?syncverify=" + Date.now(), { waitUntil: "domcontentloaded", timeout: 120000 });
      indexText = await page.locator("body").innerText();
      await page.goto(statusUrl + "?syncverify=" + Date.now(), { waitUntil: "domcontentloaded", timeout: 120000 });
      statusText = await page.locator("body").innerText();
      synced = [indexText, statusText].every(text => text.includes("2026-10-03 16:38") && text.includes("SOURCE_COMPLETE_FOR_KNOWN_FIELDS") && text.includes("FUNCTIONAL_WEBGL_PASS"));
      if (synced) break;
      await page.waitForTimeout(15000);
    }
    if (!synced) throw new Error("public index/CURRENT did not expose the synchronized 16:38 state");
    result.checks.publicStateSync = { passed: true, indexUrl, statusUrl, timestamp: "2026-10-03 16:38 +08:00" };

    await page.goto(publicUrl + "?final=" + Date.now(), { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.locator("#sampleRun").click();
    const screenshot = outDir + "/public-provenance-gate.png";
    await page.screenshot({ path: screenshot, fullPage: true });
    result.screenshot = { path: screenshot, sha256: sha256(screenshot) };
    result.passed = true;
  } catch (error) {
    result.passed = false;
    result.error = String(error && error.stack || error);
    await page.screenshot({ path: outDir + "/failure.png", fullPage: true }).catch(() => {});
  } finally {
    fs.writeFileSync(outDir + "/public-provenance-verification.json", JSON.stringify(result, null, 2) + "\n");
    await browser.close();
  }

  if (!result.passed) {
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
