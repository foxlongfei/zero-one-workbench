const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const publicUrl = process.env.PUBLIC_URL || "https://foxlongfei.github.io/zero-one-workbench/portal/movement.html";
const outDir = process.env.EVIDENCE_DIR || "docs/v0.1/evidence/m5";
fs.mkdirSync(outDir, { recursive: true });

async function uploadPose(page, fixturePath, expectedName) {
  await page.locator("#poseFile").setInputFiles(fixturePath);
  await page.locator(`body[data-m3-pose-state="passed"][data-m3-pose-input="user-upload"][data-m3-pose-file="${expectedName}"]`).waitFor({ state: "attached", timeout: 180000 });
  const pose = await page.evaluate(() => ({
    source: document.body.dataset.m3Upstream,
    inputSource: document.body.dataset.m3PoseInput,
    inputName: document.body.dataset.m3PoseFile,
    landmarkCount: Number(document.querySelector("#poseResult").dataset.landmarkCount),
    worldLandmarkCount: Number(document.querySelector("#poseResult").dataset.worldLandmarkCount),
    rightElbow: Number(document.querySelector('#jointMap [data-joint-id="JOINT_RIGHT_ELBOW"]').dataset.angle)
  }));
  if (pose.source !== "MEDIAPIPE_POSE_LANDMARKER_FULL" || pose.inputSource !== "user-upload" || pose.inputName !== expectedName || pose.landmarkCount !== 33 || pose.worldLandmarkCount !== 33 || !Number.isFinite(pose.rightElbow)) {
    throw new Error(`user-upload pose failed for ${expectedName}: ${JSON.stringify(pose)}`);
  }
  return pose;
}

