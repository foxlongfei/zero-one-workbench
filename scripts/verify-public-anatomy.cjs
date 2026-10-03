const { chromium } = require("playwright");
const { PNG } = require("pngjs");
const pixelmatchModule = require("pixelmatch");
const pixelmatch = pixelmatchModule.default || pixelmatchModule;
const fs = require("fs");
const crypto = require("crypto");

const publicUrl = process.env.PUBLIC_URL || "https://foxlongfei.github.io/zero-one-workbench/portal/movement.html";
const outDir = process.env.EVIDENCE_DIR || "docs/v0.1/evidence/m2";
fs.mkdirSync(outDir, { recursive: true });

(async () => {
const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
    "--disable-gpu-sandbox"
  ]
});

const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 });
const result = {
  schema: "zero-one.m2.public-webgl-verification.v0.1",
  publicUrl,
  verifiedAt: new Date().toISOString(),
  gitSha: process.env.GITHUB_SHA || null,
  checks: {}
};

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function imageDiff(aPath, bPath, diffPath) {
  const a = PNG.sync.read(fs.readFileSync(aPath));
  const b = PNG.sync.read(fs.readFileSync(bPath));
  if (a.width !== b.width || a.height !== b.height) throw new Error("screenshot dimensions differ");
  const diff = new PNG({ width: a.width, height: a.height });
  const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
  fs.writeFileSync(diffPath, PNG.sync.write(diff));
  return { changedPixels: changed, totalPixels: a.width * a.height, ratio: changed / (a.width * a.height) };
}

