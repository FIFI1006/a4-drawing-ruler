import { Palette, Crosshair, Search, Tags } from "lucide-react";
import { Toggle } from "./Controls";
import { themes, chooseTheme, type Preferences } from "./preferences";

export function PreferenceSettings({
  preferences: p,
  onChange,
}: {
  preferences: Preferences;
  onChange: (p: Partial<Preferences>) => void;
}) {
  return (
    <div className="preference-settings">
      <h3 className="modal-section-title">
        <Palette size={17} />
        外观与主题
      </h3>
      <div className="theme-options">
        {(Object.keys(themes) as Preferences["theme"][]).map((id) => (
          <button
            key={id}
            aria-pressed={p.theme === id}
            className={p.theme === id ? "active" : ""}
            onClick={() => onChange(chooseTheme(id))}
          >
            <span style={{ background: themes[id].workspace }}>
              <i style={{ background: themes[id].paper }} />
            </span>
            <strong>{themes[id].name}</strong>
          </button>
        ))}
      </div>
      <div className="appearance-colors">
        <label>
          工作区背景
          <input
            aria-label="工作区背景颜色"
            type="color"
            value={p.workspaceColor}
            onChange={(e) => onChange({ workspaceColor: e.target.value })}
          />
        </label>
        <label>
          画纸预览底色
          <input
            aria-label="画纸预览底色"
            type="color"
            value={p.paperColor}
            onChange={(e) => onChange({ paperColor: e.target.value })}
          />
        </label>
      </div>
      <p className="settings-note">
        只改变预览；原始照片保持不变。导出默认使用白色背景。
      </p>
      <h3 className="modal-section-title">
        <Crosshair size={17} />
        坐标定位辅助
      </h3>
      <div className="switch-row">
        <span>贯穿画纸的十字参考线</span>
        <Toggle
          label="贯穿画纸的十字参考线"
          checked={p.fullCrosshair}
          onChange={() => onChange({ fullCrosshair: !p.fullCrosshair })}
        />
      </div>
      <div className="switch-row">
        <span>
          <Search size={13} /> 局部放大镜
        </span>
        <Toggle
          label="局部放大镜"
          checked={p.magnifierEnabled}
          onChange={() => onChange({ magnifierEnabled: !p.magnifierEnabled })}
        />
      </div>
      <label className="select-field">
        放大镜倍率
        <select
          aria-label="放大镜倍率"
          value={p.magnifierZoom}
          onChange={(e) =>
            onChange({ magnifierZoom: Number(e.target.value) as 2 | 4 | 8 })
          }
        >
          <option value={2}>2×</option>
          <option value={4}>4×</option>
          <option value={8}>8×</option>
        </select>
      </label>
      <h3 className="modal-section-title">
        <Tags size={17} />
        坐标标签
      </h3>
      {[
        { key: "labelsVisible", name: "显示坐标标签" },
        { key: "labelCoordinates", name: "标签包含 X / Y 坐标" },
        { key: "labelLeaders", name: "显示标签引线" },
      ].map((o) => (
        <div className="switch-row" key={o.key}>
          <span>{o.name}</span>
          <Toggle
            label={o.name}
            checked={p[o.key as "labelsVisible"]}
            onChange={() => onChange({ [o.key]: !p[o.key as "labelsVisible"] })}
          />
        </div>
      ))}
      <p className="settings-note">
        选择工具可直接拖动标签；标记点的毫米坐标保持不变。也可在选中点的属性中输入标签偏移。
      </p>
    </div>
  );
}
