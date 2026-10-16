"use client";

// ============================================================
// LOCATION: components/menu/OrderSuccess.tsx
// Step 8 — order confirmed: invoice number + next actions.
// ============================================================

import type { CSSProperties } from "react";
import { T } from "./theme";
import type { ConfirmResult } from "./types";

export default function OrderSuccess({
  result,
  onAddMore,
  onDone,
}: {
  result: ConfirmResult;
  onAddMore: () => void;
  onDone: () => void;
}) {
  return (
    <div style={s.wrap} className="mnu-anim-up">
      <div style={s.tickCircle}>
        <span style={s.tick} />
      </div>
      <h2 style={s.title}>Order Confirmed</h2>
      <p style={s.sub}>
        Your items have been sent to the kitchen.
        <br />
        Please wait — we&apos;ll serve it fresh.
      </p>

      <div style={s.card}>
        <div>
          <div style={s.k}>Invoice No</div>
          <div style={s.v}>{result.invoiceNo || "—"}</div>
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={s.k}>Table</div>
          <div style={{ ...s.v, fontSize: 15 }}>
            {result.tableNo}
            {result.tableGroup ? ` · ${result.tableGroup}` : ""}
          </div>
        </div>
        {result.itemCount > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={s.k}>Items added</div>
            <div style={{ ...s.v, fontSize: 15 }}>{result.itemCount}</div>
          </div>
        )}
      </div>

      <div style={s.actions}>
        <button type="button" style={s.primary} onClick={onAddMore}>
          Add more items
        </button>
        <button type="button" style={s.ghost} onClick={onDone}>
          Done
        </button>
      </div>

      <p style={s.note}>
        Payment at the counter. Your final bill link is sent by SMS / shown at the till.
      </p>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  wrap: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "60px 30px",
    maxWidth: 560,
    margin: "0 auto",
    width: "100%",
  },
  tickCircle: {
    width: 96,
    height: 96,
    borderRadius: "50%",
    background: T.greenSoft,
    border: `2px solid ${T.green}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  tick: {
    width: 34,
    height: 18,
    borderLeft: "4px solid #6FCF97",
    borderBottom: "4px solid #6FCF97",
    transform: "rotate(-45deg) translateY(-3px)",
    display: "block",
  },
  title: { margin: 0, color: T.white, fontSize: 24, fontWeight: 800 },
  sub: { color: T.w55, fontSize: 13.5, lineHeight: 1.7, margin: "10px 0 0" },
  card: {
    background: T.surface,
    border: `1px solid ${T.line}`,
    borderRadius: 16,
    padding: "18px 26px",
    margin: "22px 0 26px",
    minWidth: 260,
    textAlign: "center",
  },
  k: { color: T.w40, fontSize: 10.5, letterSpacing: 1.3, textTransform: "uppercase" },
  v: { color: T.gold, fontSize: 19, fontWeight: 700, marginTop: 5, letterSpacing: 0.6 },
  actions: { display: "flex", gap: 12, width: "100%", maxWidth: 420 },
  primary: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    background: T.gold,
    border: "none",
    color: T.white,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: T.shadowGold,
  },
  ghost: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    background: T.card,
    border: `1px solid ${T.line}`,
    color: T.w92,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  note: { color: T.w25, fontSize: 11.5, marginTop: 18, lineHeight: 1.6 },
};
