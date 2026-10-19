"use client";

// ============================================================
// LOCATION: components/menu/OrderSuccess.tsx
// Step 8 — order confirmed: invoice number + next actions (redesigned).
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
        <span style={s.tickGlow} aria-hidden />
        <span style={s.tick} />
      </div>
      <h2 style={s.title}>Order Confirmed</h2>
      <p style={s.sub}>
        {result.orderType === "TA"
          ? "Your takeaway order has been sent to the kitchen. Please collect it at the counter when your number is called."
          : "Your items have been sent to the kitchen."}
        <br />
        {result.orderType === "TA" ? "Thank you!" : "Please wait — we'll serve it fresh."}
      </p>

      <div style={s.card}>
        <div style={s.cardRow}>
          <div>
            <div style={s.k}>Invoice No</div>
            <div style={s.v}>{result.invoiceNo || "—"}</div>
          </div>
          <div style={s.cardDivider} />
          <div>
            <div style={s.k}>{result.orderType === "TA" ? "Takeaway No" : "Table"}</div>
            <div style={{ ...s.v, fontSize: 16 }}>
              {result.orderType === "TA" ? "Takeaway" : result.tableNo}
              {result.orderType !== "TA" && result.tableGroup
                ? ` · ${result.tableGroup}`
                : ""}
            </div>
          </div>
          {result.itemCount > 0 && (
            <>
              <div style={s.cardDivider} />
              <div>
                <div style={s.k}>Items added</div>
                <div style={{ ...s.v, fontSize: 16 }}>{result.itemCount}</div>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={s.actions}>
        <button type="button" style={s.primary} className="mnu-tap" onClick={onAddMore}>
          Add more items
        </button>
        <button type="button" style={s.ghost} className="mnu-tap" onClick={onDone}>
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
    position: "relative",
    width: 100,
    height: 100,
    borderRadius: "50%",
    background: T.greenSoft,
    border: "2px solid " + T.green,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    boxShadow: "0 0 0 10px rgba(61,140,94,0.08), 0 16px 40px rgba(61,140,94,0.25)",
  },
  tickGlow: {
    position: "absolute",
    inset: -2,
    borderRadius: "50%",
    border: "2px solid rgba(111,207,151,0.5)",
    animation: "mnuSuccessPing 1.6s ease-out 1",
  },
  tick: {
    width: 36,
    height: 19,
    borderLeft: "4.5px solid #6FCF97",
    borderBottom: "4.5px solid #6FCF97",
    transform: "rotate(-45deg) translateY(-3px)",
    display: "block",
  },
  title: { margin: 0, color: T.white, fontSize: 25, fontWeight: 800, letterSpacing: 0.2 },
  sub: { color: T.w55, fontSize: 13.5, lineHeight: 1.75, margin: "10px 0 0" },
  card: {
    background: T.surface,
    border: `1px solid ${T.line}`,
    borderRadius: 18,
    padding: "18px 10px",
    margin: "24px 0 26px",
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
  },
  cardRow: { display: "flex", alignItems: "stretch", justifyContent: "space-around", gap: 6 },
  cardDivider: { width: 1, background: T.line, alignSelf: "stretch" },
  k: { color: T.w40, fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700 },
  v: { color: T.gold, fontSize: 19, fontWeight: 800, marginTop: 6, letterSpacing: 0.6 },
  actions: { display: "flex", gap: 12, width: "100%", maxWidth: 420 },
  primary: {
    flex: 1,
    height: 52,
    borderRadius: 15,
    background: "linear-gradient(180deg, rgba(186,131,66,0.98), rgba(171,119,60,0.95))",
    border: "1px solid rgba(255,255,255,0.14)",
    color: T.white,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: T.shadowGold,
  },
  ghost: {
    flex: 1,
    height: 52,
    borderRadius: 15,
    background: T.card,
    border: `1px solid ${T.line}`,
    color: T.w92,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },
  note: { color: T.w40, fontSize: 11.5, marginTop: 20, lineHeight: 1.65, maxWidth: 340 },
};
