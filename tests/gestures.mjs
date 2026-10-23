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
const checks = [];
const check = (v, t) => {
  if (!v) throw new Error(t);
  checks.push(t);
  console.log("PASS", t);
};
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  const p = await context.newPage();
  await p.goto("http://127.0.0.1:5173/");
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: "坐标定位", exact: true }).tap();
  const coords = await p.locator(".workspace-svg > g").evaluate((g) => {
    const m = g.getScreenCTM();
    return [
      new DOMPoint(60, 100).matrixTransform(m),
      new DOMPoint(150, 180).matrixTransform(m),
    ].map((q) => ({ x: q.x, y: q.y }));
  });
  const client = await context.newCDPSession(p);
  const before = await p
    .locator(".workspace-svg > g")
    .getAttribute("transform");
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: coords.map((q, i) => ({ ...q, id: i + 1 })),
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: coords.map((q, i) => ({
      x: q.x + (i ? 20 : -20),
      y: q.y + (i ? 20 : -20),
      id: i + 1,
    })),
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await p.waitForTimeout(200);
  check(
    before !==
      (await p.locator(".workspace-svg > g").getAttribute("transform")),
    "真实双指触摸缩放与平移生效",
  );
  check(
    (await p.locator("[data-object]").count()) === 0,
    "绘图工具下双指手势不误创建标记",
  );
  const tap = await p.locator(".workspace-svg > g").evaluate((g) => {
    const q = new DOMPoint(100, 100).matrixTransform(g.getScreenCTM());
    return { x: q.x, y: q.y };
  });
  await p.touchscreen.tap(tap.x, tap.y);
  check(
    (await p.locator("[data-object]").count()) === 1,
    "单指轻触精确创建坐标点",
  );
  check(
    await p.getByRole("button", { name: "打开项目", exact: true }).isVisible(),
    "手机可打开项目文件",
  );
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const d = await desktop.newPage();
  await d.goto("http://127.0.0.1:5173/");
  await d.waitForTimeout(400);
  await d.getByText("试用建筑构图示例").click();
  const handle = await d.locator('[data-corner="2"]').boundingBox();
  const x = handle.x + handle.width / 2,
    y = handle.y + handle.height / 2;
  await d.mouse.move(x, y);
  await d.mouse.down();
  await d.mouse.move(x + 35, y + 35, { steps: 8 });
  await d.mouse.up();
  check(
    Number(await d.getByLabel("图片宽度", { exact: true }).inputValue()) > 210,
    "图片四角拖动可等比放大",
  );
  const w = Number(
      await d.getByLabel("图片宽度", { exact: true }).inputValue(),
    ),
    h = Number(await d.getByLabel("图片高度", { exact: true }).inputValue());
  check(Math.abs(w / h - 0.75) < 1e-5, "四角缩放保持原始长宽比");
  await d.getByRole("button", { name: "撤销", exact: true }).click();
  check(
    Number(await d.getByLabel("图片宽度", { exact: true }).inputValue()) ===
      210,
    "图片缩放可整次撤销",
  );
  const at = async (x, y) =>
    d.locator(".workspace-svg > g").evaluate(
      (g, p) => {
        const q = new DOMPoint(p.x, p.y).matrixTransform(g.getScreenCTM());
        return { x: q.x, y: q.y };
      },
      { x, y },
    );
  const a = await at(100, 100),
    b = await at(110, 115);
  await d.mouse.move(a.x, a.y);
  await d.mouse.down();
  await d.mouse.move(b.x, b.y, { steps: 6 });
  await d.mouse.up();
  check(
    Math.abs(
      Number(await d.getByLabel("图片 X", { exact: true }).inputValue()) - 10,
    ) < 0.01,
    "拖动图片改变毫米位置",
  );
  await d.getByRole("button", { name: "锁定图片", exact: true }).click();
  const lockedX = await d.getByLabel("图片 X", { exact: true }).inputValue();
  await d.mouse.move(b.x, b.y);
  await d.mouse.down();
  await d.mouse.move(b.x + 40, b.y + 40, { steps: 4 });
  await d.mouse.up();
  check(
    (await d.getByLabel("图片 X", { exact: true }).inputValue()) === lockedX,
    "锁定图片防止误移动",
  );
  console.log(JSON.stringify({ checks: checks.length }));
} finally {
  await browser.close();
}
