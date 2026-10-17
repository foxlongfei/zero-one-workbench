const { chromium } = require("playwright");
const fs = require("fs"),
  path = require("path");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const root = path.resolve(__dirname, "../../portal");
  async function run(project, page, fn) {
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      p = await context.newPage();
    try {
      await p.goto("file://" + path.join(root, page));
      await fn(p);
      fs.mkdirSync("reports/v02/screenshots", { recursive: true });
      await p.screenshot({
        path: "reports/v02/screenshots/" + project + "-mobile.png",
        fullPage: true,
      });
      results.push({ project, status: "PASS", page });
    } catch (e) {
      fs.mkdirSync("reports/v02/screenshots", { recursive: true });
      await p
        .screenshot({
          path: "reports/v02/screenshots/" + project + "-failure.png",
          fullPage: true,
        })
        .catch(() => {});
      results.push({ project, status: "FAIL", page, error: String(e) });
      process.exitCode = 1;
    } finally {
      await context.close();
    }
  }
  await run("A01", "movement-v02-experience.html", async (p) => {
    await p.locator("#start").click();
    await p.waitForTimeout(1100);
    if (!(await p.locator("#progress").innerText()).includes("/"))
      throw Error("training did not start");
    await p.locator("#completed").check();
    await p.locator("#save").click();
    if (!(await p.locator("#history").innerText()).includes("本机最近记录"))
      throw Error("training not saved");
  });
  await run("B01", "traditional-case-v02.html", async (p) => {
    await p.getByRole("button", { name: /失物/ }).click();
    await p.locator("#title").fill("钥匙遗失");
    await p.locator("#question").fill("昨天在客厅最后见到钥匙");
    await p.locator("#save").click();
    if (!(await p.locator("#history").innerText()).includes("钥匙遗失"))
      throw Error("case not saved");
    await p.locator("#openCase").selectOption({ index: 1 });
    await p.locator("#title").fill("临时改名");
    await p.locator("#loadCase").click();
    if ((await p.locator("#title").inputValue()) !== "钥匙遗失")
      throw Error("saved case did not reopen");
    await p.reload();
    await p.locator("#openCase").selectOption({ index: 1 });
    await p.locator("#loadCase").click();
    if (
      (await p.locator("#question").inputValue()) !== "昨天在客厅最后见到钥匙"
    )
      throw Error("case persistence failed after reload");
    await p.getByRole("button", { name: /住宅/ }).click();
    if (!(await p.locator("#kind").innerText()).includes("住宅"))
      throw Error("second domain unavailable");
  });
  await run("C01", "read-with-you-v01.html", async (p) => {
    if (!(await p.locator("#shelfScreen").isVisible()))
      throw Error("reader shelf absent");
    if ((await p.locator("#importButton").count()) !== 1)
      throw Error("book import control absent");
    const sample = p.getByRole("link", { name: /三章测试书/ });
    if ((await sample.count()) !== 1)
      throw Error("downloadable whole-book sample absent");
    if (!(await sample.getAttribute("href"))?.includes("zero-one-full-book-test.txt"))
      throw Error("whole-book sample link invalid");
  });
  await browser.close();
  fs.mkdirSync("reports/v02", { recursive: true });
  fs.writeFileSync(
    "reports/v02/browser-smoke.json",
    JSON.stringify(
      { test_type: "browser_smoke_not_double_blind", results },
      null,
      2,
    ),
  );
  console.log(results);
})();
