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
  async function captureCanvas(path) {
    const current = await canvas.boundingBox();
    if (!current) throw new Error("3D canvas bounding box disappeared before capture");
    await page.screenshot({
      path,
      clip: { x: current.x, y: current.y, width: current.width, height: current.height },
      animations: "disabled",
      caret: "hide",
      captureBeyondViewport: true
    });
  }
  await captureCanvas(before);

  await frame.getByRole("button", { name: "Rotate body", exact: true }).click();
  await page.waitForTimeout(2500);
  await frame.getByRole("button", { name: "Pause rotation", exact: true }).click();
  await page.waitForTimeout(800);
  await captureCanvas(rotated);

  await canvas.hover();
  box = await canvas.boundingBox();
  if (!box) throw new Error("3D canvas bounding box disappeared before zoom");
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.wheel(0, -1200);
  await page.waitForTimeout(1500);
  await captureCanvas(zoomed);

  const rotateDiff = imageDiff(before, rotated, outDir + "/diff-rotate.png");
  const zoomDiff = imageDiff(rotated, zoomed, outDir + "/diff-zoom.png");
  if (rotateDiff.changedPixels < 1000) throw new Error("rotation did not materially change rendered pixels");
  if (zoomDiff.changedPixels < 1000) throw new Error("zoom did not materially change rendered pixels");
  result.checks.rotate = { passed: true, ...rotateDiff };
  result.checks.zoom = { passed: true, ...zoomDiff };

  await frame.getByRole("button", { name: "Skeleton", exact: true }).click();
  await frame.getByText("296 pieces visible", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  result.checks.systemLayer = { passed: true, preset: "Skeleton", visiblePieces: 296 };

  await page.screenshot({ path: outDir + "/public-main-entry.png", fullPage: false });
  result.screenshots = {
    before: { path: before, sha256: sha256(before) },
    afterRotate: { path: rotated, sha256: sha256(rotated) },
    afterZoom: { path: zoomed, sha256: sha256(zoomed) },
    mainEntry: { path: outDir + "/public-main-entry.png", sha256: sha256(outDir + "/public-main-entry.png") }
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
