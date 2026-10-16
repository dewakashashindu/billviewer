"use client";

// ============================================================
// LOCATION: components/menu/RemarkSheet.tsx
// Order remark dialog (app's menu_cart remark modal):
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
        <h3 style={s.title}>Order Remark</h3>
        <div style={s.sub} title={itemName}>
          {itemName}
        </div>

        <div style={s.chips}>
          {CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              style={{ ...s.chip, ...(draft === c ? s.chipOn : null) }}
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

        <div style={s.actions}>
          <button type="button" style={s.cancel} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={s.save} onClick={() => onSave(draft.trim())}>
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
    background: "rgba(0,0,0,0.68)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    background: T.surface,
    borderRadius: 22,
    padding: 22,
    border: `1px solid ${T.line}`,
  },
  title: { margin: 0, color: T.white, fontSize: 20, fontWeight: 800 },
  sub: { color: T.w55, fontSize: 13, marginTop: 5, marginBottom: 16 },
  chips: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: {
    padding: "7px 12px",
    borderRadius: 16,
    background: T.card,
    // longhands so chipOn can override borderColor alone
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: T.line,
    color: T.w55,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  chipOn: { background: T.goldSoft, borderColor: T.gold, color: T.gold },
  input: {
    width: "100%",
    minHeight: 84,
    borderRadius: 13,
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
  actions: { display: "flex", gap: 10, marginTop: 18 },
  cancel: {
    flex: 1,
    height: 48,
    borderRadius: 13,
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
    borderRadius: 13,
    background: T.green,
    border: "none",
    color: T.white,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },
};
