import { chromium } from "playwright-core";
import { isDeepStrictEqual } from "node:util";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
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
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let count = 0;
const check = (v, t) => {
  if (!v) throw new Error(t);
  count++;
  console.log("PASS", t);
};
const pause = () => page.waitForTimeout(100);
const saved = async () => {
  await page.getByText("已本地保存", { exact: true }).waitFor();
};
const documentData = async () => {
  await saved();
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open("a4-drawing-ruler", 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    return new Promise((resolve, reject) => {
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
};
const prefs = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("a4-ui-preferences-v2")));
const field = async (label, v) => {
  const input = page.getByRole("spinbutton", { name: label, exact: true });
  await input.fill(String(v));
  await input.press("Tab");
};
const at = async (x, y) =>
  page.locator(".workspace-svg>g").evaluate(
    (g, p) => {
      const q = new DOMPoint(p.x, p.y).matrixTransform(g.getScreenCTM());
      return { x: q.x, y: q.y };
    },
    { x, y },
  );
const clickMm = async (x, y) => {
  const q = await at(x, y);
  await page.mouse.click(q.x, q.y);
};
const transform = () =>
  page.locator(".workspace-svg>g").getAttribute("transform");
const drag = async (a, b) => {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
};
const settings = () =>
  page.getByRole("button", { name: "设置与屏幕校准", exact: true }).click();
const done = () =>
  page.getByRole("button", { name: "完成", exact: true }).click();
const download = async (action, file) => {
  const promise = page.waitForEvent("download");
  await action();
  await (await promise).saveAs(file);
};
const pixel = async (file) =>
  page.evaluate(async (base64) => {
    const im = new Image();
    await new Promise((resolve, reject) => {
      im.onload = resolve;
      im.onerror = reject;
      im.src = "data:image/png;base64," + base64;
    });
    const c = document.createElement("canvas");
    c.width = 2;
    c.height = 2;
    const ctx = c.getContext("2d");
    ctx.drawImage(im, 100, 100, 1, 1, 0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data];
  }, readFileSync(file).toString("base64"));
try {
  await page.goto(process.env.TEST_URL || "http://127.0.0.1:5173/");
  await saved();
  let before = await documentData(),
    view = await transform();
  const box = await page.locator(".workspace").boundingBox();
  const a = { x: box.x + 20, y: box.y + 100 },
    b = { x: a.x + 60, y: a.y + 40 };
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  check(
    await page
      .locator(".workspace")
      .evaluate((el) => el.classList.contains("is-panning")),
    "左键拖动空白工作区显示抓手",
  );
  await page.mouse.move(b.x, b.y, { steps: 10 });
  await page.mouse.up();
  check(view !== (await transform()), "左键拖动背景平移画纸与标尺");
  check(
    isDeepStrictEqual(before, await documentData()),
    "平移不修改任何项目毫米数据",
  );
  const stop = await transform();
  await page.mouse.move(b.x + 20, b.y + 10);
  check(stop === (await transform()), "松开左键立即停止平移");
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 20, a.y + 10);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await pause();
  const blurView = await transform();
  await page.mouse.move(a.x + 50, a.y + 30);
  await page.mouse.up();
  check(
    blurView === (await transform()),
    "窗口失去焦点后停止平移，避免释放鼠标后继续拖动",
  );

  view = await transform();
  await drag(await at(20, 20), await at(35, 30));
  check(view !== (await transform()), "选择工具可直接拖动画纸内部空白");
  await page.getByText("试用建筑构图示例").click();
  await saved();
  before = await documentData();
  const imageData = before.image.data;
  await drag(await at(100, 100), await at(110, 115));
  let doc = await documentData();
  check(
    Math.abs(doc.image.x - before.image.x - 10) < 0.01 &&
      Math.abs(doc.image.y - before.image.y - 15) < 0.01,
    "解锁图片仍独立移动 10 / 15 mm",
  );
  await page.getByRole("button", { name: "锁定参考图片", exact: true }).click();
  before = await documentData();
  view = await transform();
  await drag(await at(100, 100), await at(110, 110));
  check(
    view !== (await transform()) &&
      isDeepStrictEqual(before, await documentData()),
    "锁定图片后拖动照片平移画纸，图片位置不变",
  );
  check(
    (await page.locator(".workspace-svg [data-corner]").count()) === 0,
    "锁定图片隐藏缩放控制点",
  );
  await page.getByRole("button", { name: "测距", exact: true }).click();
  await clickMm(10, 10);
  await clickMm(110, 10);
  check(
    (await page.locator(".measurement-card").textContent()).includes("100.0"),
    "自动平移不影响测量工具的两次点击",
  );
  before = await documentData();
  view = await transform();
  await page.keyboard.down("Space");
  await drag(await at(140, 140), await at(150, 155));
  await page.keyboard.up("Space");
  check(
    view !== (await transform()) &&
      isDeepStrictEqual(before, await documentData()),
    "测量工具中 Space 临时平移不创建对象",
  );
  await page.getByRole("button", { name: "坐标定位", exact: true }).click();
  await settings();
  await page
    .getByRole("switch", { name: "贯穿画纸的十字参考线", exact: true })
    .click();
  await page.getByLabel("放大镜倍率", { exact: true }).selectOption("8");
  await done();
  const q = await at(80, 90);
  await page.mouse.move(q.x, q.y);
  check(
    (await page.locator('.workspace-svg [data-crosshair="full"]').count()) ===
      1,
    "坐标工具显示贯穿画纸的十字参考线",
  );
  check(
    (await page.locator(".coordinate-loupe header").textContent()).includes(
      "8×",
    ),
    "局部放大镜使用 8× 倍率",
  );
  const lens = await page.locator(".coordinate-loupe").boundingBox();
  check(
    !(
      q.x >= lens.x &&
      q.x <= lens.x + lens.width &&
      q.y >= lens.y &&
      q.y <= lens.y + lens.height
    ),
    "放大镜不遮挡实际点击点",
  );
  await page.mouse.click(q.x, q.y);
  doc = await documentData();
  check(
    doc.shapes.some(
      (s) =>
        s.type === "point" &&
        Math.abs(s.a.x - 80) < 0.01 &&
        Math.abs(s.a.y - 90) < 0.01,
    ),
    "放大镜可见时点击仍创建准确坐标点",
  );
  await page.getByRole("button", { name: "选择 / 移动", exact: true }).click();
  const point = doc.shapes.find((s) => s.type === "point");
  const label = page.locator(`.workspace-svg text[data-label="${point.id}"]`);
  const lb = await label.boundingBox();
  const pointBefore = point.a;
  await drag(
    { x: lb.x + lb.width / 2, y: lb.y + lb.height / 2 },
    { x: lb.x + lb.width / 2 + 45, y: lb.y + lb.height / 2 + 20 },
  );
  doc = await documentData();
  const moved = doc.shapes.find((s) => s.id === point.id);
  check(
    isDeepStrictEqual(moved.a, pointBefore) && moved.labelOffset?.x > 3,
    "拖动标签只改变显示偏移，原始坐标保持不变",
  );
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  doc = await documentData();
  check(
    !doc.shapes.find((s) => s.id === point.id).labelOffset,
    "标签拖动可单次撤销",
  );
  await page
    .getByRole("button", { name: "工作区缩放选项", exact: true })
    .click();
  await field("工作区缩放百分比", 125.5);
  await page.waitForFunction(() =>
    document.querySelector(".zoom-value")?.textContent.includes("125.5%"),
  );
  check(
    (await page.locator(".zoom-value").textContent()).includes("125.5%"),
    "百分比输入支持精确工作区倍率",
  );
  const exactScale = await page
    .locator(".workspace-svg>g")
    .evaluate((g) => g.getCTM().a);
  check(
    Math.abs(exactScale - ((125.5 / 100) * 96) / 25.4) < 1e-6,
    "输入 125.5% 得到正确毫米到屏幕变换",
  );
  await page
    .getByRole("button", { name: "默认缩放 100%", exact: true })
    .click();
  await page.getByRole("button", { name: "画纸居中", exact: true }).click();
  before = await documentData();
  await settings();
  for (const [name, id] of [
    ["柔和护眼", "soft"],
    ["深色夜间", "night"],
    ["暖色纸张", "warm"],
    ["经典浅色", "classic"],
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await pause();
    check(
      (await page.locator(".app").getAttribute("data-theme")) === id,
      `${name}一键切换`,
    );
  }
  await page.getByRole("button", { name: "深色夜间", exact: true }).click();
  await page.getByLabel("工作区背景颜色", { exact: true }).fill("#223344");
  await page.getByLabel("画纸预览底色", { exact: true }).fill("#3f454a");
  await done();
  check(
    isDeepStrictEqual(before, await documentData()),
    "切换主题和背景没有覆盖当前项目",
  );
  check(
    (await page.locator(".workspace-svg [data-image]").getAttribute("href")) ===
      imageData,
    "所有主题都保留原始照片像素数据",
  );
  check(
    await page.locator(".workspace-svg [data-image]").evaluate((el) => {
      for (let p = el; p; p = p.parentElement)
        if (getComputedStyle(p).filter !== "none") return false;
      return true;
    }),
    "夜间主题未对照片及祖先添加色彩滤镜",
  );
  check(
    (await page
      .locator(".workspace-svg [data-paper-background]")
      .getAttribute("fill")) === "#3f454a",
    "画纸独立预览底色实时生效",
  );
  await page.getByRole("button", { name: "属性", exact: true }).click();
  await field("自定义网格间距", 5);
  await field("次网格线宽", 1.5);
  await field("主网格间距", 20);
  await field("主网格线宽", 3);
  await page.getByLabel("网格透明度", { exact: true }).fill("70");
  await page.getByLabel("主网格透明度", { exact: true }).fill("50");
  await page.getByLabel("主网格颜色", { exact: true }).fill("#ffde00");
  await page.getByRole("switch", { name: "高对比度网格", exact: true }).click();
  for (const [name, color] of [
    ["红色", "#ff4040"],
    ["青色", "#00bcd4"],
    ["黄色", "#ffde00"],
  ]) {
    await page
      .getByRole("button", { name: name + "网格", exact: true })
      .click();
    check(
      (await page
        .locator('.workspace-svg [data-grid-part="minor"]')
        .getAttribute("stroke")) === color,
      `${name}预设网格覆盖在照片上方`,
    );
  }
  check(
    await page.locator(".workspace-svg").evaluate((svg) => {
      const photo = svg.querySelector("[data-image]"),
        grid = svg.querySelector('[data-layer="grid"]');
      return (
        !!photo &&
        !!grid &&
        !!(
          photo.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING
        )
      );
    }),
    "主次网格在实际 SVG 中位于参考照片上方",
  );
  doc = await documentData();
  check(
    doc.grid.spacing === 5 &&
      doc.grid.majorSpacing === 20 &&
      doc.grid.stroke === 1.5 &&
      doc.grid.majorStroke === 3 &&
      doc.grid.majorOpacity === 0.5,
    "主次网格分别保存间距、线宽与透明度",
  );
  check(
    (await page
      .locator('.workspace-svg pattern path[stroke="#000000"]')
      .count()) > 0 &&
      (await page
        .locator('.workspace-svg pattern path[stroke="#ffffff"]')
        .count()) > 0,
    "高对比模式包含黑白双描边",
  );
  const patternBefore = await page
    .locator(".workspace-svg #paper-grid")
    .getAttribute("width");
  const pxWidthBefore =
    Number(
      await page
        .locator('.workspace-svg [data-grid-part="minor"]')
        .getAttribute("stroke-width"),
    ) * (await page.locator(".workspace-svg>g").evaluate((g) => g.getCTM().a));
  await page.getByRole("button", { name: "放大工作区", exact: true }).click();
  const pxWidthAfter =
    Number(
      await page
        .locator('.workspace-svg [data-grid-part="minor"]')
        .getAttribute("stroke-width"),
    ) * (await page.locator(".workspace-svg>g").evaluate((g) => g.getCTM().a));
  check(
    patternBefore ===
      (await page
        .locator(".workspace-svg #paper-grid")
        .getAttribute("width")) &&
      Math.abs(pxWidthBefore - pxWidthAfter) < 1e-6,
    "放大后网格仍按 5 mm 对齐且像素线宽不变",
  );
  const prefBefore = await prefs(),
    docBefore = await documentData();
  await page.reload();
  await saved();
  check(
    isDeepStrictEqual(prefBefore, await prefs()),
    "刷新后恢复主题、颜色、放大镜、标签及主次网格偏好",
  );
  check(
    isDeepStrictEqual(docBefore, await documentData()),
    "刷新后当前项目几何和网格独立恢复",
  );
  await page
    .locator("input[type=file]")
    .nth(1)
    .setInputFiles("tests/fixtures/v1-project.json");
  await page.getByText("项目已完整恢复", { exact: true }).waitFor();
  doc = await documentData();
  check(
    doc.shapes.length === 3 &&
      doc.grid.color === "#668e87" &&
      doc.grid.opacity === 0.22 &&
      doc.grid.majorSpacing === 25,
    "第一版项目可打开并保留原网格及 100 mm 标记",
  );
  check(
    (await prefs()).theme === "night" &&
      isDeepStrictEqual((await prefs()).grid, prefBefore.grid),
    "打开旧项目不覆盖全局主题及网格默认值",
  );
  await page.getByRole("button", { name: "新建画作", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "新建画纸", exact: true })
    .click();
  doc = await documentData();
  check(
    isDeepStrictEqual(doc.grid, prefBefore.grid) && doc.shapes.length === 0,
    "新建画作使用全局网格默认值，不混入旧对象",
  );
  await page.getByRole("button", { name: "导出", exact: true }).click();
  await page
    .getByRole("button", { name: "PNG 图片 高清图像", exact: true })
    .click();
  await page.getByLabel("导出内容", { exact: true }).selectOption("image");
  await page.getByLabel("导出分辨率", { exact: true }).selectOption("150");
  await page.getByLabel("包含页面边框", { exact: true }).uncheck();
  await download(
    () => page.getByRole("button", { name: "导出 PNG", exact: true }).click(),
    "work/v2-white.png",
  );
  check(
    isDeepStrictEqual(await pixel("work/v2-white.png"), [255, 255, 255, 255]),
    "夜间预览下 PNG 默认仍导出纯白背景",
  );
  await page.getByRole("button", { name: "导出", exact: true }).click();
  await page
    .getByLabel("明确使用当前画纸预览底色（默认白色）", { exact: true })
    .check();
  await download(
    () => page.getByRole("button", { name: "导出 PNG", exact: true }).click(),
    "work/v2-preview-color.png",
  );
  check(
    isDeepStrictEqual(
      await pixel("work/v2-preview-color.png"),
      [63, 69, 74, 255],
    ),
    "只有明确勾选后才导出画纸预览底色",
  );
  check(errors.length === 0, "第二版完整流程无浏览器未捕获异常");
  console.log(JSON.stringify({ checks: count, errors }));
} finally {
  await browser.close();
}
