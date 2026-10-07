const { chromium } = require("playwright");
const fs = require("fs");
const crypto = require("crypto");

const publicUrl = process.env.PUBLIC_URL || "https://foxlongfei.github.io/zero-one-workbench/portal/k02-board.html";
const outDir = process.env.EVIDENCE_DIR || "docs/v0.1/evidence/k5";
fs.mkdirSync(outDir, { recursive: true });
const sha256 = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });
  const result = {
    schema: "zero-one.k5.public-advisor-verification.v0.1",
    publicUrl,
    verifiedAt: new Date().toISOString(),
    gitSha: process.env.GITHUB_SHA || null,
    checks: {}
  };
  try {
    let ready = false;
    for (let attempt = 1; attempt <= 12; attempt += 1) {
      await page.goto(publicUrl + "?k5verify=" + Date.now(), { waitUntil: "domcontentloaded", timeout: 120000 });
      try {
        await page.waitForFunction(() => {
          const node = document.querySelector("#k5-advisor");
          return node?.dataset.artifactReady === "true" && node?.dataset.k5Status === "COMPLETED";
        }, null, { timeout: 20000 });
        ready = true;
        result.checks.deploymentAttempt = attempt;
        break;
      } catch {}
      await page.waitForTimeout(15000);
    }
    if (!ready) throw new Error("public K5 completed section did not load");

    await page.getByRole("button", { name: "运行住宅A完整反馈", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("#k5-advisor")?.dataset.executed === "true");

    const section = page.locator("#k5-advisor");
    const pageState = await section.evaluate(node => ({
      status: node.dataset.k5Status,
      artifactReady: node.dataset.artifactReady,
      executed: node.dataset.executed,
      caseId: node.dataset.caseId,
      runtimeSha: node.dataset.runtimeSha,
      geometryContinuity: node.dataset.geometryContinuity,
      crossLayerEquivalence: node.dataset.crossLayerEquivalence,
      text: node.innerText
    }));
    if (pageState.status !== "COMPLETED") throw new Error("K5 status is not COMPLETED");
    if (pageState.geometryContinuity !== "NOT_PROVEN") throw new Error("geometry continuity was overclaimed");
    if (pageState.crossLayerEquivalence !== "BLOCK") throw new Error("cross-layer equivalence was not blocked");
    for (const required of ["263", "124.8", "20", "771.6", "1049.2", "494", "午", "180°"]) {
      if (!pageState.text.includes(required)) throw new Error("missing visible model result " + required);
    }

    const feedbackIds = await page.locator("#k5Feedback .advisor-item").evaluateAll(nodes => nodes.map(node => node.dataset.feedbackId));
    if (feedbackIds.length !== 3) throw new Error("expected 3 feedback items");
    const buttons = await page.locator("#k5Followups .k5-followup").all();
    if (buttons.length !== 3) throw new Error("expected 3 follow-up controls");
    const replies = [];
    for (const button of buttons) {
      const question = await button.innerText();
      await button.click();
      const answer = await page.locator("#k5Answer").innerText();
      if (!answer.includes("证据：")) throw new Error("follow-up answer lacks evidence IDs");
      replies.push({ question, answer });
    }
    if (new Set(replies.map(item => item.answer)).size !== 3) throw new Error("follow-up answers are not distinct");

    const publicData = await page.evaluate(async () => {
      const dataResponse = await fetch("data/k5-advisor-case.json?verify=" + Date.now(), { cache: "no-store" });
      const reportResponse = await fetch("../docs/v0.1/K5-completion-report-2026-10-08.md?verify=" + Date.now(), { cache: "no-store" });
      return {
        dataStatus: dataResponse.status,
        json: await dataResponse.json(),
        reportStatus: reportResponse.status
      };
    });
    if (publicData.dataStatus !== 200) throw new Error("public K5 JSON HTTP " + publicData.dataStatus);
    if (publicData.reportStatus !== 200) throw new Error("public K5 report HTTP " + publicData.reportStatus);
    if (publicData.json.status !== "COMPLETED" || publicData.json.runtime?.actualRun !== true) {
      throw new Error("public K5 runtime artifact is not complete");
    }
    if (!Object.values(publicData.json.checks || {}).every(Boolean)) throw new Error("public K5 artifact checks failed");
    if (publicData.json.runtime.sourceArtifacts.length !== 3) throw new Error("expected three runtime source artifacts");

    result.checks.publicPage = { passed: true, ...pageState, feedbackIds, replies };
    result.checks.publicArtifact = {
      passed: true,
      httpStatus: publicData.dataStatus,
      reportHttpStatus: publicData.reportStatus,
      schema: publicData.json.schema,
      status: publicData.json.status,
      sourceArtifacts: publicData.json.runtime.sourceArtifacts,
      feedbackItems: publicData.json.advisorFeedback.length,
      followUps: publicData.json.followUps.length
    };
    const screenshot = outDir + "/public-advisor-closure.png";
    await section.screenshot({ path: screenshot });
    result.screenshot = { path: screenshot, sha256: sha256(screenshot) };
    result.passed = true;
  } catch (error) {
    result.passed = false;
    result.error = String(error && error.stack || error);
    await page.screenshot({ path: outDir + "/public-advisor-failure.png", fullPage: true }).catch(() => {});
  } finally {
    fs.writeFileSync(outDir + "/public-advisor-verification.json", JSON.stringify(result, null, 2) + "\n");
    await browser.close();
  }
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exit(1);
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
