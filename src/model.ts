import { z } from "zod";

export type Vec = { x: number; y: number };
export type Tool =
  | "select"
  | "point"
  | "measure"
  | "line"
  | "hguide"
  | "vguide"
  | "rect"
  | "pan";
const num = z.number().finite().min(-100000).max(100000);
const coord = z.object({ x: num, y: num });
export const shapeSchema = z.object({
  id: z.string().max(100),
  type: z.enum(["point", "measure", "line", "hguide", "vguide", "rect"]),
  name: z.string().max(100),
  a: coord,
  b: coord,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  stroke: z.number().finite().min(0.05).max(5),
  dashed: z.boolean(),
  visible: z.boolean(),
  locked: z.boolean(),
});
export type Shape = z.infer<typeof shapeSchema>;
export const imageSchema = z.object({
  data: z
    .string()
    .max(60000000)
    .regex(/^data:image\/(png|jpeg|webp|svg\+xml);base64,/),
  name: z.string().max(250),
  naturalWidth: z.number().int().positive().max(50000),
  naturalHeight: z.number().int().positive().max(50000),
  x: num,
  y: num,
  width: z.number().finite().min(0.1).max(10000),
  height: z.number().finite().min(0.1).max(10000),
  baseWidth: z.number().finite().min(0.1).max(10000),
  rotation: num,
  flipX: z.boolean(),
  flipY: z.boolean(),
  opacity: z.number().finite().min(0).max(1),
  visible: z.boolean(),
  locked: z.boolean(),
});
export type RefImage = z.infer<typeof imageSchema>;
export const projectSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(120),
  orientation: z.enum(["portrait", "landscape"]),
  image: imageSchema.nullable(),
  grid: z.object({
    enabled: z.boolean(),
    spacing: z.number().finite().min(1).max(100),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    opacity: z.number().finite().min(0).max(1),
    snap: z.boolean(),
  }),
  shapes: z.array(shapeSchema).max(10000),
  layers: z.object({ guides: z.boolean(), points: z.boolean() }),
});
export type Project = z.infer<typeof projectSchema>;
export const newProject = (): Project => ({
  version: 1,
  name: "未命名画作",
  orientation: "portrait",
  image: null,
  grid: {
    enabled: true,
    spacing: 10,
    color: "#668e87",
    opacity: 0.22,
    snap: false,
  },
  shapes: [],
  layers: { guides: true, points: true },
});
export const paperSize = (orientation: Project["orientation"]) =>
  orientation === "portrait"
    ? { width: 210, height: 297 }
    : { width: 297, height: 210 };
export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
export const round = (v: number) => Number(v.toFixed(1));
export const fmt = (v: number) => v.toFixed(1);
export const distance = (a: Vec, b: Vec) => Math.hypot(b.x - a.x, b.y - a.y);
export const metrics = (a: Vec, b: Vec) => ({
  dx: b.x - a.x,
  dy: b.y - a.y,
  length: distance(a, b),
  angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
});
export const screenToMm = (p: Vec, origin: Vec, scale: number): Vec => ({
  x: (p.x - origin.x) / scale,
  y: (p.y - origin.y) / scale,
});
export const mmToScreen = (p: Vec, origin: Vec, scale: number): Vec => ({
  x: p.x * scale + origin.x,
  y: p.y * scale + origin.y,
});
export const snapPoint = (p: Vec, grid: Project["grid"]): Vec =>
  grid.snap
    ? {
        x: Math.round(p.x / grid.spacing) * grid.spacing,
        y: Math.round(p.y / grid.spacing) * grid.spacing,
      }
    : p;
export function fittedImage(
  nw: number,
  nh: number,
  paper: { width: number; height: number },
  fill = false,
) {
  const s = (fill ? Math.max : Math.min)(paper.width / nw, paper.height / nh);
  const width = nw * s,
    height = nh * s;
  return {
    x: (paper.width - width) / 2,
    y: (paper.height - height) / 2,
    width,
    height,
  };
}
export function imageCorners(i: RefImage): Vec[] {
  const r = (i.rotation * Math.PI) / 180,
    c = Math.cos(r),
    s = Math.sin(r),
    cx = i.x + i.width / 2,
    cy = i.y + i.height / 2;
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([a, b]) => ({
    x: cx + ((a * i.width) / 2) * c - ((b * i.height) / 2) * s,
    y: cy + ((a * i.width) / 2) * s + ((b * i.height) / 2) * c,
  }));
}
export function makeShape(
  type: Shape["type"],
  a: Vec,
  b: Vec,
  name: string,
): Shape {
  return {
    id: crypto.randomUUID(),
    type,
    a: { ...a },
    b: { ...b },
    name,
    color: type === "measure" ? "#bb7d39" : "#247e6c",
    stroke: 0.3,
    dashed: type === "hguide" || type === "vguide",
    visible: true,
    locked: false,
  };
}
export const nextPointName = (shapes: Shape[]) => {
  const used = new Set(
    shapes.filter((s) => s.type === "point").map((s) => s.name),
  );
  for (let n = 1; ; n++) {
    let k = n,
      name = "";
    while (k > 0) {
      k--;
      name = String.fromCharCode(65 + (k % 26)) + name;
      k = Math.floor(k / 26);
    }
    if (!used.has(name)) return name;
  }
};
export function validateProject(data: unknown): Project {
  const result = projectSchema.safeParse(data);
  if (!result.success)
    throw new Error(
      "项目格式无效：请使用本工作台导出的 .a4r 文件，检查数值和图片是否完整。",
    );
  return result.data;
}
