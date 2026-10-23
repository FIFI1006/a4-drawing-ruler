import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ImagePlus, ArrowUpRight, MousePointer2 } from "lucide-react";
import {
  Drawing,
  Rulers,
  ShapeDrawing,
  Crosshair,
  defaultDrawOptions,
} from "./Drawing";
import { themes, darkColor, type Preferences } from "./preferences";
import {
  clamp,
  distance,
  fmt,
  imageCorners,
  makeShape,
  nextPointName,
  paperSize,
  screenToMm,
  snapPoint,
  type Project,
  type Tool,
  type Vec,
} from "./model";
export type WorkspaceHandle = {
  fit: () => void;
  center: () => void;
  setZoom: (percent: number) => void;
};
type View = { x: number; y: number; scale: number };
type Drag = {
  type: "pan" | "image" | "corner" | "shape" | "endpoint" | "label";
  start: Vec;
  view: View;
  before: Project;
  id?: string;
  index?: number;
};
type Props = {
  project: Project;
  tool: Tool;
  selection: string | null;
  setSelection: (id: string | null) => void;
  update: (fn: (p: Project) => Project, record?: boolean) => void;
  record: (p: Project) => void;
  onCursor: (p: Vec | null) => void;
  onZoom: (v: number) => void;
  onUpload: () => void;
  onDemo: () => void;
  space: boolean;
  cancelToken: number;
  calibration: number;
  onShape: () => void;
  preferences: Preferences;
  onPreferences: (p: Partial<Preferences>) => void;
};
export const Workspace = forwardRef<WorkspaceHandle, Props>(function Workspace(
  {
    project,
    tool,
    selection,
    setSelection,
    update,
    record,
    onCursor,
    onZoom,
    onUpload,
    onDemo,
    space,
    cancelToken,
    calibration,
    onShape,
    preferences,
    onPreferences,
  },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ x: 80, y: 70, scale: 2 });
  const vr = useRef(view);
  vr.current = view;
  const pr = useRef(project);
  pr.current = project;
  const size = paperSize(project.orientation);
  const [cursor, setCursor] = useState<Vec | null>(null),
    [pending, setPending] = useState<Vec | null>(null);
  const drag = useRef<Drag | null>(null),
    touches = useRef(new Map<number, Vec>());
  const touchTap = useRef<{ id: number; start: Vec; mm: Vec } | null>(null);
  const pinch = useRef<{ distance: number; mid: Vec; view: View } | null>(null);
  const fitting = useRef(true);
  const [panning, setPanning] = useState(false);
  const [hostSize, setHostSize] = useState({ width: 800, height: 600 });
  const theme = themes[preferences.theme];
  const paperDark = darkColor(preferences.paperColor);
  function cancelInteraction() {
    const d = drag.current;
    if (d && d.type !== "pan") update(() => d.before, false);
    drag.current = null;
    touchTap.current = null;
    pinch.current = null;
    touches.current.clear();
    setPanning(false);
    setCursor(null);
    onCursor(null);
  }
  useEffect(() => {
    window.addEventListener("blur", cancelInteraction);
    return () => window.removeEventListener("blur", cancelInteraction);
  }, [update]);

  const fit = () => {
    if (!host.current) return;
    const { clientWidth: w, clientHeight: h } = host.current;
    const z = paperSize(pr.current.orientation);
    const scale = Math.max(
      0.3,
      Math.min(
        (w - (w < 600 ? 54 : 68)) / z.width,
        (h - (h < 480 ? 60 : 78)) / z.height,
      ),
    );
    fitting.current = true;
    setView({
      x: (w - z.width * scale) / 2 + 8,
      y: (h - z.height * scale) / 2 + 7,
      scale,
    });
  };
  const zoomAt = (scale: number, p: Vec) => {
    const v = vr.current;
    const k = clamp(scale, 0.3, 35) / v.scale;
    fitting.current = false;
    setView({
      x: p.x - (p.x - v.x) * k,
      y: p.y - (p.y - v.y) * k,
      scale: v.scale * k,
    });
  };
  useImperativeHandle(ref, () => ({
    fit,
    center: () => {
      if (!host.current) return;
      setView((v) => ({
        ...v,
        x: (host.current!.clientWidth - size.width * v.scale) / 2,
        y: (host.current!.clientHeight - size.height * v.scale) / 2,
      }));
    },
    setZoom: (percent) => {
      if (host.current)
        zoomAt((((percent / 100) * 96) / 25.4) * calibration, {
          x: host.current.clientWidth / 2,
          y: host.current.clientHeight / 2,
        });
    },
  }));
  useEffect(() => {
    fit();
    const observer = new ResizeObserver(() => {
      if (host.current)
        setHostSize({
          width: host.current.clientWidth,
          height: host.current.clientHeight,
        });
      if (fitting.current) fit();
    });
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (fitting.current) fit();
  }, [project.orientation]);
  useEffect(() => {
    onZoom((view.scale / ((96 / 25.4) * calibration)) * 100);
  }, [view.scale, calibration]);
  useEffect(() => {
    setPending(null);
    touchTap.current = null;
    setPanning(false);
    if (drag.current && drag.current.type !== "pan") {
      const before = drag.current.before;
      update(() => before, false);
      drag.current = null;
    }
    drag.current = null;
  }, [tool, cancelToken]);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(vr.current.scale * Math.exp(-e.deltaY * 0.0015), {
        x: e.clientX - r.left,
        y: e.clientY - r.top,
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);
  const point = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const bounded = (p: Vec) => {
    const s = snapPoint(p, project.grid);
    return { x: clamp(s.x, 0, size.width), y: clamp(s.y, 0, size.height) };
  };
  function down(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.button !== 0 && e.button !== 1) return;
    const p = point(e);
    touches.current.set(e.pointerId, p);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (touches.current.size === 2) {
      touchTap.current = null;
      if (drag.current && drag.current.type !== "pan")
        update(() => drag.current!.before, false);
      setPanning(true);
      drag.current = null;
      const [a, b] = [...touches.current.values()];
      pinch.current = {
        distance: distance(a, b),
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        view: vr.current,
      };
      return;
    }
    if (pinch.current) return;
    const mm = screenToMm(p, view, view.scale),
      inside =
        mm.x >= 0 && mm.x <= size.width && mm.y >= 0 && mm.y <= size.height;
    const target = e.target as SVGElement;
    const shapeId = target
      .closest("[data-object]")
      ?.getAttribute("data-object");
    const labelId = target.closest("[data-label]")?.getAttribute("data-label");
    const ep = target.getAttribute("data-endpoint"),
      corner = target.getAttribute("data-corner");
    const begin = (type: Drag["type"], id?: string, index?: number) => {
      if (type === "pan") {
        fitting.current = false;
        setPanning(true);
      }
      drag.current = {
        type,
        start: p,
        view: { ...view },
        before: project,
        id,
        index,
      };
    };
    if (space || tool === "pan" || e.button === 1) {
      fitting.current = false;
      begin("pan");
      return;
    }
    // Resize handles may lie beyond the paper: keep them ahead of blank-space panning.
    if (
      tool === "select" &&
      corner !== null &&
      project.image &&
      !project.image.locked
    ) {
      begin("corner", "image", Number(corner));
      return;
    }
    if (!inside) {
      begin("pan");
      return;
    }
    if (tool === "select") {
      if (corner !== null && project.image && !project.image.locked) {
        begin("corner", "image", Number(corner));
        return;
      }
      if (shapeId) {
        setSelection(shapeId);
        const s = project.shapes.find((s) => s.id === shapeId);
        if (s?.locked) {
          begin("pan");
          return;
        }
        if (s && !s.locked)
          begin(
            labelId ? "label" : ep !== null ? "endpoint" : "shape",
            shapeId,
            ep !== null ? Number(ep) : undefined,
          );
        return;
      }
      if (target.hasAttribute("data-image") && inside && project.image) {
        setSelection("image");
        begin(project.image.locked ? "pan" : "image");
        return;
      }
      setSelection(null);
      begin("pan");
      return;
    }
    if (!inside) return;
    if (e.pointerType === "touch") {
      touchTap.current = { id: e.pointerId, start: p, mm };
      return;
    }
    place(mm);
  }
  function place(mm: Vec) {
    const pos = bounded(mm);
    if (tool === "select" || tool === "pan") return;
    if (tool === "point") {
      const s = makeShape("point", pos, pos, nextPointName(project.shapes));
      update((p) => ({ ...p, shapes: [...p.shapes, s] }));
      setSelection(s.id);
      onShape();
      return;
    }
    if (tool === "hguide" || tool === "vguide") {
      const a = tool === "hguide" ? { x: 0, y: pos.y } : { x: pos.x, y: 0 },
        b =
          tool === "hguide"
            ? { x: size.width, y: pos.y }
            : { x: pos.x, y: size.height };
      const s = makeShape(
        tool,
        a,
        b,
        tool === "hguide" ? "水平辅助线" : "垂直辅助线",
      );
      update((p) => ({ ...p, shapes: [...p.shapes, s] }));
      setSelection(s.id);
      onShape();
      return;
    }
    if (pending) {
      const s = makeShape(
        tool,
        pending,
        pos,
        tool === "measure" ? "距离测量" : tool === "rect" ? "矩形" : "直线",
      );
      update((p) => ({ ...p, shapes: [...p.shapes, s] }));
      setSelection(s.id);
      setPending(null);
      onShape();
    } else setPending(pos);
  }
  function move(e: ReactPointerEvent<SVGSVGElement>) {
    const p = point(e);
    if (touches.current.has(e.pointerId)) touches.current.set(e.pointerId, p);
    if (pinch.current && touches.current.size >= 2) {
      const [a, b] = [...touches.current.values()],
        pin = pinch.current,
        mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const scale = clamp(
          (pin.view.scale * distance(a, b)) / Math.max(1, pin.distance),
          0.3,
          35,
        ),
        k = scale / pin.view.scale;
      fitting.current = false;
      setView({
        x: mid.x - (pin.mid.x - pin.view.x) * k,
        y: mid.y - (pin.mid.y - pin.view.y) * k,
        scale,
      });
      return;
    }
    const mm = screenToMm(p, view, view.scale);
    const inside =
      mm.x >= 0 && mm.x <= size.width && mm.y >= 0 && mm.y <= size.height;
    setCursor(inside ? mm : null);
    onCursor(inside ? mm : null);
    const d = drag.current;
    if (!d) return;
    const delta = {
      x: (p.x - d.start.x) / d.view.scale,
      y: (p.y - d.start.y) / d.view.scale,
    };
    if (d.type === "pan") {
      setView({
        ...d.view,
        x: d.view.x + p.x - d.start.x,
        y: d.view.y + p.y - d.start.y,
      });
      return;
    }
    if (d.type === "image" && d.before.image) {
      const orig = d.before.image;
      const xy = snapPoint(
        { x: orig.x + delta.x, y: orig.y + delta.y },
        project.grid,
      );
      update(
        (q) => ({ ...q, image: q.image ? { ...q.image, ...xy } : null }),
        false,
      );
      return;
    }
    if (d.type === "corner" && d.before.image) {
      const orig = d.before.image;
      const center = {
        x: orig.x + orig.width / 2,
        y: orig.y + orig.height / 2,
      };
      const cur = screenToMm(p, d.view, d.view.scale),
        corner = imageCorners(orig)[d.index!];
      const factor = clamp(
        distance(cur, center) / Math.max(0.01, distance(corner, center)),
        Math.max(0.1 / orig.width, 0.1 / orig.height),
        Math.min(10000 / orig.width, 10000 / orig.height),
      );
      const width = orig.width * factor,
        height = orig.height * factor;
      update(
        (q) => ({
          ...q,
          image: q.image
            ? {
                ...q.image,
                width,
                height,
                x: center.x - width / 2,
                y: center.y - height / 2,
              }
            : null,
        }),
        false,
      );
      return;
    }
    const original = d.before.shapes.find((s) => s.id === d.id);
    if (!original) return;
    if (d.type === "label") {
      const offset = original.labelOffset ?? { x: 3, y: -3 };
      update(
        (q) => ({
          ...q,
          shapes: q.shapes.map((s) =>
            s.id === d.id
              ? {
                  ...s,
                  labelOffset: {
                    x: clamp(offset.x + delta.x, -1000, 1000),
                    y: clamp(offset.y + delta.y, -1000, 1000),
                  },
                }
              : s,
          ),
        }),
        false,
      );
      return;
    }
    let a = original.a,
      b = original.b;
    if (d.type === "endpoint") {
      const xy = bounded(screenToMm(p, d.view, d.view.scale));
      if (d.index === 0) a = xy;
      else b = xy;
    } else {
      a = snapPoint({ x: a.x + delta.x, y: a.y + delta.y }, project.grid);
      b = { x: b.x + a.x - original.a.x, y: b.y + a.y - original.a.y };
    }
    if (original.type === "hguide") {
      const y = d.type === "endpoint" ? (d.index === 0 ? a.y : b.y) : a.y;
      a = { x: 0, y };
      b = { x: size.width, y };
    }
    if (original.type === "vguide") {
      const x = d.type === "endpoint" ? (d.index === 0 ? a.x : b.x) : a.x;
      a = { x, y: 0 };
      b = { x, y: size.height };
    }
    update(
      (q) => ({
        ...q,
        shapes: q.shapes.map((s) => (s.id === d.id ? { ...s, a, b } : s)),
      }),
      false,
    );
  }
  function up(e: ReactPointerEvent<SVGSVGElement>) {
    setPanning(false);
    if (touchTap.current?.id === e.pointerId) {
      const tap = touchTap.current;
      touchTap.current = null;
      if (!pinch.current && distance(tap.start, point(e)) < 10) place(tap.mm);
    }
    touches.current.delete(e.pointerId);
    if (pinch.current) {
      if (touches.current.size === 0) pinch.current = null;
      return;
    }
    if (drag.current) {
      if (drag.current.type !== "pan") record(drag.current.before);
      drag.current = null;
    }
  }
  const preview =
    pending && cursor
      ? makeShape(
          tool === "rect" ? "rect" : tool === "measure" ? "measure" : "line",
          pending,
          bounded(cursor),
          "",
        )
      : null;
  return (
    <div
      ref={host}
      className={`workspace tool-${tool} ${space ? "space-pan" : ""} ${panning ? "is-panning" : ""}`}
      style={{ backgroundColor: preferences.workspaceColor }}
    >
      <svg
        ref={svg}
        className="workspace-svg"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancelInteraction}
        onLostPointerCapture={(e) => {
          if (touches.current.has(e.pointerId)) cancelInteraction();
        }}
        onPointerLeave={() => {
          setCursor(null);
          onCursor(null);
        }}
        aria-label={`A4 ${size.width} × ${size.height} 毫米绘画工作区`}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
          <rect
            width={size.width}
            height={size.height}
            fill={preferences.paperColor}
            className="paper-shadow"
          />
          <Drawing
            project={project}
            scale={view.scale}
            selection={selection}
            interactive
            paperColor={preferences.paperColor}
            pointLabels={preferences.labelsVisible}
            labelCoordinates={preferences.labelCoordinates}
            labelLeaders={preferences.labelLeaders}
            labelInk={paperDark ? "#edfff8" : undefined}
            labelHalo={preferences.paperColor}
          />
          <Rulers
            {...size}
            scale={view.scale}
            colors={{ surface: theme.ruler, ink: theme.rulerInk }}
          />
          {preview && (
            <g opacity={0.7} pointerEvents="none">
              <ShapeDrawing shape={preview} scale={view.scale} interactive />
            </g>
          )}
          {cursor && !panning && tool !== "select" && tool !== "pan" && (
            <Crosshair
              point={cursor}
              scale={view.scale}
              full={tool === "point" && preferences.fullCrosshair}
              {...size}
            />
          )}
        </g>
      </svg>
      {tool === "point" && (
        <div className="loupe-toolbar">
          <button
            className={preferences.magnifierEnabled ? "active" : ""}
            aria-label="切换定位放大镜"
            aria-pressed={preferences.magnifierEnabled}
            onClick={() =>
              onPreferences({ magnifierEnabled: !preferences.magnifierEnabled })
            }
          >
            放大镜
          </button>
          {([2, 4, 8] as const).map((n) => (
            <button
              key={n}
              className={preferences.magnifierZoom === n ? "active" : ""}
              aria-label={`放大镜 ${n} 倍`}
              onClick={() => onPreferences({ magnifierZoom: n })}
            >
              {n}×
            </button>
          ))}
        </div>
      )}
      {tool === "point" &&
        preferences.magnifierEnabled &&
        cursor &&
        !panning &&
        (() => {
          const diameter = Math.min(164, Math.max(100, hostSize.width * 0.4)),
            region = diameter / (view.scale * preferences.magnifierZoom);
          const x = view.x + cursor.x * view.scale,
            y = view.y + cursor.y * view.scale;
          const left =
            x + 24 + diameter < hostSize.width
              ? x + 24
              : Math.max(5, x - diameter - 24);
          const top = clamp(
            y - diameter - 24,
            40,
            Math.max(40, hostSize.height - diameter - 60),
          );
          return (
            <div
              className="coordinate-loupe"
              aria-label="局部放大视图"
              style={{ left, top, width: diameter }}
            >
              <header>
                <span>{preferences.magnifierZoom}×</span>
                <code>
                  {fmt(cursor.x)}, {fmt(cursor.y)} mm
                </code>
              </header>
              <svg
                width={diameter}
                height={diameter}
                viewBox={`${cursor.x - region / 2} ${cursor.y - region / 2} ${region} ${region}`}
                style={{ background: preferences.paperColor }}
              >
                <Drawing
                  project={project}
                  id="loupe"
                  scale={view.scale * preferences.magnifierZoom}
                  paperColor={preferences.paperColor}
                  options={{
                    ...defaultDrawOptions,
                    labels: false,
                    border: false,
                  }}
                />
                <Crosshair
                  point={cursor}
                  scale={view.scale * preferences.magnifierZoom}
                />
              </svg>
            </div>
          );
        })()}
      {!project.image && project.shapes.length === 0 && (
        <div
          className="paper-empty"
          style={{
            left: view.x + (size.width * view.scale) / 2,
            top: view.y + (size.height * view.scale) / 2,
            display: tool === "select" ? "flex" : "none",
          }}
        >
          <span className="empty-icon">
            <ImagePlus size={29} strokeWidth={1.4} />
          </span>
          <h2>从一张参考照片开始</h2>
          <p>将照片放入画纸，让每一笔都有坐标</p>
          <button className="primary" onClick={onUpload}>
            <ImagePlus size={15} />
            导入参考图片
          </button>
          <small>JPG、PNG、WEBP · 拖入也可以</small>
          <button className="text-button demo-button" onClick={onDemo}>
            试用建筑构图示例 <ArrowUpRight size={13} />
          </button>
        </div>
      )}
      {pending && (
        <div className="canvas-hint">
          已设置起点 ({fmt(pending.x)}, {fmt(pending.y)}) · 点击终点 · Esc 取消
        </div>
      )}
      {!pending && (
        <div className="canvas-guide">
          <MousePointer2 size={12} />
          空白处左键拖动画纸 <span>·</span> 滚轮缩放
        </div>
      )}
    </div>
  );
});
