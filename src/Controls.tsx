import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
export function NumberField({
  label,
  value,
  onChange,
  unit = "mm",
  min = -100000,
  max = 100000,
  step = 0.1,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(String(Number(value.toFixed(3))));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setDraft(String(Number(value.toFixed(3))));
    setInvalid(false);
  }, [value]);
  const commit = () => {
    const v = Number(draft);
    if (draft.trim() !== "" && Number.isFinite(v) && v >= min && v <= max) {
      if (v !== value) onChange(v);
      setInvalid(false);
    } else {
      setDraft(String(Number(value.toFixed(3))));
      setInvalid(true);
    }
  };
  return (
    <label className={`number-field ${invalid ? "invalid" : ""}`}>
      <span>{label}</span>
      <div>
        <input
          aria-label={label}
          type="number"
          value={draft}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            setDraft(e.target.value);
            setInvalid(false);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(String(Number(value.toFixed(3))));
              e.currentTarget.blur();
            }
          }}
        />
        <small>{unit}</small>
      </div>
      {invalid && (
        <em>
          请输入 {min} 至 {max} 的数值
        </em>
      )}
    </label>
  );
}
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`toggle ${checked ? "on" : ""}`}
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={onChange}
    >
      <span />
    </button>
  );
}
export function Range({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  suffix = "%",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <label className="range-control">
      <span>
        {label}
        <b>
          {Math.round(value)}
          {suffix}
        </b>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const old = document.activeElement as HTMLElement | null;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const modal = document.querySelector(".modal");
        const focusables = modal?.querySelectorAll<HTMLElement>(
          'button,input,select,[tabindex="0"]',
        );
        if (!focusables?.length) return;
        const first = focusables[0],
          last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    const first = document.querySelector<HTMLElement>(".modal button");
    first?.focus();
    return () => {
      document.removeEventListener("keydown", handler);
      old?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" aria-label="关闭" onClick={onClose}>
            <X size={19} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
