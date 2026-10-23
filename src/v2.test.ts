import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import {
  newProject,
  validateProject,
  makeShape,
  distance,
  gridSchema,
} from "./model";
import {
  defaultPreferences,
  parsePreferences,
  chooseTheme,
  projectWithDefaults,
} from "./preferences";
import { exportSvg } from "./export";
import { Drawing, defaultDrawOptions } from "./Drawing";

describe("V2 与第一版项目兼容", () => {
  it("旧网格的毫米间距、颜色、透明度与吸附原样保留", () => {
    const legacy = {
      ...newProject(),
      grid: {
        enabled: true,
        spacing: 5,
        color: "#ff0000",
        opacity: 0.4,
        snap: true,
      },
    };
    const p = validateProject(legacy);
    expect(p.grid).toMatchObject(legacy.grid);
    expect(p.grid.majorSpacing).toBe(25);
    expect(p.grid.majorColor).toBe("#ff0000");
    expect(p.grid.majorOpacity).toBe(0.4);
    expect(p.grid.highContrast).toBe(false);
  });
  it("旧标记点无需标签偏移字段，新增标签偏移不改变几何测距", () => {
    const a = makeShape("point", { x: 10, y: 10 }, { x: 10, y: 10 }, "A");
    const b = makeShape("point", { x: 110, y: 10 }, { x: 110, y: 10 }, "B");
    const p = validateProject({
      ...newProject(),
      shapes: [{ ...a, labelOffset: { x: 25, y: -16 } }, b],
    });
    expect(p.shapes[1].labelOffset).toBeUndefined();
    expect(p.shapes[0].a).toEqual(a.a);
    expect(distance(p.shapes[0].a, p.shapes[1].a)).toBe(100);
  });
  it("新建项目复制全局网格默认值，后续项目编辑不会污染偏好", () => {
    const prefs = defaultPreferences();
    prefs.grid.spacing = 5;
    const p = projectWithDefaults(prefs.grid);
    p.grid.spacing = 20;
    expect(prefs.grid.spacing).toBe(5);
  });
  it.each([NaN, Infinity, -1, 0, 7])("拒绝非法网格线宽 %s", (stroke) => {
    expect(gridSchema.safeParse({ ...newProject().grid, stroke }).success).toBe(
      false,
    );
  });
});
describe("用户偏好与预览隔离", () => {
  it("隐藏坐标标签不会隐藏测量长度", () => {
    const p = newProject();
    p.shapes = [
      makeShape("point", { x: 10, y: 10 }, { x: 10, y: 10 }, "A"),
      makeShape("measure", { x: 10, y: 10 }, { x: 110, y: 10 }, "距离"),
    ];
    const svg = renderToStaticMarkup(
      createElement(
        "svg",
        null,
        createElement(Drawing, {
          project: p,
          interactive: true,
          pointLabels: false,
        }),
      ),
    );
    expect(svg).not.toContain("data-label=");
    expect(svg).toContain("100.0 mm");
  });

  it("四个主题只声明显示颜色，不包含图片或几何数据", () => {
    for (const t of ["classic", "soft", "night", "warm"] as const) {
      expect(Object.keys(chooseTheme(t)).sort()).toEqual([
        "paperColor",
        "theme",
        "workspaceColor",
      ]);
    }
  });
  it("损坏的某项偏好不会丢失其余有效设置", () => {
    const p = parsePreferences({
      theme: "night",
      paperColor: "not-a-color",
      workspaceColor: "#123456",
      magnifierZoom: 8,
      grid: { spacing: 0 },
    });
    expect(p.theme).toBe("night");
    expect(p.workspaceColor).toBe("#123456");
    expect(p.magnifierZoom).toBe(8);
    expect(p.paperColor).toBe("#ffffff");
    expect(p.grid.spacing).toBe(10);
  });
  it("默认导出保持白色，只有显式背景选项才改变输出", () => {
    const p = newProject();
    const normal = exportSvg(p, defaultDrawOptions);
    expect(normal).toContain(
      'data-paper-background="true" width="210" height="297" fill="white"',
    );
    const warm = exportSvg(p, { ...defaultDrawOptions, background: "#f9edce" });
    expect(warm).toContain('fill="#f9edce"');
    expect(warm).toContain('viewBox="0 0 210 297"');
  });
  it("主次网格独立且高对比描边随 0% 不透明度一起隐藏", () => {
    const p = newProject();
    p.grid = {
      ...p.grid,
      spacing: 5,
      majorSpacing: 20,
      color: "#ff4040",
      majorColor: "#ffde00",
      opacity: 0,
      majorOpacity: 0.8,
      highContrast: true,
    };
    const svg = exportSvg(p, defaultDrawOptions);
    expect(svg).toContain('width="5" height="5"');
    expect(svg).toContain('width="20" height="20"');
    expect(svg).toContain('stroke="#000000"');
    expect(svg).toContain('stroke="#ffffff"');
    expect(svg).toContain('fill="url(#export-grid)" opacity="0"');
    expect(svg).toContain('fill="url(#export-major)" opacity="0.8"');
  });
});
