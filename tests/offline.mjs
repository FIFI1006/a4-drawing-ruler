import { chromium } from "playwright-core";
import { existsSync, mkdirSync } from "node:fs";
mkdirSync("work", { recursive: true });
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : existsSync("/usr/bin/chromium")
      ? { executablePath: "/usr/bin/chromium" }
      : { channel: "chrome" }),
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const checks = [];
const check = (v, msg) => {
  if (!v) throw new Error(msg);
  checks.push(msg);
  console.log("PASS", msg);
};
try {
  await page.goto("http://127.0.0.1:4173/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForTimeout(700);
  check(
    await page.evaluate(() => !!navigator.serviceWorker.controller),
    "生产版 Service Worker 已激活并控制页面",
  );
  const paths = await page.evaluate(async () => {
    const cacheNames = await caches.keys();
    let urls = [];
    for (const n of cacheNames) {
      const c = await caches.open(n);
      urls.push(...(await c.keys()).map((r) => r.url));
    }
    return urls;
  });
  check(
    paths.some((p) => p.includes("jspdf.es.min")) &&
      paths.some((p) => p.includes("index-")),
    "离线缓存包含应用与延迟加载的 PDF 模块",
  );
  await context.setOffline(true);
  await page.reload();
  await page.getByText("试用建筑构图示例").click();
  check(
    (await page.locator("[data-image]").count()) === 1,
    "断网刷新后应用及内置示例可用",
  );
  await page.getByRole("button", { name: "导出", exact: true }).click();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 PDF", exact: true }).click();
  await (await dl).saveAs("work/offline.pdf");
  check(true, "离线首次 PDF 导出成功");
  check(errors.length === 0, "离线操作无浏览器异常");
  console.log(JSON.stringify({ checks: checks.length, errors }));
} finally {
  await browser.close();
}
