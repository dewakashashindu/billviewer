"use client";

// ============================================================
// LOCATION: components/menu/RemarkSheet.tsx
// Order remark dialog (app's menu_cart remark modal, redesigned):
// quick chips + free text, max 160 chars.
// ============================================================

import { useState, type CSSProperties } from "react";
import { T } from "./theme";

const CHIPS = ["No Spicy", "Extra Spicy", "Less Sugar", "No Onions", "Takeaway"];

export default function RemarkSheet({
  open,
  itemName,
  value,
  onSave,
  onClose,
}: {
  open: boolean;
  itemName: string;
  value: string;
  onSave: (remark: string) => void;
  onClose: () => void;
}) {
  // The parent remounts this component per cart row (key), so the draft can
  // simply start from the current remark — no effect needed.
  const [draft, setDraft] = useState(value ?? "");

  if (!open) return null;

  return (
    <div style={s.overlay} className="mnu-anim-fade" onClick={onClose} role="dialog" aria-modal="true">
      <div style={s.card} className="mnu-anim-up" onClick={(e) => e.stopPropagation()}>
        <div style={s.head}>
          <h3 style={s.title}>Order Remark</h3>
          <button type="button" style={s.close} className="mnu-tap" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div style={s.sub} title={itemName}>
          {itemName}
        </div>

        <div style={s.chips}>
          {CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              style={{ ...s.chip, ...(draft === c ? s.chipOn : null) }}
              className="mnu-tap"
              onClick={() => setDraft(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <textarea
          style={s.input}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 160))}
          placeholder="Type custom remark"
          rows={3}
        />
        <div style={s.count}>{draft.length}/160</div>

        <div style={s.actions}>
          <button type="button" style={s.cancel} className="mnu-tap" onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={s.save} className="mnu-tap" onClick={() => onSave(draft.trim())}>
            Save Remark
          </button>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 100,
    background: "rgba(0,0,0,0.66)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    background: "#252320",
    borderRadius: 24,
    padding: 22,
    border: `1px solid ${T.goldLine}`,
    boxShadow: "0 28px 70px rgba(0,0,0,0.55)",
  },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  title: { margin: 0, color: T.white, fontSize: 19, fontWeight: 800 },
  close: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: T.card,
    border: `1px solid ${T.line}`,
    color: T.w55,
    fontSize: 12,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  sub: {
    color: T.gold,
    fontSize: 13,
    fontWeight: 600,
    marginTop: 6,
    marginBottom: 16,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  chips: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: {
    padding: "8px 13px",
    borderRadius: 16,
    background: T.card,
    // longhands so chipOn can override borderColor alone
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: T.line,
    color: T.w55,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  chipOn: { background: T.goldSoft, borderColor: T.gold, color: T.gold },
  input: {
    width: "100%",
    minHeight: 88,
    borderRadius: 14,
    padding: "12px 14px",
    color: T.white,
    fontSize: 14,
    fontFamily: "inherit",
    background: T.card,
    border: `1px solid ${T.line}`,
    outline: "none",
    resize: "vertical",
    boxSizing: "border-box",
  },
  count: { color: T.w40, fontSize: 10.5, textAlign: "right", marginTop: 6 },
  actions: { display: "flex", gap: 10, marginTop: 16 },
  cancel: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    background: T.card,
    border: `1px solid ${T.line}`,
    color: T.w55,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  save: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    background: "linear-gradient(180deg, #469B6A 0%, #3D8C5E 100%)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: T.white,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: T.shadowGreen,
  },
};
