const { chromium } = require("playwright");
const fs = require("fs");
const crypto = require("crypto");

const publicUrl = process.env.PUBLIC_URL || "https://foxlongfei.github.io/zero-one-workbench/portal/movement.html";
const outDir = process.env.EVIDENCE_DIR || "docs/v0.1/evidence/m3";
fs.mkdirSync(outDir, { recursive: true });
for (const entry of fs.readdirSync(outDir)) fs.rmSync(`${outDir}/${entry}`, { recursive: true, force: true });

const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--disable-gpu-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1 });
  const evidence = {
    schema: "zero-one.m3.public-pose-verification.v0.1",
    publicUrl,
    verifiedAt: new Date().toISOString(),
    gitSha: process.env.GITHUB_SHA || null,
    checks: {},
  };

  try {
    let deployed = false;
    for (let attempt = 1; attempt <= 24; attempt += 1) {
      await page.goto(`${publicUrl}?m3verify=${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 180000 });
      deployed = (await page.locator('body[data-m3-release="M3_POSE_FLOW_V0.2"] #poseSample').count()) === 1;
      if (deployed) break;
      await page.waitForTimeout(10000);
    }
    if (!deployed) throw new Error("public page did not expose the M3 real-sample control after deployment polling");

    await page.locator('#poseSample[data-model-ready="true"]').waitFor({ state: "visible", timeout: 180000 });
    await page.locator("#poseSample").click();
    await page.locator('body[data-m3-pose-state="passed"]').waitFor({ state: "attached", timeout: 180000 });

    const pose = await page.evaluate(() => {
      const result = document.querySelector("#poseResult");
      const joints = [...document.querySelectorAll("#jointMap [data-joint-id]")].map((node) => ({
        id: node.dataset.jointId,
        angle: Number(node.dataset.angle),
      }));
      const canvas = document.querySelector("#poseCanvas");
      const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      let paintedPixels = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) paintedPixels += 1;
      return {
        upstream: document.body.dataset.m3Upstream,
        poseCount: Number(result.dataset.poseCount),
        landmarkCount: Number(result.dataset.landmarkCount),
        worldLandmarkCount: Number(result.dataset.worldLandmarkCount),
        segmentationMaskCount: Number(result.dataset.segmentationMaskCount),
        meanVisibility: Number(result.dataset.meanVisibility),
        joints,
        paintedPixels,
        coordinateText: document.querySelector("#coordResult").textContent,
        feedbackText: document.querySelector("#motionFeedback").textContent,
      };
    });
    if (pose.upstream !== "MEDIAPIPE_POSE_LANDMARKER_FULL") throw new Error("unexpected pose upstream");
    if (pose.poseCount !== 1 || pose.landmarkCount !== 33 || pose.worldLandmarkCount !== 33) throw new Error("incomplete 2D/3D pose result");
    if (pose.segmentationMaskCount < 1) throw new Error("segmentation mask was not produced");
    if (pose.joints.length !== 6 || pose.joints.some((joint) => !Number.isFinite(joint.angle))) throw new Error("standard joint mapping is incomplete");
    if (pose.paintedPixels < 500) throw new Error("skeleton overlay did not paint enough pixels");
    if (!pose.coordinateText.includes("JOINT_RIGHT_ELBOW") || !pose.coordinateText.includes("world")) throw new Error("world coordinates did not return to the main page");
    evidence.checks.realImagePose = { passed: true, sample: "portal/assets/case2_12.jpg", ...pose };

    await page.locator("#wish").fill("15分钟在家练全身");
    await page.locator("#runWish").click();
    const naturalLanguageResult = await page.locator("#wishResult").textContent();
    if (!naturalLanguageResult.includes("15分钟全身") || !naturalLanguageResult.includes("深蹲")) throw new Error("natural-language path did not produce a plan");
    evidence.checks.naturalLanguage = { passed: true, input: "15分钟在家练全身", output: naturalLanguageResult.trim() };

    const shot = `${outDir}/public-real-image-result.png`;
    await page.locator("#poseStage").scrollIntoViewIfNeeded();
    await page.screenshot({ path: shot, fullPage: false });
    evidence.screenshot = { path: shot, sha256: sha256(shot) };
    evidence.passed = true;
  } catch (error) {
    evidence.passed = false;
    evidence.error = String(error && error.stack || error);
    await page.screenshot({ path: `${outDir}/failure.png`, fullPage: false }).catch(() => {});
  } finally {
    fs.writeFileSync(`${outDir}/public-pose-verification.json`, `${JSON.stringify(evidence, null, 2)}\n`);
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
