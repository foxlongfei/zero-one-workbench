const { chromium } = require("playwright");
const fs = require("fs");
const crypto = require("crypto");

const publicUrl = process.env.PUBLIC_URL || "https://foxlongfei.github.io/zero-one-workbench/portal/k02-board.html";
const outDir = process.env.EVIDENCE_DIR || "docs/v0.1/evidence/k4";
fs.mkdirSync(outDir, { recursive: true });
const sha256 = path => crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
  const result = {
    schema: "zero-one.k4.public-evidence-layer-verification.v0.1",
    publicUrl,
    verifiedAt: new Date().toISOString(),
    gitSha: process.env.GITHUB_SHA || null,
    checks: {}
  };
  try {
    let ready = false;
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      await page.goto(publicUrl + "?k4verify=" + Date.now(), { waitUntil: "domcontentloaded", timeout: 120000 });
      try {
        await page.waitForFunction(() => document.querySelector("#k4-evidence-layer")?.dataset.evidenceReady === "true", null, { timeout: 20000 });
        ready = true;
        result.checks.deploymentAttempt = attempt;
        break;
      } catch {}
      await page.waitForTimeout(15000);
    }
    if (!ready) throw new Error("public K4 evidence section did not load");
    const pageState = await page.locator("#k4-evidence-layer").evaluate(node => ({
      status: node.dataset.k4Status,
      caseId: node.dataset.caseId,
      geometryContinuity: node.dataset.geometryContinuity,
      recordCount: Number(node.dataset.recordCount),
      text: node.innerText
    }));
    if (pageState.recordCount !== 7) throw new Error("expected 7 evidence records");
    if (pageState.geometryContinuity !== "NOT_PROVEN") throw new Error("geometry continuity was overclaimed");
    const layers = await page.locator("#k4EvidenceList .evidence-item").evaluateAll(nodes => nodes.map(node => node.dataset.layer));
    for (const layer of ["COMPUTED_FACT","TRADITIONAL_TEXT","MODERN_HYPOTHESIS","UNVERIFIED_CLAIM"]) {
      if (!layers.includes(layer)) throw new Error("missing layer " + layer);
    }
    if (!pageState.text.includes("跨层等同默认 BLOCK")) throw new Error("cross-layer block is not visible");
    if (!pageState.text.includes("Connectivity or illuminance directly measures qi")) throw new Error("unverified equivalence record missing");
    const publicData = await page.evaluate(async () => {
      const r = await fetch("data/k4-evidence-layers.json?verify=" + Date.now(), { cache: "no-store" });
      return { status: r.status, json: await r.json() };
    });
    if (publicData.status !== 200) throw new Error("public K4 JSON HTTP " + publicData.status);
    if (!Object.values(publicData.json.checks || {}).every(Boolean)) throw new Error("public K4 data checks failed");
    if (publicData.json.caseBoundary.geometryContinuity !== "NOT_PROVEN") throw new Error("public case boundary mismatch");
    result.checks.publicPage = { passed: true, ...pageState, layers };
    result.checks.publicArtifact = {
      passed: true,
      httpStatus: publicData.status,
      schema: publicData.json.schema,
      records: publicData.json.layers.length,
      decisionRules: publicData.json.decisionRules.map(rule => rule.id)
    };
    const screenshot = outDir + "/public-evidence-layers.png";
    await page.locator("#k4-evidence-layer").screenshot({ path: screenshot });
    result.screenshot = { path: screenshot, sha256: sha256(screenshot) };
    result.passed = true;
  } catch (error) {
    result.passed = false;
    result.error = String(error && error.stack || error);
    await page.screenshot({ path: outDir + "/public-evidence-layer-failure.png", fullPage: true }).catch(() => {});
  } finally {
    fs.writeFileSync(outDir + "/public-evidence-layer-verification.json", JSON.stringify(result, null, 2) + "\n");
    await browser.close();
  }
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exit(1);
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
