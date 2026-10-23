import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  FolderOpen,
  Save,
  Download,
  Undo2,
  Redo2,
  Settings2,
  MousePointer2,
  MapPin,
  Ruler,
  Minus,
  MoveHorizontal,
  MoveVertical,
  RectangleHorizontal,
  Hand,
  Maximize,
  Plus,
  ZoomOut,
  ZoomIn,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Layers,
  Grid2X2,
  Eye,
  EyeOff,
  LockKeyhole,
  UnlockKeyhole,
  Trash2,
  RotateCcw,
  FlipHorizontal2,
  FlipVertical2,
  Crosshair,
  Check,
  CircleHelp,
  X,
  FilePlus2,
  Copy,
  PanelRightClose,
  PanelRightOpen,
  Scan,
  BookOpen,
  ArrowUpRight,
  PencilRuler,
  Target,
  FileDown,
  Monitor,
  WifiOff,
} from "lucide-react";
import { Workspace, type WorkspaceHandle } from "./Workspace";
import { NumberField, Range, Toggle, Modal } from "./Controls";
import {
  clamp,
  fittedImage,
  fmt,
  makeShape,
  metrics,
  newProject,
  nextPointName,
  paperSize,
  type Project,
  type RefImage,
  type Shape,
  type Tool,
  type Vec,
} from "./model";
import { useProject } from "./useProject";
import {
  importImage,
  loadLocal,
  openPortable,
  saveLocal,
  savePortable,
} from "./storage";
import { exportCsv, exportPdf, exportPng } from "./export";
import { defaultDrawOptions, type DrawOptions } from "./Drawing";
import { demoImage } from "./demo";