try {
  await page.goto(publicUrl + "?m2verify=" + Date.now(), { waitUntil: "domcontentloaded", timeout: 180000 });
  const frameHost = page.locator("#humanAtlasFrame");
  const cdp = await page.context().newCDPSession(page);
  const frame = page.frameLocator("#humanAtlasFrame");
  await frame.getByText(/2,234\s+modeled pieces/).waitFor({ state: "visible", timeout: 180000 });
  result.checks.catalog = { passed: true, meshes: 2234, systems: 15 };

  const webglError = frame.getByText("This browser could not start the 3D viewer.");
  if (await webglError.count()) throw new Error("public viewer displayed WebGL startup error");

  const canvas = frame.locator("canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 180000 });
  await page.waitForTimeout(5000);
  let box = await canvas.boundingBox();
  if (!box || box.width < 300 || box.height < 300) throw new Error("3D canvas is missing or too small");
  result.checks.webglCanvas = { passed: true, width: box.width, height: box.height };

  const before = outDir + "/public-before.png";
  const rotated = outDir + "/public-after-rotate.png";
  const zoomed = outDir + "/public-after-zoom.png";
  async function captureRegion(region, path) {
    await region.evaluate(node => node.scrollIntoView({ block: "center", inline: "center" }));
    await page.waitForTimeout(500);
    const current = await region.boundingBox();
    const viewport = page.viewportSize();
    if (!current || !viewport) throw new Error("atlas frame bounds unavailable before capture");
    const viewportX = Math.max(0, current.x);
    const viewportY = Math.max(0, current.y);
    const width = Math.min(current.width - Math.max(0, -current.x), viewport.width - viewportX);
    const height = Math.min(current.height - Math.max(0, -current.y), viewport.height - viewportY);
    const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    const x = viewportX + scroll.x;
    const y = viewportY + scroll.y;
    if (width < 300 || height < 300) throw new Error("atlas frame visible clip is too small");
    const shot = await cdp.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: true,
      clip: { x, y, width, height, scale: 1 }
    });
    fs.writeFileSync(path, Buffer.from(shot.data, "base64"));
  }
  await captureRegion(frameHost, before);

  await frame.getByRole("button", { name: "Rotate body", exact: true }).click();
  await page.waitForTimeout(2500);
  await frame.getByRole("button", { name: "Pause rotation", exact: true }).click();
  await page.waitForTimeout(800);
  await captureRegion(frameHost, rotated);

  await canvas.hover();
  box = await canvas.boundingBox();
  if (!box) throw new Error("3D canvas bounding box disappeared before zoom");
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.wheel(0, -1200);
  await page.waitForTimeout(1500);
  await captureRegion(frameHost, zoomed);

  const rotateDiff = imageDiff(before, rotated, outDir + "/diff-rotate.png");
  const zoomDiff = imageDiff(rotated, zoomed, outDir + "/diff-zoom.png");
  if (rotateDiff.changedPixels < 1000) throw new Error("rotation did not materially change rendered pixels");
  if (zoomDiff.changedPixels < 1000) throw new Error("zoom did not materially change rendered pixels");
  result.checks.rotate = { passed: true, ...rotateDiff };
  result.checks.zoom = { passed: true, ...zoomDiff };

  await frame.getByRole("button", { name: "Skeleton", exact: true }).click();
  await frame.getByText("296 pieces visible", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  result.checks.systemLayer = { passed: true, preset: "Skeleton", visiblePieces: 296 };

  const bicepsState = page.locator("#realAssetState");
  await page.waitForFunction(() => document.querySelector("#realAssetState")?.dataset.status === "DISPLAYED" && document.querySelector("#realUpper3d")?.dataset.kinematicModel === "GROUP_LOCAL_PIVOT_V0.6", null, { timeout: 180000 });
  const bicepsMount = page.locator("#realUpper3d");
  const bicepsCanvas = bicepsMount.locator("canvas").first();
  await bicepsCanvas.waitFor({ state: "visible", timeout: 30000 });
  const bicepsBefore = outDir + "/biceps-before.png";
  const bicepsViewed = outDir + "/biceps-after-view.png";
  const bicepsPeak = outDir + "/biceps-after-peak.png";
  await captureRegion(bicepsMount, bicepsBefore);

  await page.locator("#armViewRange").evaluate(node => {
    node.value = "45";
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForTimeout(1200);
  const viewState = await page.locator("#armViewOut").evaluate(node => ({ mode: node.dataset.viewMode, angle: node.dataset.viewAngle, text: node.textContent }));
  if (viewState.mode !== "REAL_OBJ_ORBIT" || viewState.angle !== "45") throw new Error("BICEPS real OBJ view control did not enter +45 orbit");
  await captureRegion(bicepsMount, bicepsViewed);
  const bicepsViewDiff = imageDiff(bicepsBefore, bicepsViewed, outDir + "/diff-biceps-view.png");
  if (bicepsViewDiff.changedPixels < 500) throw new Error("BICEPS +45 real OBJ orbit did not materially change rendered pixels");
  result.checks.bicepsRealObjOrbit = { passed: true, ...viewState, ...bicepsViewDiff };

  await page.locator('.phasePreset[data-phase="屈肘峰值"]').click();
  await page.waitForTimeout(1200);
  const phaseState = await page.evaluate(() => ({
    phase: document.querySelector("#motionPhases")?.dataset.phase,
    elbow: document.querySelector("#realElbowRange")?.value,
    elbowOut: document.querySelector("#realElbowOut")?.textContent,
    forearm: document.querySelector("#realForearmRange")?.value,
    forearmOut: document.querySelector("#realForearmOut")?.textContent,
    assetStatus: document.querySelector("#realAssetState")?.dataset.status,
    kinematicModel: document.querySelector("#realUpper3d")?.dataset.kinematicModel,
    muscleModel: document.querySelector("#realUpper3d")?.dataset.muscleModel
  }));
  if (phaseState.phase !== "屈肘峰值" || phaseState.elbow !== "120" || phaseState.forearm !== "55" || phaseState.assetStatus !== "DISPLAYED" || phaseState.kinematicModel !== "GROUP_LOCAL_PIVOT_V0.6" || phaseState.muscleModel !== "CENTERED_LOCAL_WRAPPER") {
    throw new Error("BICEPS peak phase controls did not remain linked to displayed real OBJ");
  }
  await captureRegion(bicepsMount, bicepsPeak);
  const bicepsPhaseDiff = imageDiff(bicepsViewed, bicepsPeak, outDir + "/diff-biceps-peak.png");
  if (bicepsPhaseDiff.changedPixels < 500) throw new Error("BICEPS peak phase did not materially change rendered pixels");
  result.checks.bicepsPeakPhase = { passed: true, ...phaseState, ...bicepsPhaseDiff };

  await page.screenshot({ path: outDir + "/public-main-entry.png", fullPage: false });
  result.screenshots = {
    before: { path: before, sha256: sha256(before) },
    afterRotate: { path: rotated, sha256: sha256(rotated) },
    afterZoom: { path: zoomed, sha256: sha256(zoomed) },
    mainEntry: { path: outDir + "/public-main-entry.png", sha256: sha256(outDir + "/public-main-entry.png") },
    bicepsBefore: { path: bicepsBefore, sha256: sha256(bicepsBefore) },
    bicepsAfterView: { path: bicepsViewed, sha256: sha256(bicepsViewed) },
    bicepsAfterPeak: { path: bicepsPeak, sha256: sha256(bicepsPeak) }
  };
  result.passed = true;
} catch (error) {
  result.passed = false;
  result.error = String(error && error.stack || error);
  await page.screenshot({ path: outDir + "/failure.png", fullPage: false }).catch(() => {});
} finally {
  fs.writeFileSync(outDir + "/public-webgl-verification.json", JSON.stringify(result, null, 2) + "\n");
  await browser.close();
}

if (!result.passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
