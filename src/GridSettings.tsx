import { Grid2X2 } from "lucide-react";
import { NumberField, Range, Toggle } from "./Controls";
import type { Grid } from "./model";
export const gridColors = [
  { name: "青色", value: "#00bcd4" },
  { name: "红色", value: "#ff4040" },
  { name: "黄色", value: "#ffde00" },
  { name: "绿色", value: "#23d160" },
  { name: "白色", value: "#ffffff" },
  { name: "黑色", value: "#000000" },
];
export function GridSettings({
  grid: g,
  onChange,
}: {
  grid: Grid;
  onChange: (p: Partial<Grid>) => void;
}) {
  return (
    <section className="panel-section enhanced-grid">
      <div className="section-heading">
        <h3>
          <Grid2X2 size={15} />
          毫米网格
        </h3>
        <Toggle
          label="显示网格"
          checked={g.enabled}
          onChange={() => onChange({ enabled: !g.enabled })}
        />
      </div>
      <h4>次网格</h4>
      <div className="spacing-options">
        {[1, 5, 10, 20].map((v) => (
          <button
            key={v}
            className={g.spacing === v ? "active" : ""}
            aria-label={`网格间距 ${v} mm`}
            onClick={() => onChange({ spacing: v })}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="field-grid">
        <NumberField
          label="自定义网格间距"
          value={g.spacing}
          min={1}
          max={100}
          onChange={(spacing) => onChange({ spacing })}
        />
        <NumberField
          label="次网格线宽"
          value={g.stroke}
          min={0.5}
          max={6}
          unit="px"
          onChange={(stroke) => onChange({ stroke })}
        />
      </div>
      <div className="grid-color-presets">
        {gridColors.map((c) => (
          <button
            key={c.name}
            title={c.name}
            aria-label={`${c.name}网格`}
            aria-pressed={g.color.toLowerCase() === c.value}
            style={{ background: c.value }}
            onClick={() => onChange({ color: c.value })}
          />
        ))}
      </div>
      <label className="grid-color-field">
        次网格颜色
        <input
          aria-label="网格颜色"
          type="color"
          value={g.color}
          onChange={(e) => onChange({ color: e.target.value })}
        />
        <code>{g.color.toUpperCase()}</code>
      </label>
      <Range
        label="网格透明度"
        value={g.opacity * 100}
        onChange={(v) => onChange({ opacity: v / 100 })}
      />
      <div className="section-heading major-heading">
        <h4>主网格</h4>
        <Toggle
          label="显示主网格"
          checked={g.majorEnabled}
          onChange={() => onChange({ majorEnabled: !g.majorEnabled })}
        />
      </div>
      <div className="field-grid">
        <NumberField
          label="主网格间距"
          value={g.majorSpacing}
          min={1}
          max={500}
          onChange={(majorSpacing) => onChange({ majorSpacing })}
        />
        <NumberField
          label="主网格线宽"
          value={g.majorStroke}
          min={0.5}
          max={6}
          unit="px"
          onChange={(majorStroke) => onChange({ majorStroke })}
        />
      </div>
      <label className="grid-color-field">
        主网格颜色
        <input
          aria-label="主网格颜色"
          type="color"
          value={g.majorColor}
          onChange={(e) => onChange({ majorColor: e.target.value })}
        />
        <code>{g.majorColor.toUpperCase()}</code>
      </label>
      <Range
        label="主网格透明度"
        value={g.majorOpacity * 100}
        onChange={(v) => onChange({ majorOpacity: v / 100 })}
      />
      <div className="switch-row">
        <div>
          <span>高对比度网格</span>
          <small>黑白双描边，适应明暗照片区域</small>
        </div>
        <Toggle
          label="高对比度网格"
          checked={g.highContrast}
          onChange={() => onChange({ highContrast: !g.highContrast })}
        />
      </div>
      <div className="switch-row">
        <div>
          <span>吸附网格</span>
          <small>对齐次网格的毫米交点</small>
        </div>
        <Toggle
          label="吸附网格"
          checked={g.snap}
          onChange={() => onChange({ snap: !g.snap })}
        />
      </div>
    </section>
  );
}
