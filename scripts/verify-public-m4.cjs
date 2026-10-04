const { chromium } = require("playwright");
const fs = require("fs");

const publicUrl = process.env.PUBLIC_URL || "https://foxlongfei.github.io/zero-one-workbench/portal/movement.html";
const outDir = process.env.EVIDENCE_DIR || "docs/v0.1/evidence/m4";
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const evidence = {
    schema: "zero-one.m4.public-opensim-verification.v0.1",
    publicUrl,
    verifiedAt: new Date().toISOString(),
    gitSha: process.env.GITHUB_SHA || null,
    checks: {},
  };

  try {
    let deployed = false;
    for (let attempt = 1; attempt <= 30; attempt += 1) {
      await page.goto(`${publicUrl}?m4verify=${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 180000 });
      deployed = (await page.locator('body[data-m4-release="M4_OPENSIM_CORE_V0.1"] #m4-biomechanics').count()) === 1;
      if (deployed) break;
      await page.waitForTimeout(10000);
    }
    if (!deployed) throw new Error("public page did not expose the M4 release after deployment polling");

    await page.locator('body[data-m4-state="ready"]').waitFor({ state: "attached", timeout: 120000 });
    const initial = await page.evaluate(() => ({
      release: document.body.dataset.m4Release,
      calculation: document.body.dataset.m4Calculation,
      status: document.querySelector("#m4Status").textContent,
      angle: Number(document.querySelector("#m4Result").dataset.angleDeg),
      muscles: [...document.querySelectorAll("#m4Result [data-m4-muscle]")].map((node) => node.textContent.trim()),
      source: document.querySelector("#m4Source").textContent,
    }));
    if (initial.release !== "M4_OPENSIM_CORE_V0.1") throw new Error("unexpected M4 release");
    if (initial.calculation !== "OPENSIM46_ARM26_ELBOW_POSITION_GRID_V0.1") throw new Error("unexpected calculation artifact");
    if (!initial.status.includes("OpenSim Core") || !initial.status.includes("5 个状态 × 6 条肌肉")) throw new Error("engine summary missing");
    if (initial.angle !== 90 || initial.muscles.length !== 6) throw new Error("default state was not rendered");
    if (!initial.muscles.some((text) => text.includes("BIClong") && text.includes("0.373656 m") && text.includes("0.048753 m"))) throw new Error("BIClong 90 degree result mismatch");
    if (!initial.source.includes("Arm26") || !initial.source.includes("SHA-256") || !initial.source.includes("degree/radian")) throw new Error("source/model/units missing");

    await page.locator('[data-m4-angle="120"]').click();
    const selected = await page.evaluate(() => ({
      angle: Number(document.querySelector("#m4Result").dataset.angleDeg),
      biceps: document.querySelector('[data-m4-muscle="BIClong"]').textContent.trim(),
    }));
    if (selected.angle !== 120 || !selected.biceps.includes("0.348258 m")) throw new Error("120 degree state did not update from real artifact");

    evidence.checks.publicPage = { passed: true, initial, selected };
    evidence.passed = true;
    await page.locator("#m4-biomechanics").screenshot({ path: `${outDir}/public-opensim-result.png` });
  } catch (error) {
    evidence.passed = false;
    evidence.error = String((error && error.stack) || error);
    await page.screenshot({ path: `${outDir}/failure.png`, fullPage: false }).catch(() => {});
  } finally {
    fs.writeFileSync(`${outDir}/public-opensim-verification.json`, `${JSON.stringify(evidence, null, 2)}\n`);
    await browser.close();
  }

  if (!evidence.passed) {
    console.error(JSON.stringify(evidence, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(evidence, null, 2));
})().catch((error) => {
  console.error(error && error.stack || error);
  process.exit(1);
});
