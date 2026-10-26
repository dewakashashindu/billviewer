"use client";

// ============================================================
// LOCATION: components/dashboard/RangeController.tsx  (ALUTH FILE)
//
// Dashboard aluth section 2katama WENAMA (independent) date controller.
//   • presets: Today / Yesterday / 7 Days / 30 Days / This Month
//   • custom From..To (two date inputs)
//
// ⚠️ Local date use karanawa (toISOString UTC nisa Sri Lanka +5:30 wala
//    business date eka dawasakin shift wenawa — repo eke anith thana
//    thiyena pattern ekama).
// ============================================================
import { useState } from "react";
import { DASH } from "./charts";

const p2 = (n: number) => String(n).padStart(2, "0");
export const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const shift = (base: Date, days: number) => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + days);
  return d;
};

export type RangePreset = "today" | "yesterday" | "7d" | "30d" | "month";

export function presetRange(p: RangePreset, now = new Date()): { from: string; to: string } {
  const today = isoLocal(now);
  switch (p) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = isoLocal(shift(now, -1));
      return { from: y, to: y };
    }
    case "7d":
      return { from: isoLocal(shift(now, -6)), to: today };
    case "30d":
      return { from: isoLocal(shift(now, -29)), to: today };
    case "month":
    default:
      return {
        from: isoLocal(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: today,
      };
  }
}

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "month", label: "This Month" },
];

export default function RangeController({
  from,
  to,
  onChange,
  preset,
  disabled = false,
  compact = false,
  accent,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  /** highlight the active preset (undefined = custom) */
  preset?: RangePreset;
  disabled?: boolean;
  compact?: boolean;
  /** active chip colour (kitchen tab ekata green) */
  accent?: string;
}) {
  const [busy, setBusy] = useState<RangePreset | null>(null);

  const activeBg = accent ?? DASH.dark;
  const input: React.CSSProperties = {
    border: `1px solid ${DASH.border}`,
    borderRadius: 8,
    padding: compact ? "4px 7px" : "5px 8px",
    fontSize: 11,
    fontWeight: 700,
    color: DASH.accent,
    background: "#fff",
    fontFamily: "inherit",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap",
        justifyContent: "flex-end",
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: 0.7,
          color: DASH.muted,
          marginRight: 2,
        }}
      >
        DATE RANGE
      </span>

      {PRESETS.map((p) => {
        const on = preset === p.key;
        return (
          <button
            key={p.key}
            type="button"
            disabled={disabled}
            onClick={() => {
              setBusy(p.key);
              const r = presetRange(p.key);
              onChange(r.from, r.to);
            }}
            style={{
              border: `1px solid ${on ? activeBg : DASH.border}`,
              background: on ? activeBg : "#fff",
              color: on ? "#FDF6E9" : DASH.accent,
              borderRadius: 999,
              padding: compact ? "4px 10px" : "5px 12px",
              fontSize: 10.5,
              fontWeight: 700,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.6 : 1,
              fontFamily: "inherit",
            }}
          >
            {p.label}
            {busy === p.key ? "" : ""}
          </button>
        );
      })}

      <span
        style={{
          width: 1,
          height: 18,
          background: DASH.border,
          margin: "0 2px",
        }}
      />

      <input
        type="date"
        value={from}
        max={to || undefined}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value, to)}
        style={input}
        aria-label="From date"
      />
      <span style={{ fontSize: 11, color: DASH.muted, fontWeight: 700 }}>→</span>
      <input
        type="date"
        value={to}
        min={from || undefined}
        disabled={disabled}
        onChange={(e) => onChange(from, e.target.value)}
        style={input}
        aria-label="To date"
      />
    </div>
  );
}
