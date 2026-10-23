import { openDB } from "idb";
import JSZip from "jszip";
import { type Project, validateProject } from "./model";
const database = () =>
  openDB("a4-drawing-ruler", 1, {
    upgrade(db) {
      db.createObjectStore("projects");
    },
  });
export async function saveLocal(project: Project) {
  const db = await database();
  await db.put("projects", project, "current");
  db.close();
}
export async function loadLocal(): Promise<Project | null> {
  const db = await database();
  const data = await db.get("projects", "current");
  db.close();
  return data ? validateProject(data) : null;
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
export async function savePortable(project: Project) {
  const zip = new JSZip();
  zip.file("project.json", JSON.stringify(project));
  zip.file(
    "README.txt",
    "A4 绘画标尺工作台项目。通过工作台“打开项目”恢复。所有几何坐标的单位均为毫米。",
  );
  download(
    await zip.generateAsync({ type: "blob", compression: "DEFLATE" }),
    `${project.name}.a4r`,
  );
}
export async function openPortable(file: File): Promise<Project> {
  if (file.size > 65 * 1024 * 1024)
    throw new Error("项目文件过大，请选择小于 65 MB 的文件。");
  if (file.name.endsWith(".json"))
    return validateProject(JSON.parse(await file.text()));
  const zip = await JSZip.loadAsync(file);
  const entry = zip.file("project.json");
  if (!entry) throw new Error("未找到项目数据，请选择完整的 .a4r 项目文件。");
  // Inspect ZIP metadata before expanding untrusted content.
  const size = (entry as unknown as { _data?: { uncompressedSize?: number } })
    ._data?.uncompressedSize;
  if (size && size > 65 * 1024 * 1024)
    throw new Error("项目解压后超过 65 MB，无法安全打开。");
  const text = await entry.async("string");
  if (text.length > 65000000) throw new Error("项目数据过大。");
  return validateProject(JSON.parse(text));
}
export async function importImage(
  file: File,
): Promise<{ data: string; width: number; height: number; name: string }> {
  if (file.size > 40 * 1024 * 1024)
    throw new Error("图片超过 40 MB，请先缩小图片后重试。");
  if (!file.type.startsWith("image/"))
    throw new Error("请选择 JPG、PNG、WEBP 等浏览器支持的图片。");
  // Object URLs avoid holding several base64 copies while decoding.
  const url = URL.createObjectURL(file);
  const im = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      im.onload = () => resolve();
      im.onerror = () =>
        reject(new Error("无法解码图片，文件可能已损坏或格式不受支持。"));
      im.src = url;
    });
    const w = im.naturalWidth,
      h = im.naturalHeight;
    if (w > 50000 || h > 50000)
      throw new Error("图片单边超过 50000 像素，请缩小后重试。");
    if (!w || !h || w * h > 100000000)
      throw new Error("图片像素超过 1 亿，建议先压缩至 6000 像素以内。");
    const scale = Math.min(
      1,
      6000 / Math.max(w, h),
      Math.sqrt(20000000 / (w * h)),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx)
      throw new Error("浏览器无法分配图片内存，请关闭其他标签页后重试。");
    ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL(
      file.type === "image/png" ? "image/png" : "image/jpeg",
      0.94,
    );
    canvas.width = canvas.height = 0;
    return { data, width: w, height: h, name: file.name };
  } finally {
    URL.revokeObjectURL(url);
  }
}
