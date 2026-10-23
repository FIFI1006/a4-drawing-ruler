import { chromium } from "playwright-core";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
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
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2,
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const checks = [];
const assert = (v, msg) => {
  if (!v) throw new Error(msg);
  checks.push(msg);
  console.log("PASS", msg);
};
const commit = async (label, value) => {
  await page
    .getByRole("spinbutton", { name: label, exact: true })
    .fill(String(value));
  await page.getByRole("spinbutton", { name: label, exact: true }).press("Tab");
};
const model = async () =>
  page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open("a4-drawing-ruler", 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    return await new Promise((resolve, reject) => {
      const r = db
        .transaction("projects")
        .objectStore("projects")
        .get("current");
      r.onsuccess = () => {
        db.close();
        resolve(r.result);
      };
      r.onerror = () => reject(r.error);
    });
  });
const point = async (x, y) =>
  page.locator(".workspace-svg > g").evaluate(
    (g, p) => {
      const q = new DOMPoint(p.x, p.y).matrixTransform(g.getScreenCTM());
      return { x: q.x, y: q.y };
    },
    { x, y },
  );
const clickMm = async (x, y) => {
  const p = await point(x, y);
  await page.mouse.click(p.x, p.y);
};
const download = async (action, path) => {
  const promise = page.waitForEvent("download");
  await action();
  const d = await promise;
  await d.saveAs(path);
  return d;
};
try {
  await page.goto(process.env.TEST_URL || "http://127.0.0.1:5173/");
  await page.waitForTimeout(900);
  assert(
    (await page.locator(".canvas-size").textContent()).includes("210 × 297"),
    "初始纵向 A4 210 × 297 mm",
  );
  await page.getByRole("button", { name: "横向 A4", exact: true }).click();
  assert(
    (await page.locator(".canvas-size").textContent()).includes("297 × 210"),
    "横向 A4 297 × 210 mm",
  );
  await page.getByRole("button", { name: "纵向 A4", exact: true }).click();
  writeFileSync(
    "work/reference.svg",
    '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="#a2bbb0"/></svg>',
  );
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles("work/reference.svg");
  await page.getByLabel("图片 X", { exact: true }).waitFor();
  await commit("图片 X", -35.2);
  await commit("图片缩放", 140);
  await page.getByLabel("图片透明度", { exact: true }).fill("40");
  await page.waitForTimeout(900);
  let p = await model();
  assert(
    p.image.x === -35.2 &&
      Math.abs(p.image.width - 294) < 1e-8 &&
      p.image.opacity === 0.4,
    "图片数值位置、独立缩放及 40% 透明度",
  );
  assert(
    (await page.locator("[data-image]").getAttribute("opacity")) === "0.4",
    "图片透明度独立于网格",
  );
  await page.getByRole("button", { name: /标记与辅助线/ }).click();
  await page.getByRole("button", { name: "添加坐标点 A", exact: true }).click();
  await commit("新点 X", 110);
  await page.getByRole("button", { name: "添加坐标点 B", exact: true }).click();
  await page.getByRole("button", { name: "测距", exact: true }).click();
  await clickMm(10, 10);
  await clickMm(110, 10);
  assert(
    (await page.locator(".measurement-card").textContent()).includes("100.0"),
    "实测 (10,10) 到 (110,10) 为 100.0 mm",
  );
  await page.getByRole("button", { name: "放大工作区", exact: true }).click();
  assert(
    (await page.locator(".measurement-card").textContent()).includes("100.0"),
    "工作区缩放后测距不变",
  );
  await page.getByRole("button", { name: "选择 / 移动", exact: true }).click();
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  assert((await page.locator(".object-row").count()) === 2, "撤销删除最近测量");
  await page.getByRole("button", { name: "重做", exact: true }).click();
  assert((await page.locator(".object-row").count()) === 3, "重做恢复测量");
  await page.getByRole("button", { name: "直线", exact: true }).click();
  await clickMm(40, 70);
  await clickMm(100, 100);
  await commit("终点 X", 140);
  await commit("终点 Y", 70);
  assert(
    (await page.locator(".measurement-card").textContent()).includes("100.0"),
    "线段端点数值编辑正确",
  );
  await page.getByRole("button", { name: "水平辅助线", exact: true }).click();
  await clickMm(30, 60);
  await page.getByRole("button", { name: "垂直辅助线", exact: true }).click();
  await clickMm(35, 60);
  await page.getByRole("button", { name: "矩形", exact: true }).click();
  await clickMm(20, 150);
  await clickMm(80, 200);
  assert(
    (await page.locator(".measurement-card").textContent()).includes(
      "60.0 × 50.0",
    ),
    "矩形宽高正确",
  );
  await page.getByRole("button", { name: "横向 A4", exact: true }).click();
  await page.waitForTimeout(900);
  p = await model();
  assert(
    p.shapes.length === 7 && p.image.x === -35.2,
    "方向切换保留 7 个对象与图片状态",
  );
  await page.getByRole("button", { name: "纵向 A4", exact: true }).click();
  await page.getByRole("button", { name: "选择 / 移动", exact: true }).click();
  await page
    .getByRole("button", { name: "A 10.0, 10.0 mm", exact: true })
    .click();
  const a = await point(10, 10),
    b = await point(20, 20);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  p = await model();
  assert(Math.abs(p.shapes[0].a.x - 20) < 0.01, "拖动标记点改变毫米坐标");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await page.waitForTimeout(800);
  p = await model();
  assert(p.shapes[0].a.x === 10, "单次撤销恢复整次拖动");
  const before = JSON.stringify(p);
  await page.reload();
  await page.waitForTimeout(1000);
  assert(
    JSON.stringify(await model()) === before,
    "刷新后 IndexedDB 完整恢复项目",
  );
  await download(
    () => page.getByRole("button", { name: "保存项目", exact: true }).click(),
    "work/roundtrip.a4r",
  );
  assert(readFileSync("work/roundtrip.a4r").length > 1000, "完整项目 ZIP 下载");
  await page.getByRole("button", { name: "导出", exact: true }).click();
  await download(
    () => page.getByRole("button", { name: "导出 PDF", exact: true }).click(),
    "work/portrait.pdf",
  );
  assert(
    readFileSync("work/portrait.pdf").subarray(0, 4).toString() === "%PDF",
    "A4 PDF 实际导出成功",
  );
  await page.getByRole("button", { name: "横向 A4", exact: true }).click();
  await page.getByRole("button", { name: "导出", exact: true }).click();
  await download(
    () => page.getByRole("button", { name: "导出 PDF", exact: true }).click(),
    "work/landscape.pdf",
  );
  await page.getByRole("button", { name: "导出", exact: true }).click();
  await page.getByRole("button", { name: "PNG 图片 高清图像" }).click();
  await download(
    () => page.getByRole("button", { name: "导出 PNG", exact: true }).click(),
    "work/export.png",
  );
  const png = readFileSync("work/export.png");
  const meta = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
  assert(
    meta.width === 3508 && meta.height === 2480,
    "横向 300 DPI PNG 为 3508 × 2480",
  );
  await page.getByRole("button", { name: "导出", exact: true }).click();
  await page.getByRole("button", { name: "坐标 CSV 标记与端点" }).click();
  await download(
    () => page.getByRole("button", { name: "导出 CSV", exact: true }).click(),
    "work/coordinates.csv",
  );
  assert(
    readFileSync("work/coordinates.csv", "utf8").includes("110.0000"),
    "CSV 包含精确毫米端点",
  );
  await page
    .locator("input[type=file]")
    .nth(1)
    .setInputFiles("work/roundtrip.a4r");
  await page.waitForTimeout(1000);
  p = await model();
  assert(
    p.orientation === "portrait" &&
      p.shapes.length === 7 &&
      p.image.opacity === 0.4,
    "项目文件导入完整恢复方向、图片、辅助线",
  );
  assert(errors.length === 0, "浏览器无未捕获异常");
  await page.screenshot({ path: "work/desktop-tested.png" });
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const mp = await mobile.newPage();
  await mp.goto(process.env.TEST_URL || "http://127.0.0.1:5173/");
  await mp.waitForTimeout(500);
  assert(
    (await mp.locator(".properties-panel").count()) === 0,
    "手机默认折叠属性面板",
  );
  assert(
    await mp.evaluate(
      () => document.documentElement.scrollWidth === innerWidth,
    ),
    "手机页面无水平溢出",
  );
  await mp.screenshot({ path: "work/mobile.png" });
  await mp.getByRole("button", { name: "展开属性面板", exact: true }).click();
  assert(
    await mp.locator(".properties-panel").isVisible(),
    "手机可展开属性面板",
  );
  await mobile.close();
  console.log(JSON.stringify({ checks: checks.length, errors }));
} finally {
  await browser.close();
}
