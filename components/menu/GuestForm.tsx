"use client";

// ============================================================
// LOCATION: components/menu/GuestForm.tsx
// Step 1.5 — guest details between the welcome screen and the menu.
//
//   DINE-IN (table QR)
//     • Local / Foreign pax  — MANDATORY (at least one guest)
//     • Phone number         — MANDATORY → checked against
//                              Tbl_CustomerMaster:
//                                found → name auto-filled + CusCode kept
//                                not found → name typed by the guest
//     • Customer name        — MANDATORY
//
//   TAKEAWAY (TA QR)
//     • No pax (hidden / skipped)
//     • Phone + customer name — MANDATORY
//
// Nothing is sent to the kitchen before this form is complete.
// ============================================================

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { T } from "./theme";
import type { GuestDetails } from "./useCustomerCart";

type LookupState = "idle" | "checking" | "found" | "new" | "error";

const digits = (v: string) => v.replace(/[^0-9]/g, "");

export default function GuestForm({
  table,
  tableGroup,
  takeaway = false,
  initial,
  onSubmit,
}: {
  table: string;
  tableGroup?: string;
  takeaway?: boolean;
  initial: GuestDetails;
  onSubmit: (guest: GuestDetails) => void;
}) {
  /* starts at 0 — pax is mandatory, so the guest must pick it */
  const [localPax, setLocalPax] = useState(initial.localPax);
  const [foreignPax, setForeignPax] = useState(initial.foreignPax);
  const [cusName, setCusName] = useState(initial.cusName);
  const [phone, setPhone] = useState(initial.cusPhone);
  const [cusCode, setCusCode] = useState(initial.cusCode);
  const [lookup, setLookup] = useState<LookupState>(
    initial.cusCode && initial.cusName ? "found" : "idle"
  );
  const [touched, setTouched] = useState(false);
  const lookupTimer = useRef<number | null>(null);
  const lastLookup = useRef("");

  const total = localPax + foreignPax;
  const phoneDigits = digits(phone);
  const phoneValid = phoneDigits.length >= 9 && phoneDigits.length <= 15;
  const nameValid = cusName.trim().length >= 2;
  const paxValid = takeaway || total >= 1;
  const canContinue = phoneValid && nameValid && paxValid;

  const clamp = (v: number) => Math.max(0, Math.min(50, v));

  /* ── phone → Tbl_CustomerMaster ────────────────────────────
     Debounced lookup; a found customer's name + code are
     adopted, a missing one asks for the name manually. */
  const runLookup = useCallback(async (value: string) => {
    const d = digits(value);
    if (d.length < 9) {
      setLookup("idle");
      setCusCode("");
      return;
    }
    if (lastLookup.current === d) return;
    lastLookup.current = d;
    setLookup("checking");
    try {
      const res = await fetch(`/api/customer/lookup?phone=${encodeURIComponent(d)}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setLookup("error");
        return;
      }
      if (json.data?.found) {
        setCusCode(String(json.data.cusCode ?? ""));
        setCusName(String(json.data.cusName ?? ""));
        setLookup("found");
      } else {
        setCusCode("");
        setLookup("new");
      }
    } catch {
      setLookup("error");
    }
  }, []);

  useEffect(() => {
    if (lookupTimer.current) window.clearTimeout(lookupTimer.current);
    if (phoneDigits.length < 9) {
      lastLookup.current = "";
      /* defer the state reset out of the effect body */
      void Promise.resolve().then(() => setLookup("idle"));
      return;
    }
    lookupTimer.current = window.setTimeout(() => void runLookup(phone), 450);
    return () => {
      if (lookupTimer.current) window.clearTimeout(lookupTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneDigits]);

  const submit = () => {
    setTouched(true);
    if (!canContinue) return;
    onSubmit({
      localPax: takeaway ? 0 : localPax,
      foreignPax: takeaway ? 0 : foreignPax,
      cusName: cusName.trim(),
      cusPhone: phoneDigits,
      cusCode: cusCode.trim(),
    });
  };

  const phoneError = touched && !phoneValid ? "A valid phone number is required." : null;
  const nameError = touched && !nameValid ? "Your name is required." : null;
  const paxError = touched && !paxValid ? "Please enter how many guests are dining." : null;

  return (
    <div style={s.root} className="mnu-min-dvh">
      <div style={s.col} className="mnu-anim-up">
        {/* context chip */}
        <div style={s.tableChip}>
          <span style={s.tableDot} />
          {takeaway ? (
            <>
              <b style={{ color: T.gold }}>Takeaway</b>&nbsp;· no table needed
            </>
          ) : (
            <>
              Table&nbsp;<b style={{ color: T.gold }}>{table}</b>
              {tableGroup ? <>&nbsp;·&nbsp;{tableGroup}</> : null}
            </>
          )}
        </div>

        <div style={s.head}>
          <div style={s.eyebrow}>{takeaway ? "Takeaway order" : "One quick step"}</div>
          <h2 style={s.title}>
            {takeaway ? "Who is this order for?" : "Tell us about your table"}
          </h2>
          <p style={s.sub}>
            {takeaway
              ? "We only need your name and phone number."
              : "This helps the kitchen prepare for you."}
          </p>
        </div>

        <div style={s.card}>
          {/* Phone (mandatory) */}
          <div style={s.field}>
            <div style={s.fieldHead}>
              <span style={s.fieldLabel}>
                Phone number <span style={{ color: T.gold }}>*</span>
              </span>
            </div>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value.slice(0, 20))}
              onBlur={() => void runLookup(phone)}
              placeholder="07X XXX XXXX"
              inputMode="tel"
              autoComplete="tel"
              style={{ ...s.input, borderColor: phoneError ? T.red : T.line }}
              maxLength={20}
            />
            {phoneError && <div style={s.err}>{phoneError}</div>}
            {lookup === "checking" && <div style={s.hint}>Checking…</div>}
            {lookup === "found" && (
              <div style={{ ...s.hint, color: T.green }}>
                ✓ Welcome back{cusName ? `, ${cusName}` : ""} — name filled from your last visit.
              </div>
            )}
            {lookup === "new" && (
              <div style={s.hint}>New number — please enter your name below.</div>
            )}
            {lookup === "error" && (
              <div style={{ ...s.hint, color: T.red }}>
                Could not check the number — you can continue and enter your name.
              </div>
            )}
          </div>

          <div style={s.divider} />

          {/* Customer Name (mandatory) */}
          <div style={s.field}>
            <div style={s.fieldHead}>
              <span style={s.fieldLabel}>
                Customer name <span style={{ color: T.gold }}>*</span>
              </span>
            </div>
            <input
              value={cusName}
              onChange={(e) => setCusName(e.target.value.slice(0, 100))}
              placeholder="e.g. Perera family"
              autoComplete="name"
              style={{ ...s.input, borderColor: nameError ? T.red : T.line }}
              maxLength={100}
            />
            {nameError && <div style={s.err}>{nameError}</div>}
          </div>

          {/* Pax (dine-in only) */}
          {!takeaway && (
            <>
              <div style={s.divider} />
              <div style={s.field}>
                <div style={s.fieldHead}>
                  <span style={s.fieldLabel}>
                    Guests <span style={{ color: T.gold }}>*</span>
                  </span>
                </div>

                {[
                  { label: "Local guests", value: localPax, set: setLocalPax },
                  { label: "Foreign guests", value: foreignPax, set: setForeignPax },
                ].map((row) => (
                  <div key={row.label} style={s.paxRow}>
                    <span style={s.paxLabel}>{row.label}</span>
                    <div style={s.stepperRow}>
                      <button
                        type="button"
                        style={{ ...s.stepBtn, ...(row.value <= 0 ? s.stepOff : null) }}
                        className="mnu-tap"
                        aria-label={`Fewer ${row.label}`}
                        disabled={row.value <= 0}
                        onClick={() => row.set(clamp(row.value - 1))}
                      >
                        −
                      </button>
                      <span style={s.stepVal}>{row.value}</span>
                      <button
                        type="button"
                        style={{ ...s.stepBtn, ...(row.value >= 50 ? s.stepOff : null) }}
                        className="mnu-tap"
                        aria-label={`More ${row.label}`}
                        disabled={row.value >= 50}
                        onClick={() => row.set(clamp(row.value + 1))}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
                {paxError && <div style={s.err}>{paxError}</div>}
              </div>
            </>
          )}
        </div>

        {!takeaway && (
          <div style={s.totalRow}>
            <span>Total guests</span>
            <b>{total}</b>
          </div>
        )}

        <button
          type="button"
          style={{ ...s.continue, ...(canContinue ? null : s.continueOff) }}
          className="mnu-tap"
          aria-disabled={!canContinue}
          onClick={submit}
        >
          Continue to Menu
        </button>

        <p style={s.note}>
          {takeaway
            ? "Your takeaway number is printed on the confirmation after you order."
            : "All three fields are required before ordering."}
        </p>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  root: {
    background: `radial-gradient(900px 480px at 85% -10%, rgba(217,164,99,0.12), transparent 60%), ${T.bg}`,
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
    boxShadow: "0 0 8px rgba(111,211,154,0.9)",
  },
  head: { textAlign: "center", marginTop: 26 },
  eyebrow: {
    color: "#D9A463",
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
    gap: 10,
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
    whiteSpace: "nowrap",
  },
  paxRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "6px 0",
  },
  paxLabel: { color: T.w55, fontSize: 12.5 },
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
  stepOff: { opacity: 0.32, cursor: "not-allowed" },
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
    color: T.ink,
    padding: "0 14px",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  },
  hint: {
    marginTop: 8,
    fontSize: 11.5,
    lineHeight: 1.5,
    color: T.w55,
  },
  err: {
    marginTop: 8,
    fontSize: 11.5,
    fontWeight: 600,
    color: T.red,
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
    background: T.goldGrad,
    border: "1px solid rgba(255,255,255,0.22)",
    color: T.goldInk,
    fontSize: 16,
    fontWeight: 800,
    letterSpacing: 0.2,
    cursor: "pointer",
    boxShadow: T.shadowGold,
  },
  /* a dimmed gold gradient looked like wet cardboard — use a flat
     surface with readable text instead of 45% opacity */
  continueOff: {
    background: T.card2,
    border: "1px solid rgba(255,246,234,0.07)",
    color: T.w40,
    boxShadow: "none",
    cursor: "not-allowed",
  },
  note: {
    color: T.w40,
    fontSize: 11.5,
    textAlign: "center",
    marginTop: 14,
    lineHeight: 1.6,
  },
};
