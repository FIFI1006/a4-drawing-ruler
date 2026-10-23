import type { Project, Shape, Vec } from "./model";
import { fmt, metrics, paperSize, imageCorners } from "./model";

export function Rulers({
  width,
  height,
  scale = 3.78,
  inside = false,
  colors,
}: {
  width: number;
  height: number;
  scale?: number;
  inside?: boolean;
  colors?: { surface: string; ink: string };
}) {
  const step = scale < 0.75 ? 10 : scale < 2 ? 5 : 1;
  const labelStep = scale < 0.6 ? 100 : scale < 1.2 ? 50 : scale < 2 ? 20 : 10;
  const thickness = inside ? 5 : 22 / scale;
  const font = inside ? 2.2 : 9 / scale;
  return (
    <g
      className="rulers"
      fill={colors?.ink ?? "#71807d"}
      fontFamily="'SFMono-Regular',Consolas,monospace"
      fontSize={font}
      pointerEvents="none"
    >
      <rect
        x={0}
        y={inside ? 0 : -thickness}
        width={width}
        height={thickness}
        fill={inside ? "#ffffffd9" : (colors?.surface ?? "#f7f9f8")}
      />
      <rect
        x={inside ? 0 : -thickness}
        y={0}
        width={thickness}
        height={height}
        fill={inside ? "#ffffffd9" : (colors?.surface ?? "#f7f9f8")}
      />
      {Array.from(
        { length: Math.floor(width / step) + 1 },
        (_, k) => k * step,
      ).map((n) => (
        <g key={"x" + n}>
          <line
            x1={n}
            x2={n}
            y1={inside ? 0 : 0}
            y2={
              (inside ? 1 : -1) *
              (n % 10 === 0
                ? thickness * 0.38
                : n % 5 === 0
                  ? thickness * 0.25
                  : thickness * 0.13)
            }
            stroke={colors?.ink ?? "#8c9995"}
            strokeWidth={inside ? 0.12 : 0.65 / scale}
          />
          {n % labelStep === 0 && n > 0 && (
            <text
              x={n + 1 / scale}
              y={inside ? thickness * 0.88 : -thickness * 0.5}
            >
              {n}
            </text>
          )}
        </g>
      ))}
      {Array.from(
        { length: Math.floor(height / step) + 1 },
        (_, k) => k * step,
      ).map((n) => (
        <g key={"y" + n}>
          <line
            x1={0}
            x2={
              (inside ? 1 : -1) *
              (n % 10 === 0
                ? thickness * 0.38
                : n % 5 === 0
                  ? thickness * 0.25
                  : thickness * 0.13)
            }
            y1={n}
            y2={n}
            stroke={colors?.ink ?? "#8c9995"}
            strokeWidth={inside ? 0.12 : 0.65 / scale}
          />
          {n % labelStep === 0 && n > 0 && (
            <text
              transform={`translate(${inside ? thickness * 0.85 : -thickness * 0.5} ${n + 1 / scale}) rotate(-90)`}
            >
              {n}
            </text>
          )}
        </g>
      ))}
      {!inside && (
        <>
          <rect
            x={-thickness}
            y={-thickness}
            width={thickness}
            height={thickness}
            fill={colors?.surface ?? "#eaf0ed"}
          />
          <text
            x={-thickness / 2}
            y={-thickness / 2 + font / 3}
            textAnchor="middle"
            fill={colors?.ink ?? "#80938c"}
            fontSize={font * 0.8}
          >
            mm
          </text>
        </>
      )}
    </g>
  );
}
export function ShapeDrawing({
  shape: s,
  scale = 3.78,
  selected = false,
  labels = true,
  interactive = false,
  labelCoordinates = true,
  labelLeaders = true,
  labelInk,
  labelHalo = "white",
}: {
  shape: Shape;
  scale?: number;
  selected?: boolean;
  labels?: boolean;
  interactive?: boolean;
  labelCoordinates?: boolean;
  labelLeaders?: boolean;
  labelInk?: string;
  labelHalo?: string;
}) {
  const textSize = interactive ? 11 / scale : 2.5;
  const lineProps = {
    stroke: s.color,
    strokeWidth: s.stroke,
    strokeDasharray: s.dashed ? "2 1.3" : undefined,
    fill: "none",
  };
  const m = metrics(s.a, s.b);
  const label =
    s.type === "measure"
      ? `${fmt(m.length)} mm`
      : s.type === "rect"
        ? `${fmt(Math.abs(m.dx))} × ${fmt(Math.abs(m.dy))} mm`
        : "";
  const a = s.a,
    b = s.b;
  const offset = s.labelOffset ?? { x: 3, y: -3 };
  const ink = labelInk ?? s.color;
  return (
    <g
      data-object={s.id}
      opacity={s.visible ? 1 : 0}
      style={{
        cursor: interactive ? (s.locked ? "grab" : "move") : undefined,
      }}
    >
      {s.type === "point" ? (
        <>
          <circle
            cx={a.x}
            cy={a.y}
            r={interactive ? 4 / scale : 1}
            fill={s.color}
            stroke="white"
            strokeWidth={interactive ? 1.5 / scale : 0.3}
          />
          <path
            d={`M${a.x - 2},${a.y}h4 M${a.x},${a.y - 2}v4`}
            stroke={s.color}
            strokeWidth={0.15}
          />
          {labels && labelLeaders && s.labelOffset && (
            <line
              data-label-leader={s.id}
              x1={a.x}
              y1={a.y}
              x2={a.x + offset.x}
              y2={a.y + offset.y}
              stroke={ink}
              strokeWidth={interactive ? 0.8 / scale : 0.15}
              pointerEvents="none"
            />
          )}
          {labels && (
            <text
              data-label={interactive ? s.id : undefined}
              style={{ cursor: interactive && !s.locked ? "grab" : undefined }}
              x={a.x + offset.x}
              y={a.y + offset.y}
              fontSize={textSize}
              fontWeight="600"
              fill={ink}
              paintOrder="stroke"
              stroke={labelHalo}
              strokeWidth={interactive ? 3 / scale : 0.7}
            >
              {s.name}{" "}
              {labelCoordinates && (
                <tspan fontWeight="400" fontSize={textSize * 0.85}>
                  ({fmt(a.x)}, {fmt(a.y)})
                </tspan>
              )}
            </text>
          )}
        </>
      ) : s.type === "rect" ? (
        <rect
          x={Math.min(a.x, b.x)}
          y={Math.min(a.y, b.y)}
          width={Math.abs(b.x - a.x)}
          height={Math.abs(b.y - a.y)}
          {...lineProps}
        />
      ) : (
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...lineProps} />
      )}
      {interactive &&
        s.type !== "point" &&
        (s.type === "rect" ? (
          <rect
            x={Math.min(a.x, b.x)}
            y={Math.min(a.y, b.y)}
            width={Math.abs(b.x - a.x)}
            height={Math.abs(b.y - a.y)}
            fill="none"
            stroke="transparent"
            strokeWidth={10 / scale}
          />
        ) : (
          <line
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="transparent"
            strokeWidth={10 / scale}
          />
        ))}
      {labels && label && (
        <text
          x={(a.x + b.x) / 2}
          y={(a.y + b.y) / 2 - 5 / scale}
          textAnchor="middle"
          fontSize={textSize}
          fill={ink}
          paintOrder="stroke"
          stroke={labelHalo}
          strokeWidth={interactive ? 4 / scale : 1}
        >
          {label}
        </text>
      )}
      {selected &&
        !s.locked &&
        s.type !== "point" &&
        [a, b].map((p, i) => (
          <circle
            key={i}
            data-endpoint={i}
            data-object={s.id}
            cx={p.x}
            cy={p.y}
            r={4.5 / scale}
            fill="white"
            stroke={s.color}
            strokeWidth={1.5 / scale}
            style={{ cursor: "crosshair" }}
          />
        ))}
      {selected && s.type === "point" && (
        <circle
          cx={a.x}
          cy={a.y}
          r={8 / scale}
          fill="none"
          stroke={s.color}
          strokeWidth={1 / scale}
        />
      )}
    </g>
  );
}
export type DrawOptions = {
  image: boolean;
  grid: boolean;
  guides: boolean;
  labels: boolean;
  border: boolean;
  rulers: boolean;
  background?: string;
};
export const defaultDrawOptions: DrawOptions = {
  image: true,
  grid: true,
  guides: true,
  labels: true,
  border: true,
  rulers: false,
};
export function Drawing({
  project: p,
  scale = 3.78,
  selection,
  interactive = false,
  options = defaultDrawOptions,
  id = "paper",
  paperColor,
  pointLabels = true,
  labelCoordinates = true,
  labelLeaders = true,
  labelInk,
  labelHalo,
}: {
  project: Project;
  scale?: number;
  selection?: string | null;
  interactive?: boolean;
  options?: DrawOptions;
  id?: string;
  paperColor?: string;
  pointLabels?: boolean;
  labelCoordinates?: boolean;
  labelLeaders?: boolean;
  labelInk?: string;
  labelHalo?: string;
}) {
  const size = paperSize(p.orientation),
    im = p.image;
  const spacing = p.grid.spacing;
  const pattern = (major: boolean) => {
    const step = major ? p.grid.majorSpacing : spacing;
    const color = major ? p.grid.majorColor : p.grid.color;
    const px = major ? p.grid.majorStroke : p.grid.stroke;
    const d = `M${step} 0 H0 V${step}`;
    return (
      <pattern
        id={`${id}-${major ? "major" : "grid"}`}
        width={step}
        height={step}
        patternUnits="userSpaceOnUse"
      >
        {p.grid.highContrast && (
          <>
            <path
              d={d}
              fill="none"
              stroke="#000000"
              strokeOpacity={0.8}
              strokeWidth={(px + 2.5) / scale}
            />
            <path
              d={d}
              fill="none"
              stroke="#ffffff"
              strokeWidth={(px + 1.3) / scale}
            />
          </>
        )}
        <path
          data-grid-part={major ? "major" : "minor"}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={px / scale}
        />
      </pattern>
    );
  };
  return (
    <>
      <defs>
        <clipPath id={`${id}-clip`}>
          <rect width={size.width} height={size.height} />
        </clipPath>
        {pattern(false)}
        {pattern(true)}
      </defs>
      <rect
        data-paper-background="true"
        width={size.width}
        height={size.height}
        fill={paperColor ?? options.background ?? "white"}
      />
      <g clipPath={`url(#${id}-clip)`}>
        {im && im.visible && options.image && (
          <g
            transform={`translate(${im.x + im.width / 2} ${im.y + im.height / 2}) rotate(${im.rotation}) scale(${im.flipX ? -1 : 1} ${im.flipY ? -1 : 1})`}
          >
            <image
              data-image="true"
              href={im.data}
              x={-im.width / 2}
              y={-im.height / 2}
              width={im.width}
              height={im.height}
              preserveAspectRatio="none"
              opacity={im.opacity}
              style={{
                cursor: interactive ? (im.locked ? "grab" : "move") : undefined,
              }}
            />
          </g>
        )}
        {p.grid.enabled && options.grid && (
          <g data-layer="grid" pointerEvents="none">
            <rect
              width={size.width}
              height={size.height}
              fill={`url(#${id}-grid)`}
              opacity={p.grid.opacity}
            />
            {p.grid.majorEnabled && (
              <rect
                width={size.width}
                height={size.height}
                fill={`url(#${id}-major)`}
                opacity={p.grid.majorOpacity}
              />
            )}
          </g>
        )}
        {options.guides &&
          p.shapes
            .filter(
              (s) =>
                s.visible &&
                (s.type === "point" ? p.layers.points : p.layers.guides),
            )
            .sort((a, b) => {
              const level = (s: Shape) =>
                interactive && s.id === selection
                  ? 2
                  : s.type === "point"
                    ? 1
                    : 0;
              return level(a) - level(b);
            })
            .map((s) => (
              <ShapeDrawing
                key={s.id}
                shape={s}
                scale={scale}
                selected={interactive && selection === s.id}
                labels={options.labels && (s.type !== "point" || pointLabels)}
                interactive={interactive}
                labelCoordinates={labelCoordinates}
                labelLeaders={labelLeaders}
                labelInk={labelInk}
                labelHalo={labelHalo}
              />
            ))}
        {options.rulers && <Rulers {...size} inside />}
      </g>
      {options.border && (
        <rect
          width={size.width}
          height={size.height}
          stroke="#b9c3be"
          strokeWidth={interactive ? 0.7 / scale : 0.15}
          fill="none"
          pointerEvents="none"
        />
      )}
      {interactive && selection === "image" && im && im.visible && (
        <g>
          <polygon
            points={imageCorners(im)
              .map((p) => `${p.x},${p.y}`)
              .join(" ")}
            stroke="#2c8c76"
            fill="none"
            strokeWidth={1 / scale}
            strokeDasharray={
              im.locked ? `${3 / scale} ${3 / scale}` : undefined
            }
            pointerEvents="none"
          />
          {!im.locked &&
            imageCorners(im).map((c, i) => (
              <rect
                key={i}
                data-corner={i}
                x={c.x - 4 / scale}
                y={c.y - 4 / scale}
                width={8 / scale}
                height={8 / scale}
                fill="white"
                stroke="#247e6c"
                strokeWidth={1.5 / scale}
                style={{ cursor: i % 2 ? "nesw-resize" : "nwse-resize" }}
              />
            ))}
        </g>
      )}
    </>
  );
}
export function Crosshair({
  point: p,
  scale,
  full = false,
  width = 210,
  height = 297,
}: {
  point: Vec;
  scale: number;
  full?: boolean;
  width?: number;
  height?: number;
}) {
  const d = full
    ? `M0 ${p.y}H${width}M${p.x} 0V${height}`
    : `M${p.x - 10 / scale} ${p.y}h${20 / scale}M${p.x} ${p.y - 10 / scale}v${20 / scale}`;
  return (
    <g data-crosshair={full ? "full" : "local"} pointerEvents="none">
      <path
        d={d}
        stroke="#000"
        strokeOpacity={0.65}
        strokeWidth={3 / scale}
        fill="none"
      />
      <path d={d} stroke="#fff" strokeWidth={1.8 / scale} fill="none" />
      <path d={d} stroke="#00bfa5" strokeWidth={0.8 / scale} fill="none" />
    </g>
  );
}
