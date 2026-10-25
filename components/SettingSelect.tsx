"use client";

import Icon from "./Icon";

type Props = {
  label: string;
  value: string;
  options: string[];
  disabled?: boolean;
  compact?: boolean;
  onChange: (v: string) => void;
};

const display = (v: string) => (v === "awb" ? "AWB" : v);

/** Mockup-style setting card: small label, large value, chevron. */
export default function SettingSelect({ label, value, options, disabled, compact, onChange }: Props) {
  const opts = options.length ? options : [value];
  return (
    <label
      className={`relative flex flex-col justify-center rounded-xl border border-line/10 bg-panel2 px-3 ${compact ? "py-1.5" : "py-2.5"} ${
        disabled ? "opacity-50" : "hover:border-line/25"
      }`}
    >
      <span className="text-xs text-muted">{label}</span>
      <span className="flex items-center justify-between gap-2">
        <span className="text-lg font-semibold">{display(value)}</span>
        <Icon name="chevron" className="h-4 w-4 text-muted" />
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        aria-label={label}
      >
        {opts.map((o) => (
          <option key={o} value={o}>
            {display(o)}
          </option>
        ))}
      </select>
    </label>
  );
}