const tools: {
  id: Tool;
  label: string;
  key: string;
  icon: typeof MousePointer2;
}[] = [
  { id: "select", label: "选择 / 移动", key: "V", icon: MousePointer2 },
  { id: "point", label: "坐标定位", key: "P", icon: MapPin },
  { id: "measure", label: "测距", key: "M", icon: Ruler },
  { id: "line", label: "直线", key: "L", icon: Minus },
  { id: "hguide", label: "水平辅助线", key: "H", icon: MoveHorizontal },
  { id: "vguide", label: "垂直辅助线", key: "J", icon: MoveVertical },
  { id: "rect", label: "矩形", key: "R", icon: RectangleHorizontal },
  { id: "pan", label: "平移画纸", key: "Space", icon: Hand },
];
const toolDescriptions: Record<Tool, string> = {
  select: "点击选中 · 拖动移动图片或对象",
  point: "点击画纸，添加一个毫米坐标标记",
  measure: "依次点击起点和终点，测量真实画纸距离",
  line: "依次点击两个位置，创建精确线段",
  hguide: "点击画纸，在指定 Y 坐标添加水平线",
  vguide: "点击画纸，在指定 X 坐标添加垂直线",
  rect: "依次点击两个对角，创建矩形",
  pan: "拖动画纸 · 双指可缩放和平移",
};
function App() {
  const state = useProject();
  const { project, update, replace, undo, redo, canUndo, canRedo } = state;
  const [loaded, setLoaded] = useState(false),
    [saveStatus, setSaveStatus] = useState("正在恢复"),
    [tool, setTool] = useState<Tool>("select"),
    [selection, setSelection] = useState<string | null>(null),
    [cursor, setCursor] = useState<Vec | null>(null),
    [zoom, setZoom] = useState(100),
    [space, setSpace] = useState(false),
    [zoomMenu, setZoomMenu] = useState(false),
    [cancelToken, setCancelToken] = useState(0);
  const [panel, setPanel] = useState(() => window.innerWidth > 920),
    [tab, setTab] = useState<"properties" | "objects" | "layers">("properties"),
    [modal, setModal] = useState<"export" | "settings" | "help" | "new" | null>(
      null,
    ),
    [toast, setToast] = useState<{ text: string; error: boolean } | null>(null),
    [busy, setBusy] = useState(false),
    [dragOver, setDragOver] = useState(false),
    [online, setOnline] = useState(navigator.onLine);
  const [calibration, setCalibration] = useState(() => {
    try {
      const n = Number(localStorage.getItem("a4-calibration"));
      return n >= 0.3 && n <= 3 ? n : 1;
    } catch {
      return 1;
    }
  });
  const [pointX, setPointX] = useState(10),
    [pointY, setPointY] = useState(10),
    [exportKind, setExportKind] = useState("pdf"),
    [dpi, setDpi] = useState(300),
    [exportMode, setExportMode] = useState("all"),
    [exportOptions, setExportOptions] =
      useState<DrawOptions>(defaultDrawOptions);
  const workspace = useRef<WorkspaceHandle>(null),
    fileInput = useRef<HTMLInputElement>(null),
    projectInput = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const size = paperSize(project.orientation),
    image = project.image,
    selected = project.shapes.find((s) => s.id === selection);
  const currentTool = tools.find((t) => t.id === tool)!;
  const notify = useCallback((text: string, error = false) => {
    setToast({ text, error });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), error ? 6500 : 3200);
  }, []);
  useEffect(() => {
    let live = true;
    loadLocal()
      .then((p) => {
        if (live) {
          if (p) replace(p);
          setLoaded(true);
          setSaveStatus(p ? "已本地保存" : "本地自动保存");
        }
      })
      .catch(() => {
        if (live) {
          setLoaded(true);
          notify("无法恢复本地项目，可通过“打开项目”导入备份。", true);
        }
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    setSaveStatus("正在保存");
    let live = true;
    const timer = setTimeout(() => {
      saveLocal(project)
        .then(() => {
          if (live) setSaveStatus("已本地保存");
        })
        .catch(() => {
          if (live) {
            setSaveStatus("保存失败");
            notify("本地存储空间不足或不可用，请导出项目文件备份。", true);
          }
        });
    }, 650);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [project, loaded]);
  useEffect(() => {
    const change = () => setOnline(navigator.onLine);
    window.addEventListener("online", change);
    window.addEventListener("offline", change);
    return () => {
      window.removeEventListener("online", change);
      window.removeEventListener("offline", change);
    };
  }, []);
  const patchImage = (patch: Partial<RefImage>) =>
    update((p) => ({ ...p, image: p.image ? { ...p.image, ...patch } : null }));
  const patchShape = (patch: Partial<Shape>) =>
    update((p) => ({
      ...p,
      shapes: p.shapes.map((s) =>
        s.id === selection ? { ...s, ...patch } : s,
      ),
    }));
  const remove = useCallback(() => {
    if (selection === "image") {
      if (state.ref.current.image?.locked) {
        notify("请先解锁图片");
        return;
      }
      update((p) => ({ ...p, image: null }));
    } else if (selection) {
      if (state.ref.current.shapes.find((s) => s.id === selection)?.locked) {
        notify("请先解锁对象");
        return;
      }
      update((p) => ({
        ...p,
        shapes: p.shapes.filter((s) => s.id !== selection),
      }));
    }
    setSelection(null);
  }, [selection]);
  const save = async () => {
    setBusy(true);
    try {
      await saveLocal(state.ref.current);
      await savePortable(state.ref.current);
      notify("已保存可移植项目文件");
    } catch (e) {
      notify(errorText(e), true);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).matches(
          'input,textarea,select,[contenteditable="true"]',
        )
      )
        return;
      if (e.key === "Escape") {
        setCancelToken((n) => n + 1);
        setSelection(null);
        setModal(null);
        return;
      }
      if (modal) return;
      if (e.code === "Space") {
        e.preventDefault();
        setSpace(true);
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === "z") {
          e.preventDefault();
          e.shiftKey ? redo() : undo();
        }
        if (e.key.toLowerCase() === "y") {
          e.preventDefault();
          redo();
        }
        if (e.key.toLowerCase() === "s") {
          e.preventDefault();
          void save();
        }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove();
      }
      const t = tools.find((t) => t.key.toLowerCase() === e.key.toLowerCase());
      if (t) setTool(t.id);
      if (e.key === "0") workspace.current?.fit();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpace(false);
    };
    const blur = () => setSpace(false);
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [remove, modal]);
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const result = await importImage(file);
      const p = state.ref.current,
        fit = fittedImage(
          result.width,
          result.height,
          paperSize(p.orientation),
        );
      if (fit.width < 0.1 || fit.height < 0.1)
        throw new Error("图片长宽比例过大，请裁剪后重试。");
      const im: RefImage = {
        data: result.data,
        name: result.name,
        naturalWidth: result.width,
        naturalHeight: result.height,
        ...fit,
        baseWidth: fit.width,
        rotation: 0,
        flipX: false,
        flipY: false,
        opacity: 1,
        visible: true,
        locked: false,
      };
      update((p) => ({ ...p, image: im }));
      setSelection("image");
      setTool("select");
      setTab("properties");
      notify("图片已导入，仅保存在当前设备");
    } catch (e) {
      notify(errorText(e), true);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  async function open(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const p = await openPortable(file);
      replace(p);
      setSelection(null);
      setCancelToken((n) => n + 1);
      setTimeout(() => workspace.current?.fit(), 0);
      notify("项目已完整恢复");
    } catch (e) {
      notify(errorText(e), true);
    } finally {
      setBusy(false);
      if (projectInput.current) projectInput.current.value = "";
    }
  }
  function demo() {
    const p = state.ref.current,
      fit = fittedImage(1200, 1600, paperSize(p.orientation));
    update((p) => ({
      ...p,
      image: {
        data: demoImage,
        name: "建筑构图示例.svg",
        naturalWidth: 1200,
        naturalHeight: 1600,
        ...fit,
        baseWidth: fit.width,
        rotation: 0,
        flipX: false,
        flipY: false,
        opacity: 0.9,
        visible: true,
        locked: false,
      },
    }));
    setSelection("image");
    notify("示例已加载，试试坐标定位或测距工具");
  }
  function fitImage(fill = false) {
    if (!image) return;
    const fit = fittedImage(
      image.naturalWidth,
      image.naturalHeight,
      size,
      fill,
    );
    patchImage({ ...fit, rotation: 0 });
  }
  function resetImage() {
    if (!image) return;
    const fit = fittedImage(image.naturalWidth, image.naturalHeight, size);
    patchImage({
      ...fit,
      baseWidth: fit.width,
      rotation: 0,
      flipX: false,
      flipY: false,
      opacity: 1,
    });
  }
  function addPoint() {
    const a = { x: pointX, y: pointY };
    const s = makeShape("point", a, a, nextPointName(project.shapes));
    update((p) => ({ ...p, shapes: [...p.shapes, s] }));
    setSelection(s.id);
    setTool("select");
    notify(`已添加 ${s.name} (${fmt(a.x)}, ${fmt(a.y)}) mm`);
  }
  async function doExport() {
    setBusy(true);
    try {
      const opts = {
        ...exportOptions,
        image: exportMode !== "guides",
        grid: ["all", "grid"].includes(exportMode),
        guides: ["all", "guides", "lines"].includes(exportMode),
      };
      if (exportKind === "csv") exportCsv(project);
      else if (exportKind === "png") await exportPng(project, opts, dpi);
      else await exportPdf(project, opts, dpi);
      notify("导出完成");
      setModal(null);
    } catch (e) {
      notify(errorText(e), true);
    } finally {
      setBusy(false);
    }
  }
  const layerRow = (
    label: string,
    icon: typeof ImageIcon,
    visible: boolean,
    onVisibility: () => void,
    locked?: boolean,
    onLock?: () => void,
    count?: string,
  ) => {
    const Icon = icon;
    return (
      <div className="layer-row">
        <span className="layer-symbol">
          <Icon size={17} />
        </span>
        <span className="layer-name">
          {label}
          {count && <small>{count}</small>}
        </span>
        {onLock && (
          <button
            className="icon-button"
            aria-label={`${locked ? "解锁" : "锁定"}${label}`}
            onClick={onLock}
          >
            {locked ? <LockKeyhole size={14} /> : <UnlockKeyhole size={14} />}
          </button>
        )}
        <button
          className={`icon-button ${!visible ? "muted" : ""}`}
          aria-label={`${visible ? "隐藏" : "显示"}${label}`}
          onClick={onVisibility}
        >
          {visible ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
      </div>
    );
  };
  return (
    <div
      className="app"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node))
          setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) {
          if (/\.(a4r|zip|json)$/i.test(file.name)) void open(file);
          else void upload(file);
        }
      }}
    >
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => e.preventDefault()}
          aria-label="A4 绘画标尺工作台"
        >
          <span className="brand-mark">
            <PencilRuler size={23} strokeWidth={1.6} />
          </span>
          <div>
            <strong>
              A4 <span>绘画标尺工作台</span>
            </strong>
            <small>DRAWING RULER</small>
          </div>
        </a>
        <div className="top-separator" />
        <div className="project-heading">
          <input
            aria-label="项目名称"
            maxLength={120}
            value={project.name}
            onChange={(e) =>
              update((p) => ({ ...p, name: e.target.value || "未命名画作" }))
            }
          />
          <span>
            <i className={saveStatus === "保存失败" ? "error-dot" : ""} />
            {saveStatus}
          </span>
        </div>
        <div className="top-actions">
          <button
            className="button quiet desktop-label"
            aria-label="打开项目"
            title="打开项目"
            onClick={() => projectInput.current?.click()}
            disabled={busy}
          >
            <FolderOpen size={16} />
            <span>打开项目</span>
          </button>
          <button
            className="button quiet"
            aria-label="保存项目"
            title="保存项目"
            onClick={() => void save()}
            disabled={busy}
          >
            <Save size={16} />
            <span>保存项目</span>
          </button>
          <button
            className="button export-button"
            onClick={() => setModal("export")}
            disabled={busy}
          >
            <Download size={16} />
            <span>导出</span>
            <ChevronDown size={12} />
          </button>
          <span className="top-separator small" />
          <button
            className="icon-button"
            title="设置与屏幕校准"
            aria-label="设置与屏幕校准"
            onClick={() => setModal("settings")}
          >
            <Settings2 size={18} />
          </button>
        </div>
      </header>
      <div className="toolbar">
        <button
          className="button primary import-button"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
        >
          <Upload size={15} />
          <span>导入图片</span>
        </button>
        <span className="toolbar-divider" />
        <div className="orientation-control" aria-label="画纸方向">
          <button
            className={project.orientation === "portrait" ? "active" : ""}
            aria-label="纵向 A4"
            title="纵向 A4 · 210 × 297 mm"
            onClick={() => update((p) => ({ ...p, orientation: "portrait" }))}
          >
            <span className="paper-icon portrait" /> <span>纵向</span>
          </button>
          <button
            className={project.orientation === "landscape" ? "active" : ""}
            aria-label="横向 A4"
            title="横向 A4 · 297 × 210 mm"
            onClick={() => update((p) => ({ ...p, orientation: "landscape" }))}
          >
            <span className="paper-icon landscape" />
            <span>横向</span>
          </button>
        </div>
        <span className="toolbar-divider" />
        <button
          className="icon-button"
          title="撤销 Ctrl+Z"
          aria-label="撤销"
          disabled={!canUndo}
          onClick={undo}
        >
          <Undo2 size={17} />
        </button>
        <button
          className="icon-button"
          title="重做 Ctrl+Y"
          aria-label="重做"
          disabled={!canRedo}
          onClick={redo}
        >
          <Redo2 size={17} />
        </button>
        <span className="toolbar-divider" />
        <button
          className="button quiet fit-button"
          onClick={() => workspace.current?.fit()}
          title="适应窗口 (0)"
        >
          <Maximize size={15} />
          <span>适应窗口</span>
        </button>
        <div className="toolbar-right">
          <span className="local-badge">
            <span />
            {online ? "图片本地处理" : "离线工作中"}
          </span>
          <button
            className="icon-button"
            title="使用指南"
            aria-label="使用指南"
            onClick={() => setModal("help")}
          >
            <CircleHelp size={17} />
          </button>
          <button
            className="icon-button"
            aria-label={panel ? "折叠属性面板" : "展开属性面板"}
            onClick={() => setPanel(!panel)}
          >
            {panel ? (
              <PanelRightClose size={17} />
            ) : (
              <PanelRightOpen size={17} />
            )}
          </button>
        </div>
      </div>
      <main className="main-layout">
        <nav className="tool-rail" aria-label="绘图工具">
          {tools.map((t, i) => (
            <div key={t.id} className={i === 7 ? "rail-pan" : ""}>
              <button
                className={`tool-button ${tool === t.id ? "active" : ""}`}
                aria-label={t.label}
                aria-pressed={tool === t.id}
                title={`${t.label} (${t.key})`}
                onClick={() => setTool(t.id)}
              >
                <t.icon size={20} strokeWidth={1.7} />
                <span className="tool-tooltip">
                  {t.label}
                  <kbd>{t.key}</kbd>
                </span>
              </button>
            </div>
          ))}
          <div className="rail-bottom">
            <button
              className="tool-button"
              title="新建画作"
              aria-label="新建画作"
              onClick={() => setModal("new")}
            >
              <FilePlus2 size={19} />
            </button>
          </div>
        </nav>
        <section className="canvas-section">
          <div className="canvas-heading">
            <div>
              <span className="paper-tab-dot" />
              画纸 01{" "}
              <span className="canvas-size">
                A4 · {size.width} × {size.height} mm
              </span>
            </div>
            <span className="canvas-heading-right">
              <Target size={13} />
              精确到每一毫米
            </span>
          </div>
          <Workspace
            ref={workspace}
            project={project}
            tool={tool}
            selection={selection}
            setSelection={(id) => {
              setSelection(id);
              if (id && id !== "image") setTab("objects");
            }}
            update={update}
            record={state.record}
            onCursor={setCursor}
            onZoom={setZoom}
            onUpload={() => fileInput.current?.click()}
            onDemo={demo}
            space={space}
            cancelToken={cancelToken}
            calibration={calibration}
            onShape={() => {
              setTab("objects");
            }}
          />
          <div className="tool-context">
            <span className="tool-context-icon">
              <currentTool.icon size={15} />
            </span>
            <strong>{currentTool.label}</strong>
            <span>{toolDescriptions[tool]}</span>
            <kbd>{currentTool.key}</kbd>
          </div>
          <div className="zoom-dock">
            {zoomMenu && (
              <div className="zoom-menu">
                {[25, 50, 75, 100, 150, 200].map((v) => (
                  <button
                    key={v}
                    onClick={() => {
                      workspace.current?.setZoom(v);
                      setZoomMenu(false);
                    }}
                  >
                    {v}%{Math.abs(zoom - v) < 1 && <Check size={12} />}
                  </button>
                ))}
                <hr />
                <button
                  onClick={() => {
                    workspace.current?.fit();
                    setZoomMenu(false);
                  }}
                >
                  适应窗口
                </button>
                <button
                  onClick={() => {
                    workspace.current?.center();
                    setZoomMenu(false);
                  }}
                >
                  居中显示
                </button>
              </div>
            )}
            <button
              className="icon-button"
              aria-label="缩小工作区"
              onClick={() => workspace.current?.setZoom(zoom / 1.2)}
            >
              <ZoomOut size={16} />
            </button>
            <button
              className="zoom-value"
              title="工作区缩放与居中"
              aria-label="工作区缩放选项"
              aria-expanded={zoomMenu}
              onClick={() => setZoomMenu(!zoomMenu)}
            >
              {Math.round(zoom)}%<ChevronDown size={11} />
            </button>
            <button
              className="icon-button"
              aria-label="放大工作区"
              onClick={() => workspace.current?.setZoom(zoom * 1.2)}
            >
              <ZoomIn size={16} />
            </button>
            <span />
            <button
              className="icon-button"
              aria-label="适应窗口"
              title="适应窗口"
              onClick={() => workspace.current?.fit()}
            >
              <Scan size={16} />
            </button>
          </div>
        </section>
        {panel && (
          <aside className="properties-panel">
            <header className="panel-tabs">
              <button
                className={tab === "properties" ? "active" : ""}
                onClick={() => setTab("properties")}
              >
                属性
              </button>
              <button
                className={tab === "objects" ? "active" : ""}
                onClick={() => setTab("objects")}
              >
                标记与辅助线 <small>{project.shapes.length}</small>
              </button>
              <button
                className={tab === "layers" ? "active" : ""}
                onClick={() => setTab("layers")}
              >
                图层
              </button>
              <button
                className="mobile-close icon-button"
                aria-label="关闭属性面板"
                onClick={() => setPanel(false)}
              >
                <X size={16} />
              </button>
            </header>
            <div className="panel-scroll">
              {tab === "properties" && (
                <>
                  <section className="panel-section paper-properties">
                    <div className="section-heading">
                      <h3>
                        <RectangleHorizontal size={15} />
                        画纸
                      </h3>
                      <span className="tiny-badge">ISO A4</span>
                    </div>
                    <div className="paper-info">
                      <span className={`paper-preview ${project.orientation}`}>
                        <span>A4</span>
                      </span>
                      <div>
                        <strong>
                          {size.width} <span>×</span> {size.height}
                          <small>mm</small>
                        </strong>
                        <p>
                          {project.orientation === "portrait"
                            ? "纵向画纸"
                            : "横向画纸"}{" "}
                          <i /> 左上角原点 (0, 0)
                        </p>
                      </div>
                    </div>
                  </section>
                  <section className="panel-section">
                    <div className="section-heading">
                      <h3>
                        <ImageIcon size={15} />
                        参考图片
                      </h3>
                      {image && (
                        <div className="section-actions">
                          <button
                            className="icon-button"
                            title={image.locked ? "解锁图片" : "锁定图片"}
                            aria-label={image.locked ? "解锁图片" : "锁定图片"}
                            onClick={() =>
                              patchImage({ locked: !image.locked })
                            }
                          >
                            {image.locked ? (
                              <LockKeyhole size={14} />
                            ) : (
                              <UnlockKeyhole size={14} />
                            )}
                          </button>
                          <button
                            className="icon-button"
                            title="更换图片"
                            aria-label="更换图片"
                            onClick={() => fileInput.current?.click()}
                          >
                            <Upload size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                    {!image ? (
                      <>
                        <button
                          className="upload-zone"
                          onClick={() => fileInput.current?.click()}
                        >
                          <span>
                            <ImageIcon size={22} strokeWidth={1.4} />
                          </span>
                          <strong>点击或拖拽图片到工作区</strong>
                          <small>JPG / PNG / WEBP，最大 40 MB</small>
                        </button>
                        <p className="subtle-hint">
                          <LockKeyhole size={11} />
                          图片仅在浏览器处理，保护你的创作
                        </p>
                      </>
                    ) : (
                      <>
                        <div
                          className="image-summary"
                          onClick={() => {
                            setSelection("image");
                            setTool("select");
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              setSelection("image");
                              setTool("select");
                            }
                          }}
                        >
                          <img src={image.data} alt="参考图缩略图" />
                          <div>
                            <strong>{image.name}</strong>
                            <small>
                              {image.naturalWidth} × {image.naturalHeight} px
                            </small>
                          </div>
                          <ChevronRight size={14} />
                        </div>
                        <div className="field-grid">
                          <NumberField
                            label="图片 X"
                            value={image.x}
                            disabled={image.locked}
                            onChange={(x) => patchImage({ x })}
                          />
                          <NumberField
                            label="图片 Y"
                            value={image.y}
                            disabled={image.locked}
                            onChange={(y) => patchImage({ y })}
                          />
                          <NumberField
                            label="图片宽度"
                            value={image.width}
                            min={Math.max(0.1, 0.1 * image.width / image.height)}
                            max={Math.min(
                              10000,
                              (10000 * image.width) / image.height,
                            )}
                            disabled={image.locked}
                            onChange={(width) =>
                              patchImage({
                                width,
                                height: (image.height * width) / image.width,
                              })
                            }
                          />
                          <NumberField
                            label="图片高度"
                            value={image.height}
                            min={Math.max(0.1, 0.1 * image.height / image.width)}
                            max={Math.min(
                              10000,
                              (10000 * image.height) / image.width,
                            )}
                            disabled={image.locked}
                            onChange={(height) =>
                              patchImage({
                                height,
                                width: (image.width * height) / image.height,
                              })
                            }
                          />
                          <NumberField
                            label="图片缩放"
                            value={(image.width / image.baseWidth) * 100}
                            unit="%"
                            min={Math.max(0.01, 10 / image.baseWidth, 10 * image.width / image.height / image.baseWidth)}
                            max={Math.min(
                              3000,
                              (10000 / image.baseWidth) * 100,
                              (((10000 / image.height) * image.width) /
                                image.baseWidth) *
                                100,
                            )}
                            disabled={image.locked}
                            onChange={(v) => {
                              const width = (image.baseWidth * v) / 100;
                              patchImage({
                                width,
                                height: (image.height * width) / image.width,
                              });
                            }}
                          />
                          <NumberField
                            label="旋转角度"
                            value={image.rotation}
                            min={-360}
                            max={360}
                            unit="°"
                            disabled={image.locked}
                            onChange={(rotation) => patchImage({ rotation })}
                          />
                        </div>
                        <div className="image-buttons">
                          <button
                            className="button compact"
                            disabled={image.locked}
                            onClick={() => fitImage(false)}
                          >
                            适应画纸
                          </button>
                          <button
                            className="button compact"
                            disabled={image.locked}
                            onClick={() => fitImage(true)}
                          >
                            填满画纸
                          </button>
                          <button
                            className="button compact"
                            disabled={image.locked}
                            onClick={() =>
                              patchImage({
                                x: (size.width - image.width) / 2,
                                y: (size.height - image.height) / 2,
                              })
                            }
                          >
                            居中
                          </button>
                        </div>
                        <div className="image-transform">
                          <button
                            className="icon-button"
                            aria-label="水平翻转"
                            title="水平翻转"
                            disabled={image.locked}
                            onClick={() => patchImage({ flipX: !image.flipX })}
                          >
                            <FlipHorizontal2 size={17} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label="垂直翻转"
                            title="垂直翻转"
                            disabled={image.locked}
                            onClick={() => patchImage({ flipY: !image.flipY })}
                          >
                            <FlipVertical2 size={17} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label="逆时针旋转 90 度"
                            title="旋转 90°"
                            disabled={image.locked}
                            onClick={() =>
                              patchImage({
                                rotation: (image.rotation - 90) % 360,
                              })
                            }
                          >
                            <RotateCcw size={16} />
                          </button>
                          <button
                            className="text-button"
                            disabled={image.locked}
                            onClick={resetImage}
                          >
                            恢复初始位置
                          </button>
                        </div>
                        <Range
                          label="图片透明度"
                          value={image.opacity * 100}
                          onChange={(v) => patchImage({ opacity: v / 100 })}
                        />
                      </>
                    )}
                  </section>
                  <section className="panel-section">
                    <div className="section-heading">
                      <h3>
                        <Grid2X2 size={15} />
                        毫米网格
                      </h3>
                      <Toggle
                        checked={project.grid.enabled}
                        onChange={() =>
                          update((p) => ({
                            ...p,
                            grid: { ...p.grid, enabled: !p.grid.enabled },
                          }))
                        }
                        label="显示网格"
                      />
                    </div>
                    <label className="field-caption">
                      网格间距 <span>mm</span>
                    </label>
                    <div className="spacing-options">
                      {[1, 5, 10, 20].map((v) => (
                        <button
                          key={v}
                          className={project.grid.spacing === v ? "active" : ""}
                          onClick={() =>
                            update((p) => ({
                              ...p,
                              grid: { ...p.grid, spacing: v },
                            }))
                          }
                        >
                          {v}
                        </button>
                      ))}
                      <span className="custom-spacing">
                        <input
                          type="number"
                          aria-label="自定义网格间距"
                          min={1}
                          max={100}
                          placeholder="自定义"
                          value={
                            [1, 5, 10, 20].includes(project.grid.spacing)
                              ? ""
                              : project.grid.spacing
                          }
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            if (Number.isFinite(v) && v >= 1 && v <= 100)
                              update((p) => ({
                                ...p,
                                grid: { ...p.grid, spacing: v },
                              }));
                          }}
                        />
                      </span>
                    </div>
                    <div className="grid-style">
                      <label>
                        网格颜色
                        <input
                          aria-label="网格颜色"
                          type="color"
                          value={project.grid.color}
                          onChange={(e) =>
                            update((p) => ({
                              ...p,
                              grid: { ...p.grid, color: e.target.value },
                            }))
                          }
                        />
                        <code>{project.grid.color.toUpperCase()}</code>
                      </label>
                    </div>
                    <Range
                      label="网格透明度"
                      value={project.grid.opacity * 100}
                      onChange={(v) =>
                        update((p) => ({
                          ...p,
                          grid: { ...p.grid, opacity: v / 100 },
                        }))
                      }
                    />
                    <div className="switch-row">
                      <div>
                        <span>吸附网格</span>
                        <small>拖动与定位时对齐网格交点</small>
                      </div>
                      <Toggle
                        label="吸附网格"
                        checked={project.grid.snap}
                        onChange={() =>
                          update((p) => ({
                            ...p,
                            grid: { ...p.grid, snap: !p.grid.snap },
                          }))
                        }
                      />
                    </div>
                  </section>
                  <section className="panel-section">
                    <div className="section-heading">
                      <h3>
                        <Layers size={15} />
                        图层显示
                      </h3>
                      <button
                        className="text-button"
                        onClick={() => setTab("layers")}
                      >
                        管理 <ChevronRight size={12} />
                      </button>
                    </div>
                    {layerRow(
                      "参考图片",
                      ImageIcon,
                      image?.visible ?? false,
                      () =>
                        image
                          ? patchImage({ visible: !image.visible })
                          : notify("请先导入参考图片"),
                    )}
                    {layerRow(
                      "辅助线与测量",
                      Ruler,
                      project.layers.guides,
                      () =>
                        update((p) => ({
                          ...p,
                          layers: { ...p.layers, guides: !p.layers.guides },
                        })),
                    )}
                  </section>
                </>
              )}
              {tab === "objects" && (
                <>
                  <section className="panel-section">
                    <div className="section-heading">
                      <h3>
                        <MapPin size={15} />
                        精确添加坐标点
                      </h3>
                      <span className="tiny-badge">mm</span>
                    </div>
                    <div className="field-grid">
                      <NumberField
                        label="新点 X"
                        value={pointX}
                        min={0}
                        max={size.width}
                        onChange={setPointX}
                      />
                      <NumberField
                        label="新点 Y"
                        value={pointY}
                        min={0}
                        max={size.height}
                        onChange={setPointY}
                      />
                    </div>
                    <button
                      className="button add-point-button"
                      onClick={addPoint}
                    >
                      <Plus size={14} />
                      添加坐标点 {nextPointName(project.shapes)}
                    </button>
                  </section>
                  {selected && (
                    <section className="panel-section selection-section">
                      <div className="section-heading">
                        <h3>
                          <Crosshair size={15} />
                          选中对象
                        </h3>
                        <div className="section-actions">
                          <button
                            className="icon-button"
                            aria-label={
                              selected.locked ? "解锁对象" : "锁定对象"
                            }
                            onClick={() =>
                              patchShape({ locked: !selected.locked })
                            }
                          >
                            {selected.locked ? (
                              <LockKeyhole size={14} />
                            ) : (
                              <UnlockKeyhole size={14} />
                            )}
                          </button>
                          <button
                            className="icon-button danger"
                            aria-label="删除选中对象"
                            onClick={remove}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <label className="text-field">
                        名称
                        <input
                          aria-label="对象名称"
                          value={selected.name}
                          maxLength={100}
                          disabled={selected.locked}
                          onChange={(e) => patchShape({ name: e.target.value })}
                        />
                      </label>
                      <div className="field-grid">
                        <NumberField
                          label={
                            selected.type === "point" ? "X 坐标" : "起点 X"
                          }
                          value={selected.a.x}
                          disabled={selected.locked}
                          onChange={(x) =>
                            patchShape(
                              selected.type === "vguide"
                                ? {
                                    a: { ...selected.a, x },
                                    b: { ...selected.b, x },
                                  }
                                : { a: { ...selected.a, x } },
                            )
                          }
                        />
                        <NumberField
                          label={
                            selected.type === "point" ? "Y 坐标" : "起点 Y"
                          }
                          value={selected.a.y}
                          disabled={selected.locked}
                          onChange={(y) =>
                            patchShape(
                              selected.type === "hguide"
                                ? {
                                    a: { ...selected.a, y },
                                    b: { ...selected.b, y },
                                  }
                                : { a: { ...selected.a, y } },
                            )
                          }
                        />
                        {selected.type !== "point" && (
                          <>
                            <NumberField
                              label="终点 X"
                              value={selected.b.x}
                              disabled={
                                selected.locked || selected.type === "hguide"
                              }
                              onChange={(x) =>
                                patchShape(
                                  selected.type === "vguide"
                                    ? {
                                        a: { ...selected.a, x },
                                        b: { ...selected.b, x },
                                      }
                                    : { b: { ...selected.b, x } },
                                )
                              }
                            />
                            <NumberField
                              label="终点 Y"
                              value={selected.b.y}
                              disabled={
                                selected.locked || selected.type === "vguide"
                              }
                              onChange={(y) =>
                                patchShape(
                                  selected.type === "hguide"
                                    ? {
                                        a: { ...selected.a, y },
                                        b: { ...selected.b, y },
                                      }
                                    : { b: { ...selected.b, y } },
                                )
                              }
                            />
                          </>
                        )}
                      </div>
                      {selected.type !== "point" && (
                        <div className="measurement-card">
                          {selected.type === "rect" ? (
                            <>
                              <div>
                                <span>宽度 × 高度</span>
                                <strong>
                                  {fmt(Math.abs(selected.b.x - selected.a.x))} ×{" "}
                                  {fmt(Math.abs(selected.b.y - selected.a.y))}{" "}
                                  mm
                                </strong>
                              </div>
                              <div>
                                <span>其余顶点</span>
                                <code>
                                  ({fmt(selected.b.x)}, {fmt(selected.a.y)})
                                  <br />({fmt(selected.a.x)},{" "}
                                  {fmt(selected.b.y)})
                                </code>
                              </div>
                            </>
                          ) : (
                            <>
                              <div>
                                <span>直线长度</span>
                                <strong>
                                  {fmt(metrics(selected.a, selected.b).length)}{" "}
                                  <small>mm</small>
                                </strong>
                              </div>
                              <div>
                                <span>ΔX / ΔY</span>
                                <code>
                                  {fmt(metrics(selected.a, selected.b).dx)} /{" "}
                                  {fmt(metrics(selected.a, selected.b).dy)} mm
                                </code>
                              </div>
                              <div>
                                <span>倾斜角度</span>
                                <code>
                                  {fmt(metrics(selected.a, selected.b).angle)}°
                                </code>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                      <div className="field-grid style-fields">
                        <label className="color-field">
                          线条颜色
                          <input
                            aria-label="对象颜色"
                            type="color"
                            disabled={selected.locked}
                            value={selected.color}
                            onChange={(e) =>
                              patchShape({ color: e.target.value })
                            }
                          />
                        </label>
                        <NumberField
                          label="线宽"
                          value={selected.stroke}
                          min={0.05}
                          max={5}
                          disabled={selected.locked}
                          onChange={(stroke) => patchShape({ stroke })}
                        />
                      </div>
                      <div className="switch-row">
                        <span>虚线</span>
                        <Toggle
                          label="对象虚线"
                          checked={selected.dashed}
                          onChange={() =>
                            !selected.locked &&
                            patchShape({ dashed: !selected.dashed })
                          }
                        />
                      </div>
                      <button
                        className="button copy-button"
                        onClick={() => {
                          const text = `${selected.name}: (${fmt(selected.a.x)}, ${fmt(selected.a.y)}) mm${selected.type === "point" ? "" : ` → (${fmt(selected.b.x)}, ${fmt(selected.b.y)}) mm`}`;
                          navigator.clipboard
                            ?.writeText(text)
                            .then(() => notify("坐标已复制"))
                            .catch(() => notify("请直接选择坐标文本复制"));
                        }}
                      >
                        <Copy size={13} />
                        复制坐标
                      </button>
                      <p className="coordinate-text">
                        {selected.name} = ({fmt(selected.a.x)},{" "}
                        {fmt(selected.a.y)}) mm
                        {selected.type !== "point" &&
                          ` → (${fmt(selected.b.x)}, ${fmt(selected.b.y)}) mm`}
                      </p>
                    </section>
                  )}
                  <section className="panel-section">
                    <div className="section-heading">
                      <h3>所有对象</h3>
                      <span className="tiny-badge">
                        {project.shapes.length}
                      </span>
                    </div>
                    {project.shapes.length === 0 ? (
                      <div className="objects-empty">
                        <MapPin size={25} strokeWidth={1.3} />
                        <strong>记录你的第一个坐标</strong>
                        <p>
                          使用左侧工具点击画纸，
                          <br />
                          或输入精确坐标添加标记。
                        </p>
                      </div>
                    ) : (
                      <div className="object-list">
                        {project.shapes.map((s) => {
                          const Icon =
                            tools.find((t) => t.id === s.type)?.icon ?? Minus;
                          return (
                            <div
                              className={`object-row ${selection === s.id ? "selected" : ""}`}
                              key={s.id}
                            >
                              <button
                                className="object-select"
                                onClick={() => {
                                  setSelection(s.id);
                                  setTool("select");
                                }}
                              >
                                <Icon size={15} color={s.color} />
                                <span>
                                  <strong>{s.name}</strong>
                                  <small>
                                    {fmt(s.a.x)}, {fmt(s.a.y)} mm
                                  </small>
                                </span>
                              </button>
                              <button
                                className="icon-button"
                                aria-label={`${s.visible ? "隐藏" : "显示"}${s.name}`}
                                onClick={() =>
                                  update((p) => ({
                                    ...p,
                                    shapes: p.shapes.map((o) =>
                                      o.id === s.id
                                        ? { ...o, visible: !o.visible }
                                        : o,
                                    ),
                                  }))
                                }
                              >
                                {s.visible ? (
                                  <Eye size={14} />
                                ) : (
                                  <EyeOff size={14} />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </>
              )}
              {tab === "layers" && (
                <section className="panel-section">
                  <div className="section-heading">
                    <h3>
                      <Layers size={15} />
                      画纸图层
                    </h3>
                    <span className="tiny-badge">从上到下</span>
                  </div>
                  {layerRow(
                    "坐标标记",
                    MapPin,
                    project.layers.points,
                    () =>
                      update((p) => ({
                        ...p,
                        layers: { ...p.layers, points: !p.layers.points },
                      })),
                    undefined,
                    undefined,
                    `${project.shapes.filter((s) => s.type === "point").length} 个标记`,
                  )}
                  {layerRow(
                    "辅助线与测量",
                    Ruler,
                    project.layers.guides,
                    () =>
                      update((p) => ({
                        ...p,
                        layers: { ...p.layers, guides: !p.layers.guides },
                      })),
                    undefined,
                    undefined,
                    `${project.shapes.filter((s) => s.type !== "point").length} 个对象`,
                  )}
                  {layerRow(
                    "毫米网格",
                    Grid2X2,
                    project.grid.enabled,
                    () =>
                      update((p) => ({
                        ...p,
                        grid: { ...p.grid, enabled: !p.grid.enabled },
                      })),
                    undefined,
                    undefined,
                    `${project.grid.spacing} mm 间距`,
                  )}
                  {layerRow(
                    "参考图片",
                    ImageIcon,
                    image?.visible ?? false,
                    () =>
                      image
                        ? patchImage({ visible: !image.visible })
                        : notify("请先导入图片"),
                    image?.locked,
                    image
                      ? () => patchImage({ locked: !image.locked })
                      : undefined,
                    image?.name ?? "尚未导入",
                  )}
                  {layerRow(
                    "A4 画纸",
                    RectangleHorizontal,
                    true,
                    () => notify("画纸背景始终可见"),
                    true,
                    undefined,
                    `${size.width} × ${size.height} mm`,
                  )}
                  <div className="panel-note">
                    <Eye size={15} />
                    <p>
                      隐藏参考图片，仅查看辅助线。所有图层始终共用同一套画纸毫米坐标。
                    </p>
                  </div>
                </section>
              )}
            </div>
            <footer className="panel-footer">
              <span className="footer-logo">A4</span>
              <span>
                让构图有据，让创作自由。
                <small>YOUR IDEAS, PRECISELY PLACED.</small>
              </span>
            </footer>
          </aside>
        )}
      </main>
      <footer className="statusbar">
        <div className="status-coordinates">
          <Crosshair size={13} />
          <span>
            X <b>{cursor ? fmt(cursor.x) : "—"}</b>
            <small>mm</small>
          </span>
          <span>
            Y <b>{cursor ? fmt(cursor.y) : "—"}</b>
            <small>mm</small>
          </span>
        </div>
        <div className="status-center">
          <span className="status-dot" />
          {tool === "select" ? "就绪" : currentTool.label}
          <span className="status-zoom">工作区 {Math.round(zoom)}%</span>
        </div>
        <div className="status-right">
          <span>A4 {project.orientation === "portrait" ? "纵向" : "横向"}</span>
          <span className="status-divider" />
          <button
            onClick={() =>
              update((p) => ({ ...p, grid: { ...p.grid, snap: !p.grid.snap } }))
            }
            className={project.grid.snap ? "snap-active" : ""}
          >
            <Grid2X2 size={12} />
            吸附{project.grid.snap ? "开启" : "关闭"}
          </button>
          <span className="status-divider" />
          <span>
            <LockKeyhole size={11} />
            本地存储
          </span>
        </div>
      </footer>
      <input
        ref={fileInput}
        hidden
        type="file"
        accept="image/*"
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      <input
        ref={projectInput}
        hidden
        type="file"
        accept=".a4r,.zip,.json"
        onChange={(e) => void open(e.target.files?.[0])}
      />
      {dragOver && (
        <div className="drop-overlay">
          <Upload size={42} />
          <h2>松开，放入你的参考图片</h2>
          <p>也可以拖入 .a4r 项目文件</p>
        </div>
      )}
      {busy && (
        <div className="busy-pill" role="status">
          <span className="spinner" />
          正在处理，请稍候…
        </div>
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <CircleHelp size={17} /> : <Check size={17} />}
          <span>{toast.text}</span>
          <button aria-label="关闭提示" onClick={() => setToast(null)}>
            <X size={13} />
          </button>
        </div>
      )}
      {modal === "export" && (
        <Modal
          title="导出你的画作"
          subtitle="精确的毫米坐标，带到真实的纸上。"
          onClose={() => setModal(null)}
        >
          <div className="modal-content">
            <div className="export-types">
              {[
                { id: "pdf", name: "A4 PDF", sub: "等比打印", icon: FileDown },
                {
                  id: "png",
                  name: "PNG 图片",
                  sub: "高清图像",
                  icon: ImageIcon,
                },
                {
                  id: "csv",
                  name: "坐标 CSV",
                  sub: "标记与端点",
                  icon: MapPin,
                },
              ].map((o) => (
                <button
                  key={o.id}
                  className={exportKind === o.id ? "active" : ""}
                  onClick={() => setExportKind(o.id)}
                >
                  <o.icon size={22} />
                  <strong>{o.name}</strong>
                  <small>{o.sub}</small>
                </button>
              ))}
            </div>
            {exportKind !== "csv" ? (
              <>
                <label className="select-field">
                  导出内容
                  <select
                    aria-label="导出内容"
                    value={exportMode}
                    onChange={(e) => setExportMode(e.target.value)}
                  >
                    <option value="all">图片 + 网格 + 辅助线</option>
                    <option value="image">仅参考图片</option>
                    <option value="grid">图片 + 网格</option>
                    <option value="lines">图片 + 辅助线</option>
                    <option value="guides">仅辅助线</option>
                  </select>
                </label>
                <label className="select-field">
                  分辨率
                  <select
                    value={dpi}
                    onChange={(e) => setDpi(Number(e.target.value))}
                    aria-label="导出分辨率"
                  >
                    <option value={150}>150 DPI · 预览</option>
                    <option value={300}>300 DPI · 高质量 A4 打印</option>
                  </select>
                </label>
                <div className="export-checkboxes">
                  {[
                    { key: "labels", name: "包含坐标标签" },
                    { key: "rulers", name: "包含毫米标尺（画纸内侧）" },
                    { key: "border", name: "包含页面边框" },
                  ].map((o) => (
                    <label key={o.key}>
                      <input
                        type="checkbox"
                        checked={exportOptions[o.key as keyof DrawOptions]}
                        onChange={(e) =>
                          setExportOptions((p) => ({
                            ...p,
                            [o.key]: e.target.checked,
                          }))
                        }
                      />
                      {o.name}
                    </label>
                  ))}
                </div>
                <div className="print-note">
                  <Ruler size={18} />
                  <p>
                    标准 A4 · {size.width} × {size.height} mm
                    <br />
                    <strong>打印时选择“实际尺寸 / 100%”</strong>
                    ，关闭“适应页面”。导出遵循图层当前的显示状态。
                  </p>
                </div>
              </>
            ) : (
              <p className="modal-description">
                导出全部标记点、线段端点及矩形顶点，保留四位小数。CSV 可使用
                Excel 或文本编辑器打开。
              </p>
            )}
          </div>
          <footer className="modal-actions">
            <button className="button" onClick={() => setModal(null)}>
              取消
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void doExport()}
            >
              <Download size={15} />
              {busy ? "正在导出…" : `导出 ${exportKind.toUpperCase()}`}
            </button>
          </footer>
        </Modal>
      )}
      {modal === "settings" && (
        <Modal
          title="工作台设置"
          subtitle="校准屏幕显示，不改变画纸和导出尺寸。"
          onClose={() => setModal(null)}
        >
          <div className="modal-content">
            <h3 className="modal-section-title">
              <Monitor size={17} />
              屏幕实物标尺校准
            </h3>
            <p className="modal-description">
              将真实直尺放在屏幕旁，调整下方倍率，让绿色线段与直尺的 100 mm
              重合。小屏幕可用 50 mm 线段。
            </p>
            <div className="calibration-box">
              <div
                className="calibration-line"
                style={{ width: ((100 * 96) / 25.4) * calibration }}
              >
                <span>100 mm</span>
                <i />
              </div>
              <div
                className="calibration-line short"
                style={{ width: ((50 * 96) / 25.4) * calibration }}
              >
                <span>50 mm</span>
                <i />
              </div>
            </div>
            <Range
              label="屏幕校准倍率"
              value={calibration * 100}
              min={30}
              max={300}
              onChange={(v) => {
                setCalibration(v / 100);
                try {
                  localStorage.setItem("a4-calibration", String(v / 100));
                } catch {
                  /* export remains available */
                }
              }}
            />
            <div className="image-buttons">
              <button
                className="button"
                onClick={() => {
                  workspace.current?.setZoom(100);
                  notify("已切换至校准后的 100% 屏幕倍率");
                }}
              >
                应用 100% 显示
              </button>
              <button
                className="button"
                onClick={() => {
                  setCalibration(1);
                  try {
                    localStorage.setItem("a4-calibration", "1");
                  } catch {}
                }}
              >
                重置
              </button>
            </div>
            <div className="panel-note">
              <CircleHelp size={16} />
              <p>
                网页 100% 不天然等于物理尺寸。校准仅影响本机显示，PDF 始终以标准
                A4 毫米尺寸导出。
              </p>
            </div>
            <h3 className="modal-section-title offline-title">
              <WifiOff size={17} />
              离线使用
            </h3>
            <p className="modal-description">
              首次完整加载后，核心功能会缓存到设备。可使用浏览器菜单“安装应用”或“添加到主屏幕”。项目和图片保存在当前浏览器中，清理站点数据前请保存项目文件。
            </p>
          </div>
          <footer className="modal-actions">
            <button className="button" onClick={() => setModal("help")}>
              <BookOpen size={14} />
              使用指南
            </button>
            <button className="button primary" onClick={() => setModal(null)}>
              完成
            </button>
          </footer>
        </Modal>
      )}
      {modal === "help" && (
        <Modal
          title="把参考图，准确画到 A4 纸上"
          subtitle="一张照片，一套坐标，自由创作。"
          onClose={() => setModal(null)}
        >
          <div className="modal-content help-content">
            <ol>
              <li>
                <strong>导入并构图</strong>
                <p>
                  上传或拖入照片。拖动图片和四角控制点，或在属性面板输入精确位置、尺寸和旋转角度。
                </p>
              </li>
              <li>
                <strong>找到关键坐标</strong>
                <p>
                  选择坐标定位工具，点击建筑的转角、屋顶和窗沿；或使用“标记与辅助线”输入
                  X/Y。
                </p>
              </li>
              <li>
                <strong>测量并转移到纸上</strong>
                <p>
                  点击测距的起点和终点。虚拟画纸毫米数值可直接用于真实 A4 画纸。
                </p>
              </li>
              <li>
                <strong>保存或等比打印</strong>
                <p>
                  本地自动保存；保存项目可生成含图片的完整备份。PDF
                  打印请选择实际尺寸 100%。
                </p>
              </li>
            </ol>
            <div className="shortcut-grid">
              {[
                ["V", "选择 / 移动"],
                ["P", "坐标定位"],
                ["M", "测距"],
                ["L", "直线"],
                ["R", "矩形"],
                ["H / J", "水平 / 垂直辅助线"],
                ["Space + 拖动", "平移工作区"],
                ["滚轮 / 双指", "缩放工作区"],
                ["Ctrl+Z / Ctrl+Y", "撤销 / 重做"],
                ["Delete / Esc", "删除 / 取消"],
              ].map(([k, v]) => (
                <div key={k}>
                  <kbd>{k}</kbd>
                  <span>{v}</span>
                </div>
              ))}
            </div>
            <p className="panel-note">
              工作区缩放只改变显示大小；图片缩放改变照片在 A4 上占据的毫米尺寸。
            </p>
          </div>
          <footer className="modal-actions">
            <button className="button primary" onClick={() => setModal(null)}>
              开始创作 <ArrowUpRight size={14} />
            </button>
          </footer>
        </Modal>
      )}
      {modal === "new" && (
        <Modal
          title="新建一张画纸"
          subtitle="开始新的构图之前，建议保存当前项目文件。"
          onClose={() => setModal(null)}
        >
          <div className="modal-content">
            <p className="modal-description">
              当前画作将替换为一张空白的纵向
              A4。已下载的项目文件可随时重新打开。
            </p>
          </div>
          <footer className="modal-actions">
            <button className="button" onClick={() => void save()}>
              保存当前项目
            </button>
            <button
              className="button primary"
              onClick={() => {
                replace(newProject());
                setSelection(null);
                setTool("select");
                setCancelToken((n) => n + 1);
                setModal(null);
                setTimeout(() => workspace.current?.fit(), 0);
              }}
            >
              新建画纸
            </button>
          </footer>
        </Modal>
      )}
    </div>
  );
}
function errorText(e: unknown) {
  return e instanceof Error ? e.message : "处理失败，请重试。";
}
export default App;
