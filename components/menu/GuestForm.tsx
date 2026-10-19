"use client";

// ============================================================
// LOCATION: components/menu/GuestForm.tsx
// Step 1.5 — the guest details form shown between the welcome
// screen and the menu:
//   • Local Pax   (Tbl_HoldUpsCloud.LPax)
//   • Foreign Pax (Tbl_HoldUpsCloud.FPax)
//   • Customer Name (Tbl_HoldUpsCloud.CusName)
// Submitted once, saved per table (localStorage via the cart
// hook) and sent with every order confirm.
// ============================================================

import { useState, type CSSProperties } from "react";
import { T } from "./theme";
import type { GuestDetails } from "./useCustomerCart";

export default function GuestForm({
  table,
  tableGroup,
  initial,
  onSubmit,
}: {
  table: string;
  tableGroup?: string;
  initial: GuestDetails;
  onSubmit: (guest: GuestDetails) => void;
}) {
  const [localPax, setLocalPax] = useState(initial.localPax > 0 ? initial.localPax : 1);
  const [foreignPax, setForeignPax] = useState(initial.foreignPax);
  const [cusName, setCusName] = useState(initial.cusName);

  const total = localPax + foreignPax;
  const canContinue = total >= 1;

  const clamp = (v: number) => Math.max(0, Math.min(50, v));

  return (
    <div style={s.root} className="mnu-min-dvh">
      <div style={s.col} className="mnu-anim-up">
        {/* table context chip */}
        <div style={s.tableChip}>
          <span style={s.tableDot} />
          Table&nbsp;<b style={{ color: T.gold }}>{table}</b>
          {tableGroup ? <>&nbsp;·&nbsp;{tableGroup}</> : null}
        </div>

        <div style={s.head}>
          <div style={s.eyebrow}>One quick step</div>
          <h2 style={s.title}>Tell us about your table</h2>
          <p style={s.sub}>This helps the kitchen prepare for you.</p>
        </div>

        <div style={s.card}>
          {/* Local Pax */}
          <div style={s.field}>
            <div style={s.fieldHead}>
              <span style={s.fieldLabel}>Local guests</span>
              <span style={s.fieldCode}>LPax</span>
            </div>
            <div style={s.stepperRow}>
              <button
                type="button"
                style={s.stepBtn}
                className="mnu-tap"
                aria-label="Fewer local guests"
                disabled={localPax <= 0}
                onClick={() => setLocalPax(clamp(localPax - 1))}
              >
                −
              </button>
              <span style={s.stepVal}>{localPax}</span>
              <button
                type="button"
                style={s.stepBtn}
                className="mnu-tap"
                aria-label="More local guests"
                disabled={localPax >= 50}
                onClick={() => setLocalPax(clamp(localPax + 1))}
              >
                +
              </button>
            </div>
          </div>

          <div style={s.divider} />

          {/* Foreign Pax */}
          <div style={s.field}>
            <div style={s.fieldHead}>
              <span style={s.fieldLabel}>Foreign guests</span>
              <span style={s.fieldCode}>FPax</span>
            </div>
            <div style={s.stepperRow}>
              <button
                type="button"
                style={s.stepBtn}
                className="mnu-tap"
                aria-label="Fewer foreign guests"
                disabled={foreignPax <= 0}
                onClick={() => setForeignPax(clamp(foreignPax - 1))}
              >
                −
              </button>
              <span style={s.stepVal}>{foreignPax}</span>
              <button
                type="button"
                style={s.stepBtn}
                className="mnu-tap"
                aria-label="More foreign guests"
                disabled={foreignPax >= 50}
                onClick={() => setForeignPax(clamp(foreignPax + 1))}
              >
                +
              </button>
            </div>
          </div>

          <div style={s.divider} />

          {/* Customer Name */}
          <div style={s.field}>
            <div style={s.fieldHead}>
              <span style={s.fieldLabel}>Customer name</span>
              <span style={s.fieldCode}>CusName · optional</span>
            </div>
            <input
              value={cusName}
              onChange={(e) => setCusName(e.target.value.slice(0, 100))}
              placeholder="e.g. Perera family"
              style={s.input}
              maxLength={100}
            />
          </div>
        </div>

        <div style={s.totalRow}>
          <span>Total guests</span>
          <b>{total}</b>
        </div>

        <button
          type="button"
          style={{ ...s.continue, ...(canContinue ? null : s.continueOff) }}
          className="mnu-tap"
          disabled={!canContinue}
          onClick={() =>
            onSubmit({
              localPax,
              foreignPax,
              cusName: cusName.trim(),
            })
          }
        >
          Continue to Menu
        </button>

        <p style={s.note}>Staff will confirm the details at your table.</p>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  root: {
    background: `radial-gradient(900px 480px at 85% -10%, rgba(171,119,60,0.12), transparent 60%), ${T.bg}`,
    color: T.white,
    fontFamily: T.font,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    overflowY: "auto",
  },
  col: {
    width: "100%",
    maxWidth: 460,
    margin: "0 auto",
    padding: "48px 22px 40px",
    display: "flex",
    flexDirection: "column",
    minHeight: "100dvh",
  },
  tableChip: {
    alignSelf: "center",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 16px",
    borderRadius: 20,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.55)",
    fontSize: 12.5,
  },
  tableDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: T.green,
    boxShadow: "0 0 8px rgba(61,140,94,0.9)",
  },
  head: { textAlign: "center", marginTop: 26 },
  eyebrow: {
    color: "rgba(171,119,60,0.95)",
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  title: { margin: "8px 0 0", color: T.white, fontSize: 25, fontWeight: 800 },
  sub: { color: T.w55, fontSize: 13, lineHeight: 1.6, margin: "8px 0 0" },
  card: {
    marginTop: 24,
    background: T.card,
    border: `1px solid ${T.line}`,
    borderRadius: 20,
    padding: "8px 18px",
    boxShadow: "0 14px 34px rgba(0,0,0,0.3)",
  },
  field: { padding: "16px 0" },
  fieldHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 11,
  },
  fieldLabel: { color: T.w92, fontSize: 14, fontWeight: 700 },
  fieldCode: {
    color: T.gold,
    fontSize: 9.5,
    fontWeight: 800,
    letterSpacing: 1.2,
    background: T.goldSoft,
    border: `1px solid ${T.goldLine}`,
    borderRadius: 7,
    padding: "3px 8px",
  },
  stepperRow: { display: "flex", alignItems: "center", gap: 14 },
  stepBtn: {
    width: 42,
    height: 42,
    borderRadius: 13,
    background: T.surface,
    border: `1px solid ${T.line}`,
    color: T.white,
    fontSize: 20,
    fontWeight: 700,
    cursor: "pointer",
  },
  stepVal: {
    minWidth: 40,
    textAlign: "center",
    color: T.gold,
    fontSize: 22,
    fontWeight: 800,
  },
  input: {
    width: "100%",
    height: 46,
    borderRadius: 13,
    background: T.cardDeep,
    border: `1px solid ${T.line}`,
    color: T.white,
    padding: "0 14px",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  },
  divider: { height: 1, background: T.line },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    padding: "0 6px",
    color: T.w55,
    fontSize: 13,
  },
  continue: {
    marginTop: 14,
    width: "100%",
    height: 54,
    borderRadius: 16,
    background: "linear-gradient(180deg, rgba(186,131,66,0.98), rgba(171,119,60,0.95))",
    border: "1px solid rgba(255,255,255,0.16)",
    color: T.white,
    fontSize: 16,
    fontWeight: 800,
    letterSpacing: 0.2,
    cursor: "pointer",
    boxShadow: T.shadowGold,
  },
  continueOff: { opacity: 0.45, boxShadow: "none", cursor: "not-allowed" },
  note: {
    color: T.w40,
    fontSize: 11.5,
    textAlign: "center",
    marginTop: 14,
    lineHeight: 1.6,
  },
};
