import { renderToStaticMarkup } from "react-dom/server";
import { Drawing, type DrawOptions } from "./Drawing";
import { type Project, paperSize } from "./model";
import { download } from "./storage";
export function exportSvg(project: Project, options: DrawOptions) {
  const { width, height } = paperSize(project.orientation);
  return renderToStaticMarkup(
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      width={`${width}mm`}
      height={`${height}mm`}
      viewBox={`0 0 ${width} ${height}`}
    >
      <Drawing project={project} options={options} id="export" />
    </svg>,
  );
}
export async function exportCanvas(
  project: Project,
  options: DrawOptions,
  dpi: number,
) {
  const { width, height } = paperSize(project.orientation);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round((width * dpi) / 25.4);
  canvas.height = Math.round((height * dpi) / 25.4);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法分配导出内存，请使用较低分辨率。");
  const url = URL.createObjectURL(
    new Blob([exportSvg(project, options)], {
      type: "image/svg+xml;charset=utf-8",
    }),
  );
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error("图片渲染失败，请重新导入参考图片后重试。"));
      image.src = url;
    });
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function exportPng(
  project: Project,
  options: DrawOptions,
  dpi: number,
) {
  const canvas = await exportCanvas(project, options, dpi);
  try {
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PNG 编码失败"))),
        "image/png",
      ),
    );
    download(blob, `${project.name}-${dpi}dpi.png`);
  } finally {
    canvas.width = canvas.height = 0;
  }
}
export async function exportPdf(
  project: Project,
  options: DrawOptions,
  dpi: number,
) {
  const [{ jsPDF }, canvas] = await Promise.all([
    import("jspdf"),
    exportCanvas(project, options, dpi),
  ]);
  try {
    const { width, height } = paperSize(project.orientation);
    const pdf = new jsPDF({
      orientation: project.orientation,
      unit: "mm",
      format: [width, height],
      compress: true,
      precision: 12,
    });
    pdf.addImage(canvas, "PNG", 0, 0, width, height, undefined, "FAST");
    pdf.save(`${project.name}-A4.pdf`);
  } finally {
    canvas.width = canvas.height = 0;
  }
}
export function exportCsv(project: Project) {
  const rows = [["对象", "类型", "端点", "X (mm)", "Y (mm)"]];
  for (const s of project.shapes) {
    rows.push([
      s.name,
      s.type,
      s.type === "point" ? "点" : "起点",
      s.a.x.toFixed(4),
      s.a.y.toFixed(4),
    ]);
    if (s.type !== "point") {
      rows.push([s.name, s.type, "终点", s.b.x.toFixed(4), s.b.y.toFixed(4)]);
      if (s.type === "rect") {
        rows.push(
          [s.name, s.type, "顶点 2", s.b.x.toFixed(4), s.a.y.toFixed(4)],
          [s.name, s.type, "顶点 4", s.a.x.toFixed(4), s.b.y.toFixed(4)],
        );
      }
    }
  }
  const csv =
    "\uFEFF" +
    rows
      .map((r) => r.map((v) => '"' + v.replace(/"/g, '""') + '"').join(","))
      .join("\r\n");
  download(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    `${project.name}-坐标.csv`,
  );
}
