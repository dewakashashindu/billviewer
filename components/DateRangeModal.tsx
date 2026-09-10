"use client";

// ============================================================
// Date range popup — report ekak click kalama wadinna one modal eka
// ============================================================
import { useEffect, useState } from "react";
import { getLocationsAction } from "@/app/actions/reports";

/** POS 1.1.1 / 1.1.2 — අමතර filter dropdown spec එක (client-safe, type-only) */
export interface DateRangeFilterSpec {
  param: string; // URL param (om / bt)
  label: string;
  options: { value: string; label: string }[];
}

export interface DateRangeModalProps {
  open: boolean;
  title: string;
  linked: boolean; // false nam "coming soon" message eka witharak
  onClose: () => void;
  /** අමතර filter එකක් (Order Mode / Bill Type) — නැත්නම් undefined */
  filter?: DateRangeFilterSpec;
  onApply: (
    from: string,
    to: string,
    loc: string,
    extra?: { param: string; value: string }
  ) => void;
}

// local date (toISOString UTC nisa 31/Dec day-shift wenna)
const p2 = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) =>
  `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

export default function DateRangeModal({
  open,
  title,
  linked,
  onClose,
  filter,
  onApply,
}: DateRangeModalProps) {
  const now = new Date();
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), 0, 1)));
  const [to, setTo] = useState(iso(now));
  const [err, setErr] = useState<string | null>(null);
  const [loc, setLoc] = useState(""); // "" = All Locations
  // Order Mode / Bill Type selection — param එක track කරනවා, ඒ නිසා
  // වෙනත් report එකකට යනකොට පරණ value එක reset වෙනවා (effect එකක් නැතුව)
  const [extraSel, setExtraSel] = useState<{ param: string; value: string }>({
    param: "",
    value: "",
  });
  const extra =
    filter && extraSel.param === filter.param
      ? extraSel.value
      : (filter?.options[0]?.value ?? "");
  const [locations, setLocations] = useState<
    { code: string; name: string }[]
  >([]);

  // modal eka open unama locations load (DB eken)
  useEffect(() => {
    if (!open || locations.length > 0) return;
    let alive = true;
    getLocationsAction().then((res) => {
      if (!alive) return;
      if (res.success && Array.isArray(res.data)) setLocations(res.data);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const presets: { label: string; get: () => [string, string] }[] = [
    { label: "Today", get: () => [iso(new Date()), iso(new Date())] },
    {
      label: "Yesterday",
      get: () => {
        const y = new Date(Date.now() - 86400000);
        return [iso(y), iso(y)];
      },
    },
    {
      label: "This Week",
      get: () => {
        const d = new Date();
        const day = d.getDay() || 7; // Mon=1..Sun=7
        const mon = new Date(d);
        mon.setDate(d.getDate() - day + 1);
        return [iso(mon), iso(d)];
      },
    },
    {
      label: "This Month",
      get: () => [
        iso(new Date(now.getFullYear(), now.getMonth(), 1)),
        iso(now),
      ],
    },
    {
      label: "This Year",
      get: () => [iso(new Date(now.getFullYear(), 0, 1)), iso(now)],
    },
    {
      label: "Last 30 Days",
      get: () => [iso(new Date(Date.now() - 30 * 86400000)), iso(now)],
    },
  ];

  const apply = () => {
    if (!from || !to) {
      setErr("Please select both From and To dates");
      return;
    }
    if (new Date(from) > new Date(to)) {
      setErr("'From' date must be before or equal to 'To' date");
      return;
    }
    setErr(null);
    onApply(from, to, loc, filter ? { param: filter.param, value: extra } : undefined);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(15,23,42,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#ffffff",
          borderRadius: 14,
          width: "100%",
          maxWidth: 400,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          overflow: "hidden",
          animation: "drmIn 0.18s ease-out",
        }}
      >
        <style>{`@keyframes drmIn { from { opacity:0; transform: scale(.95) translateY(10px);} to { opacity:1; transform:none;} }`}</style>

        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1,
                color: "#64748b",
                textTransform: "uppercase",
              }}
            >
              Select Date Range
            </p>
            <h3 style={{ margin: "2px 0 0", fontSize: 15, color: "#0f172a" }}>
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "#f1f5f9",
              color: "#475569",
              width: 30,
              height: 30,
              borderRadius: 999,
              cursor: "pointer",
              fontSize: 15,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {!linked ? (
          <div style={{ padding: "26px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>🚧</div>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 600,
                color: "#0f172a",
              }}
            >
              This report is not available yet
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#64748b" }}>
              This report has not been linked yet. Click "OK" to
              continue.
            </p>
            <button
              onClick={onClose}
              style={{
                marginTop: 16,
                border: "none",
                background: "#0f172a",
                color: "#fff",
                padding: "9px 22px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              OK
            </button>
          </div>
        ) : (
          <div style={{ padding: "18px 20px 20px" }}>
            {/* Presets */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginBottom: 16,
              }}
            >
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => {
                    const [f, t] = p.get();
                    setFrom(f);
                    setTo(t);
                    setErr(null);
                  }}
                  style={{
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    color: "#334155",
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: "6px 11px",
                    borderRadius: 999,
                    cursor: "pointer",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Location */}
            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#64748b",
                  marginBottom: 5,
                }}
              >
                Location
              </label>
              <select
                value={loc}
                onChange={(e) => setLoc(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: "9px 10px",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#0f172a",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                <option value="">All Locations</option>
                {locations.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Extra filter (Order Mode / Bill Type) — POS 1.1.1 / 1.1.2 */}
            {filter && (
              <div style={{ marginBottom: 12 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#64748b",
                    marginBottom: 5,
                  }}
                >
                  {filter.label}
                </label>
                <select
                  value={extra}
                  onChange={(e) =>
                    filter && setExtraSel({ param: filter.param, value: e.target.value })
                  }
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: "9px 10px",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#0f172a",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  {filter.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date inputs */}
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#64748b",
                    marginBottom: 5,
                  }}
                >
                  From
                </label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setErr(null);
                  }}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: "9px 10px",
                    fontSize: 13,
                    color: "#0f172a",
                    background: "#fff",
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#64748b",
                    marginBottom: 5,
                  }}
                >
                  To
                </label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setErr(null);
                  }}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: "9px 10px",
                    fontSize: 13,
                    color: "#0f172a",
                    background: "#fff",
                  }}
                />
              </div>
            </div>

            {err && (
              <p
                style={{
                  margin: "10px 0 0",
                  fontSize: 12,
                  color: "#dc2626",
                  fontWeight: 500,
                }}
              >
                {err}
              </p>
            )}

            {/* Actions */}
            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                marginTop: 18,
              }}
            >
              <button
                onClick={onClose}
                style={{
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  color: "#334155",
                  padding: "9px 18px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={apply}
                style={{
                  border: "none",
                  background: "linear-gradient(135deg,#0f172a,#1e3a5f)",
                  color: "#fff",
                  padding: "9px 22px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                View Report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
