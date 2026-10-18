// ============================================================
// LOCATION: components/order/RemarkSheet.tsx
// "Special request" editor for one cart line — a small bottom
// sheet with quick phrases and a free-text field.
// ============================================================
"use client";

import { useEffect, useState } from "react";
import { C } from "./theme";

const QUICK = [
  "Less spicy",
  "Extra spicy",
  "No onion",
  "No chilli",
  "Well done",
  "Less salt",
  "Extra cheese",
  "No sugar",
];

export default function RemarkSheet({
  itemName,
  value,
  onSave,
  onClose,
}: {
  itemName: string;
  value: string;
  onSave: (remark: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(value);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="ord-sheet-backdrop" onClick={onClose} />
      <div className="ord-sheet" role="dialog" aria-modal="true" aria-label="Special request">
        <div className="ord-sheet-grab" />

        <div style={{ padding: "8px 20px 4px" }}>
          <div className="ord-eyebrow">Special request</div>
          <div className="ord-title" style={{ marginTop: 4 }}>
            {itemName}
          </div>
        </div>

        <div className="ord-scroll" style={{ padding: "14px 20px 0", overflowY: "auto" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {QUICK.map((q) => {
              const on = text.trim().toLowerCase() === q.toLowerCase();
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => setText(on ? "" : q)}
                  className="ord-tap"
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: C.font,
                    border: `1px solid ${on ? C.primary : C.line}`,
                    background: on ? C.primary : C.surface,
                    color: on ? "#FFF9F2" : C.ink2,
                  }}
                >
                  {q}
                </button>
              );
            })}
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={160}
            rows={3}
            placeholder="e.g. please make it less spicy, no coriander…"
            style={{
              width: "100%",
              border: `1px solid ${C.line}`,
              borderRadius: 16,
              padding: "12px 14px",
              fontFamily: C.font,
              fontSize: 14,
              lineHeight: 1.5,
              color: C.ink,
              background: C.surface,
              resize: "none",
              outline: "none",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 6,
              fontSize: 11.5,
              color: C.ink3,
            }}
          >
            <span>Sent to the kitchen with this line</span>
            <span>{text.length}/160</span>
          </div>
        </div>

        <div
          className="ord-safe-bottom"
          style={{ padding: "16px 20px 18px", display: "flex", gap: 10 }}
        >
          <button
            type="button"
            onClick={onClose}
            className="ord-btn ord-btn-ghost"
            style={{ height: 48, flex: 1, fontSize: 14 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(text)}
            className="ord-btn ord-btn-primary"
            style={{ height: 48, flex: 2, fontSize: 14.5 }}
          >
            Save request
          </button>
        </div>
      </div>
    </>
  );
}
