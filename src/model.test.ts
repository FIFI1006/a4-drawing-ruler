import { describe, it, expect } from "vitest";
import {
  paperSize,
  screenToMm,
  mmToScreen,
  distance,
  metrics,
  fittedImage,
  imageCorners,
  nextPointName,
  newProject,
  validateProject,
  makeShape,
  snapPoint,
} from "./model";
import { exportSvg } from "./export";
import JSZip from "jszip";

describe("第一阶段：画纸与毫米坐标", () => {
  it("纵向和横向严格符合 ISO A4", () => {
    expect(paperSize("portrait")).toEqual({ width: 210, height: 297 });
    expect(paperSize("landscape")).toEqual({ width: 297, height: 210 });
  });
  it("任意平移、缩放与高 DPI 下坐标双向转换无漂移", () => {
    for (const scale of [0.3, 1.25, 3.779527559, 7.559055118, 35])
      for (const p of [
        { x: 0, y: 0 },
        { x: 35.2, y: 48 },
        { x: 210, y: 297 },
      ]) {
        const origin = { x: -88.12, y: 124.7 };
        const mm = screenToMm(mmToScreen(p, origin, scale), origin, scale);
        expect(mm.x).toBeCloseTo(p.x, 10);
        expect(mm.y).toBeCloseTo(p.y, 10);
      }
  });
  it("适应/填满保留照片长宽比且在画纸中居中", () => {
    for (const fill of [true, false]) {
      const f = fittedImage(4000, 3000, paperSize("portrait"), fill);
      expect(f.width / f.height).toBeCloseTo(4 / 3, 12);
      expect(f.x + f.width / 2).toBeCloseTo(105);
      expect(f.y + f.height / 2).toBeCloseTo(148.5);
    }
    expect(fittedImage(4000, 3000, paperSize("portrait")).width).toBe(210);
    expect(fittedImage(4000, 3000, paperSize("portrait"), true).height).toBe(
      297,
    );
  });
});
describe("第二阶段：几何与辅助绘图", () => {
  it("(10,10) 到 (110,10) 恒为 100 mm", () => {
    expect(distance({ x: 10, y: 10 }, { x: 110, y: 10 })).toBe(100);
    expect(metrics({ x: 10, y: 10 }, { x: 110, y: 10 })).toEqual({
      dx: 100,
      dy: 0,
      length: 100,
      angle: 0,
    });
  });
  it("斜线长度、水平垂直距离和倾角正确", () => {
    const m = metrics({ x: 10, y: 10 }, { x: 40, y: 50 });
    expect(m).toMatchObject({ dx: 30, dy: 40, length: 50 });
    expect(m.angle).toBeCloseTo(53.130102354, 8);
  });
  it("超过 26 个标记后继续生成唯一名称", () => {
    const shapes = Array.from({ length: 26 }, (_, i) =>
      makeShape(
        "point",
        { x: i, y: 0 },
        { x: i, y: 0 },
        String.fromCharCode(65 + i),
      ),
    );
    expect(nextPointName(shapes)).toBe("AA");
    shapes.push(makeShape("point", { x: 1, y: 1 }, { x: 1, y: 1 }, "AA"));
    expect(nextPointName(shapes)).toBe("AB");
  });
  it("吸附只在开启时改变毫米位置", () => {
    const p = { x: 35.2, y: 48 };
    const g = newProject().grid;
    expect(snapPoint(p, g)).toBe(p);
    expect(snapPoint(p, { ...g, snap: true })).toEqual({ x: 40, y: 50 });
  });
  it("旋转四角始终绕图像中心，保留真实尺寸", () => {
    const image = {
      data: "data:image/png;base64,AA",
      name: "a",
      naturalWidth: 100,
      naturalHeight: 50,
      x: 20,
      y: 40,
      width: 100,
      height: 50,
      baseWidth: 100,
      rotation: 90,
      flipX: false,
      flipY: false,
      opacity: 1,
      visible: true,
      locked: false,
    };
    const corners = imageCorners(image);
    expect(corners[0].x).toBeCloseTo(95);
    expect(corners[0].y).toBeCloseTo(15);
    expect(distance(corners[0], corners[1])).toBeCloseTo(100);
    expect(distance(corners[1], corners[2])).toBeCloseTo(50);
  });
});
describe("第三阶段：项目与导出", () => {
  it("完整项目 ZIP 序列化恢复所有图层、图片和坐标", async () => {
    const p = newProject();
    p.image = {
      data: "data:image/png;base64,aGVsbG8=",
      name: "test.png",
      naturalWidth: 4000,
      naturalHeight: 3000,
      ...fittedImage(4000, 3000, paperSize(p.orientation)),
      baseWidth: 210,
      rotation: 37.2,
      opacity: 0.4,
      locked: true,
      visible: false,
      flipX: true,
      flipY: false,
    };
    p.shapes = [
      makeShape("point", { x: 35.2, y: 48 }, { x: 35.2, y: 48 }, "A"),
      makeShape("measure", { x: 10, y: 10 }, { x: 110, y: 10 }, "100 mm"),
    ];
    p.orientation = "landscape";
    p.grid.snap = true;
    p.layers.points = false;
    const zip = new JSZip();
    zip.file("project.json", JSON.stringify(p));
    const loaded = await JSZip.loadAsync(
      await zip.generateAsync({ type: "uint8array" }),
    );
    expect(
      validateProject(
        JSON.parse(await loaded.file("project.json")!.async("string")),
      ),
    ).toEqual(p);
  });
  it("画纸裁切在毫米坐标内，透明度不影响网格", () => {
    const p = newProject();
    p.image = {
      data: "data:image/png;base64,AA",
      name: "test",
      naturalWidth: 100,
      naturalHeight: 100,
      x: -50,
      y: -50,
      width: 300,
      height: 300,
      baseWidth: 300,
      rotation: 0,
      opacity: 0.4,
      locked: false,
      visible: true,
      flipX: false,
      flipY: false,
    };
    const svg = exportSvg(p, {
      image: true,
      grid: true,
      guides: true,
      labels: true,
      rulers: false,
      border: true,
    });
    expect(svg).toContain('viewBox="0 0 210 297"');
    expect(svg).toContain('width="210mm"');
    expect(svg).toContain('clip-path="url(#export-clip)"');
    expect(svg).toContain('opacity="0.4"');
    expect(svg).toContain("url(#export-grid)");
    expect(svg).not.toContain("data-corner");
  });
  it("方向变化保留对象的毫米坐标及图片状态", () => {
    const p = newProject();
    p.shapes = [makeShape("line", { x: 10, y: 10 }, { x: 110, y: 10 }, "L")];
    const q = validateProject({ ...p, orientation: "landscape" });
    expect(q.shapes).toEqual(p.shapes);
    expect(distance(q.shapes[0].a, q.shapes[0].b)).toBe(100);
  });
});
describe("第四阶段：错误处理", () => {
  it.each([NaN, Infinity, -Infinity])("拒绝无效数字 %s", (v) => {
    const p = newProject();
    p.grid.spacing = v;
    expect(() => validateProject(p)).toThrow("项目格式无效");
  });
  it("拒绝负尺寸、超小网格和错误图片来源", () => {
    const p = newProject();
    expect(() =>
      validateProject({ ...p, grid: { ...p.grid, spacing: 0 } }),
    ).toThrow();
    expect(() =>
      validateProject({ ...p, image: { data: "https://example.com/x.jpg" } }),
    ).toThrow();
  });
  it("拒绝不支持的项目版本", () => {
    expect(() => validateProject({ ...newProject(), version: 2 })).toThrow();
  });
});