async function plan(page, input, expectedScenario, expectedActions, feedback, decision, expectedPose) {
  const expectedOpenSimState = [0, 30, 60, 90, 120].reduce((best, angle) =>
    Math.abs(angle - expectedPose.rightElbow) < Math.abs(best - expectedPose.rightElbow) ? angle : best
  );
  await page.locator("#wish").fill(input);
  await page.locator("#runWish").click();
  await page.locator('body[data-m5-state="plan-ready"]').waitFor({ state: "attached" });
  const before = await page.evaluate(() => ({
    scenario: document.body.dataset.m5Scenario,
    integration: document.body.dataset.m5Integration,
    poseSource: document.body.dataset.m5PoseSource,
    poseInput: document.body.dataset.m5PoseInput,
    mappedElbow: Number(document.body.dataset.m5MappedElbow),
    openSimState: Number(document.body.dataset.m5OpenSimState),
    integratedText: document.querySelector("#m5IntegratedEvidence").textContent.trim(),
    parsed: document.querySelector("#m5Parsed").textContent.trim(),
    result: document.querySelector("#wishResult").textContent.trim(),
    actions: [...document.querySelectorAll("#m5Actions .m5-action")].map((node) => node.textContent.trim()),
    feedbackHidden: document.querySelector("#m5FeedbackPanel").hidden
  }));
  if (before.scenario !== expectedScenario) throw new Error(`scenario mismatch: ${before.scenario}`);
  if (before.integration !== "linked") throw new Error(`M2/M3/M4 integration not linked: ${before.integration}`);
  if (before.poseSource !== "current-page-pose" || before.poseInput !== "user-upload") throw new Error(`training loop did not consume user-upload pose: ${before.poseSource}/${before.poseInput}`);
  if (before.mappedElbow !== expectedPose.rightElbow || before.openSimState !== expectedOpenSimState) throw new Error(`unexpected pose-to-OpenSim mapping: ${before.mappedElbow} -> ${before.openSimState}; expected ${expectedPose.rightElbow} -> ${expectedOpenSimState}`);
  if (!before.integratedText.includes("2234 个网格 / 15 个系统") || !before.integratedText.includes("当前页用户上传动作") || !before.integratedText.includes("M4 OpenSim") || !before.integratedText.includes(`映射最近状态 ${expectedOpenSimState}°`)) {
    throw new Error("integrated M2/M3/M4 evidence values missing");
  }
  if (before.actions.length !== expectedActions) throw new Error(`action count mismatch: ${before.actions.length}`);
  if (!before.parsed.includes("身体：") || !before.parsed.includes("目的：") || !before.parsed.includes("时间：") || !before.parsed.includes("环境：") || !before.parsed.includes("器械：") || !before.parsed.includes("限制：")) throw new Error("parsed fields missing");
  if (!before.actions.every((text) => text.includes("示范：") && text.includes("解剖：") && text.includes("关节：") && text.includes("技术："))) throw new Error("action explanation incomplete");
  if (!before.feedbackHidden) throw new Error("feedback was available before session completion");

  await page.locator("#m5CompleteSession").click();
  await page.locator('body[data-m5-state="awaiting-feedback"]').waitFor({ state: "attached" });
  await page.locator(`.feedback[data-v="${feedback}"]`).click();
  await page.locator(`body[data-m5-decision="${decision}"]`).waitFor({ state: "attached" });
  const after = await page.evaluate(() => ({
    state: document.body.dataset.m5State,
    decision: document.body.dataset.m5Decision,
    feedback: document.querySelector("#feedbackResult").textContent.trim()
  }));
  if (!after.feedback.includes("闭环记录：输入")) throw new Error("feedback loop record missing");
  return { input, before, feedback, after };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const evidence = {
    schema: "zero-one.m5.public-training-loop-verification.v0.1",
    publicUrl,
    verifiedAt: new Date().toISOString(),
    gitSha: process.env.GITHUB_SHA || null,
    checks: {}
  };

  try {
    let deployed = false;
    let deploymentProbe = null;
    for (let attempt = 1; attempt <= 18; attempt += 1) {
      const response = await page.goto(`${publicUrl}?m5verify=${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 180000 });
      await page.locator("#m5-training-loop").waitFor({ state: "attached", timeout: 15000 }).catch(() => {});
      deploymentProbe = await page.evaluate(() => ({
        title: document.title,
        release: document.body.dataset.m5Release || null,
        build: document.body.dataset.m5Build || null,
        trainingLoopCount: document.querySelectorAll("#m5-training-loop").length
      }));
      deploymentProbe.attempt = attempt;
      deploymentProbe.httpStatus = response?.status() || null;
      if (deploymentProbe.release === "M5_TRAINING_LOOP_V0.1" && deploymentProbe.build === "M5_USER_UPLOAD_CHAIN_V0.1" && deploymentProbe.trainingLoopCount === 1) {
        deployed = true;
        break;
      }
      await page.waitForTimeout(10000);
    }
    evidence.checks.deploymentProbe = deploymentProbe;
    if (!deployed) throw new Error(`public page did not expose the M5 release: ${JSON.stringify(deploymentProbe)}`);

    await page.locator('#poseFile[data-model-ready="true"]').waitFor({ state: "attached", timeout: 180000 });
    const uploadFixtures = [
      { path: path.resolve(__dirname, "../portal/assets/case2_12.jpg"), name: "case2_12.jpg", source: "existing-real-pose-fixture" },
      { path: path.resolve(__dirname, "../portal/assets/mediapipe-pose-test-image.jpg"), name: "mediapipe-pose-test-image.jpg", source: "google-ai-edge/mediapipe-samples PoseLandmarkerTests" }
    ];
    evidence.checks.uploadSamples = [];
    for (const fixture of uploadFixtures) {
      const pose = await uploadPose(page, fixture.path, fixture.name);
      evidence.checks.uploadSamples.push({ ...pose, fixtureSource: fixture.source });
    }
    if (evidence.checks.uploadSamples[0].rightElbow !== 105) throw new Error("first upload fixture regression");
    evidence.checks.currentPagePose = evidence.checks.uploadSamples[1];

    evidence.checks.outdoorPullup = await plan(page, "户外有单杠，想练背和手臂，15分钟", "outdoor-pullup", 4, "偏吃力", "REGRESS", evidence.checks.currentPagePose);
    evidence.checks.homeWholeBody = await plan(page, "15分钟在家徒手练全身", "home-whole-body-15", 5, "轻松", "PROGRESS_SMALL", evidence.checks.currentPagePose);

    await page.locator("#wish").fill("想去户外练单杠，但现在右手麻木并且胸闷");
    await page.locator("#runWish").click();
    await page.locator('body[data-m5-state="safety-triage"]').waitFor({ state: "attached" });
    const safety = await page.evaluate(() => ({
      state: document.body.dataset.m5State,
      result: document.querySelector("#wishResult").textContent.trim(),
      parsed: document.querySelector("#m5Parsed").textContent.trim(),
      actions: document.querySelector("#m5Actions").textContent.trim(),
      session: document.querySelector("#m5Session").textContent.trim(),
      feedbackHidden: document.querySelector("#m5FeedbackPanel").hidden
    }));
    if (!safety.result.includes("安全分流") || !safety.result.includes("停止生成推进性训练计划")) throw new Error("safety routing missing");
    if (!safety.parsed.includes("麻") || !safety.parsed.includes("胸闷")) throw new Error("safety signals missing");
    if (!safety.feedbackHidden || !safety.session.includes("安全分流优先")) throw new Error("unsafe plan was allowed to continue");
    evidence.checks.safetyTriage = safety;

    evidence.passed = true;
    await page.locator("#m5-training-loop").screenshot({ path: `${outDir}/public-training-loop.png` });
  } catch (error) {
    evidence.passed = false;
    evidence.error = String((error && error.stack) || error);
    await page.screenshot({ path: `${outDir}/failure.png`, fullPage: false }).catch(() => {});
  } finally {
    fs.writeFileSync(`${outDir}/public-training-loop-verification.json`, `${JSON.stringify(evidence, null, 2)}\n`);
    await browser.close();
  }

  if (!evidence.passed) {
    console.error(JSON.stringify(evidence, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(evidence, null, 2));
})().catch((error) => {
  console.error((error && error.stack) || error);
  process.exit(1);
});
