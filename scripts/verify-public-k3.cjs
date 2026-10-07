const { chromium } = require("playwright");
const fs = require("fs");
const crypto = require("crypto");

const publicUrl = process.env.PUBLIC_URL || "https://foxlongfei.github.io/zero-one-workbench/portal/k02-board.html";
const outDir = process.env.EVIDENCE_DIR || "docs/v0.1/evidence/k3";
fs.mkdirSync(outDir, { recursive: true });
const sha256 = path => crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const result = {
    schema: "zero-one.k3.public-radiance-verification.v0.1",
    publicUrl,
    verifiedAt: new Date().toISOString(),
    gitSha: process.env.GITHUB_SHA || null,
    checks: {}
  };
  try {
    let ready = false;
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      await page.goto(publicUrl + "?k3verify=" + Date.now(), { waitUntil: "domcontentloaded", timeout: 120000 });
      try {
        await page.waitForFunction(() => document.querySelector("#k3-environment-engine")?.dataset.engineReady === "true", null, { timeout: 20000 });
        ready = true;
        result.checks.deploymentAttempt = attempt;
        break;
      } catch {}
      await page.waitForTimeout(15000);
    }
    if (!ready) throw new Error("public K3 Radiance section did not load the real artifact");

    const pageState = await page.locator("#k3-environment-engine").evaluate(node => ({
      status: node.dataset.k3Status,
      calculationId: node.dataset.calculationId,
      engineVersion: node.dataset.engineVersion,
      sensorCount: Number(node.dataset.sensorCount),
      unit: node.dataset.unit,
      meanLux: Number(node.dataset.meanLux),
      minimumLux: Number(node.dataset.minimumLux),
      maximumLux: Number(node.dataset.maximumLux),
      nearWindowMeanLux: Number(node.dataset.nearWindowMeanLux),
      deepZoneMeanLux: Number(node.dataset.deepZoneMeanLux),
      text: node.innerText
    }));
    if (!pageState.engineVersion.includes("RADIANCE 6.0.2")) throw new Error("wrong Radiance version");
    if (pageState.sensorCount !== 20 || pageState.unit !== "lux") throw new Error("sensor/unit gate failed");
    if (!(pageState.maximumLux > pageState.meanLux && pageState.meanLux > pageState.minimumLux)) throw new Error("summary ordering failed");
    if (!(pageState.nearWindowMeanLux > pageState.deepZoneMeanLux)) throw new Error("daylight depth gradient failed");
    if (!pageState.text.includes("模型 SHA-256") || !pageState.text.includes("gensky → oconv → rtrace")) throw new Error("public provenance is incomplete");
    const cells = await page.locator("#radianceHeatmap .daylight-cell").count();
    if (cells !== 20) throw new Error("heatmap must contain 20 real sensors");

    const publicData = await page.evaluate(async () => {
      const r = await fetch("data/k3-radiance-daylight.json?verify=" + Date.now(), { cache: "no-store" });
      return { status: r.status, json: await r.json() };
    });
    if (publicData.status !== 200 || publicData.json.passed !== true) throw new Error("public JSON gate failed");
    if (publicData.json.model.sha256 !== "513601ce6db129f984eca410c539e90eb2e5eb90c245566d461d40013cb04615") throw new Error("model hash mismatch");
    if (publicData.json.analysis.sensors.length !== 20) throw new Error("public sensor product incomplete");
    result.checks.publicPage = { passed: true, ...pageState, heatmapCells: cells };
    result.checks.publicArtifact = {
      passed: true,
      httpStatus: publicData.status,
      modelSha256: publicData.json.model.sha256,
      engine: publicData.json.engine.version,
      summary: publicData.json.analysis.summary
    };
    const screenshot = outDir + "/public-radiance-daylight.png";
    await page.locator("#k3-environment-engine").screenshot({ path: screenshot });
    result.screenshot = { path: screenshot, sha256: sha256(screenshot) };
    result.passed = true;
  } catch (error) {
    result.passed = false;
    result.error = String(error && error.stack || error);
    await page.screenshot({ path: outDir + "/public-radiance-failure.png", fullPage: true }).catch(() => {});
  } finally {
    fs.writeFileSync(outDir + "/public-radiance-verification.json", JSON.stringify(result, null, 2) + "\n");
    await browser.close();
  }
  if (!result.passed) {
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
