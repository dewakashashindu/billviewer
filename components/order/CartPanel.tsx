// ============================================================
// LOCATION: components/order/CartPanel.tsx
// Step 3 of the customer flow — the cart.
//
//   • the lines already on the table's bill (read-only)
//   • the new lines the guest is adding now (editable)
//   • a per-line special request ("configure as you like")
//   • optional name / phone / number of guests
//   • the "Place order" button
// ============================================================
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OrderShell } from "./OrderShell";
import RemarkSheet from "./RemarkSheet";
import { C, money } from "./theme";
import { useOrderCart } from "./useOrderCart";
import type { CartRow } from "./types";

export default function CartPanel({
  table,
  token,
  tableGroup,
}: {
  table: string;
  token: string;
  tableGroup?: string;
}) {
  const router = useRouter();
  const cart = useOrderCart({
    table,
    token,
    tableGroup,
    itemsById: useMemo(() => new Map(), []),
  });

  const [remarkFor, setRemarkFor] = useState<CartRow | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const existingRows = cart.rows.filter((r) => r.readOnly);
  const newRows = cart.rows.filter((r) => !r.readOnly);

  const goMenu = () => {
    const q = new URLSearchParams({ table });
    if (token) q.set("t", token);
    router.push(`/order/menu?${q.toString()}`);
  };

  const placeOrder = async () => {
    const result = await cart.confirm();
    if (!result) return;
    const q = new URLSearchParams({ table });
    if (token) q.set("t", token);
    if (result.invoiceNo) q.set("inv", result.invoiceNo);
    q.set("n", String(result.itemCount ?? 0));
    router.push(`/order/success?${q.toString()}`);
  };

  return (
    <>
      <OrderShell
        title="Your Order"
        subtitle={table ? `Table ${table}` : undefined}
        onBack={goMenu}
        bottom={
          <div className="ord-cartbar ord-safe-bottom">
            <div style={{ padding: "10px 16px" }}>
              {cart.confirmError ? (
                <div
                  style={{
                    background: C.redTint,
                    color: C.red,
                    borderRadius: 12,
                    padding: "10px 12px",
                    fontSize: 12.5,
                    marginBottom: 10,
                    lineHeight: 1.45,
                  }}
                >
                  {cart.confirmError}
                </div>
              ) : null}

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: C.ink3 }}>Total</div>
                  <div style={{ fontSize: 17, fontWeight: 750, color: C.ink }}>
                    {money(cart.grandTotal)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={placeOrder}
                  disabled={cart.confirming || cart.newCount === 0}
                  className="ord-btn ord-btn-primary"
                  style={{ height: 50, padding: "0 26px", fontSize: 15 }}
                >
                  {cart.confirming ? (
                    <>
                      <span
                        className="ord-spin"
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 999,
                          border: "2px solid rgba(255,255,255,0.35)",
                          borderTopColor: "#fff",
                          display: "inline-block",
                        }}
                      />
                      Sending…
                    </>
                  ) : (
                    <>Place order</>
                  )}
                </button>
              </div>
            </div>
          </div>
        }
      >
        <div className="ord-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {cart.loadingBaseline ? (
            <div style={{ padding: 20 }}>
              <div className="ord-skel" style={{ height: 62, marginBottom: 12 }} />
              <div className="ord-skel" style={{ height: 62, marginBottom: 12 }} />
            </div>
          ) : (
            <div style={{ padding: "16px 16px 28px" }}>
              {/* ── already on the bill ───────────────────────────── */}
              {existingRows.length > 0 ? (
                <section style={{ marginBottom: 22 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <h2 className="ord-title" style={{ margin: 0, fontSize: 15.5 }}>
                      Already on your bill
                    </h2>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: C.ink3,
                        background: C.surfaceWarm,
                        borderRadius: 999,
                        padding: "3px 9px",
                      }}
                    >
                      Ordered
                    </span>
                  </div>

                  <div className="ord-card" style={{ overflow: "hidden" }}>
                    {existingRows.map((r, i) => (
                      <div
                        key={r.rowId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "12px 14px",
                          borderTop: i === 0 ? "none" : `1px solid ${C.lineSoft}`,
                          background: C.surfaceAlt,
                        }}
                      >
                        <span
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 8,
                            background: C.surfaceWarm,
                            color: C.ink2,
                            fontSize: 12.5,
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {r.qty}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span
                            style={{
                              display: "block",
                              fontSize: 13.5,
                              fontWeight: 600,
                              color: C.ink2,
                            }}
                          >
                            {r.name}
                          </span>
                          {r.remark ? (
                            <span style={{ display: "block", fontSize: 11.5, color: C.ink3, marginTop: 2 }}>
                              “{r.remark}”
                            </span>
                          ) : null}
                        </span>
                        <span style={{ fontSize: 12.5, color: C.ink3, fontWeight: 600 }}>
                          {money(r.qty * r.unitPrice)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* ── new items ─────────────────────────────────────── */}
              <section>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <h2 className="ord-title" style={{ margin: 0, fontSize: 15.5 }}>
                    New items
                  </h2>
                  {cart.newCount > 0 ? (
                    <button
                      type="button"
                      onClick={cart.clearNew}
                      className="ord-tap"
                      style={{
                        marginLeft: "auto",
                        border: "none",
                        background: "transparent",
                        color: C.ink3,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: C.font,
                        textDecoration: "underline",
                        textUnderlineOffset: 3,
                      }}
                    >
                      Clear all
                    </button>
                  ) : null}
                </div>

                {newRows.length === 0 ? (
                  <div
                    className="ord-card"
                    style={{ padding: "26px 20px", textAlign: "center" }}
                  >
                    <div style={{ fontSize: 30 }}>🛒</div>
                    <div className="ord-title" style={{ marginTop: 8, fontSize: 15 }}>
                      Your cart is empty
                    </div>
                    <p className="ord-body" style={{ marginTop: 4, fontSize: 12.5 }}>
                      Add a few dishes from the menu and they will appear here.
                    </p>
                    <button
                      type="button"
                      onClick={goMenu}
                      className="ord-btn ord-btn-ghost"
                      style={{ marginTop: 14, height: 42, padding: "0 20px", fontSize: 13.5 }}
                    >
                      Browse the menu
                    </button>
                  </div>
                ) : (
                  <div className="ord-card" style={{ overflow: "hidden" }}>
                    {newRows.map((r, i) => (
                      <div
                        key={r.rowId}
                        style={{
                          padding: "13px 14px",
                          borderTop: i === 0 ? "none" : `1px solid ${C.lineSoft}`,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span
                              style={{
                                display: "block",
                                fontSize: 14,
                                fontWeight: 650,
                                color: C.ink,
                                lineHeight: 1.3,
                              }}
                            >
                              {r.name}
                            </span>
                            <span
                              style={{ display: "block", fontSize: 11.5, color: C.ink3, marginTop: 2 }}
                            >
                              {money(r.unitPrice)} each
                            </span>
                          </span>

                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 2,
                              padding: "3px",
                              borderRadius: 999,
                              background: C.primaryTint,
                              border: `1px solid rgba(94,61,38,0.12)`,
                            }}
                          >
                            <QtyBtn label="−" onClick={() => cart.dec(r.lineKey)} />
                            <span
                              style={{
                                minWidth: 24,
                                textAlign: "center",
                                fontSize: 13.5,
                                fontWeight: 700,
                                color: C.primary,
                              }}
                            >
                              {r.qty}
                            </span>
                            <QtyBtn label="+" onClick={() => cart.inc(r.lineKey)} />
                          </div>

                          <button
                            type="button"
                            onClick={() => cart.removeNew(r.lineKey)}
                            aria-label={`Remove ${r.name}`}
                            className="ord-tap"
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 999,
                              border: "none",
                              background: "transparent",
                              color: C.ink3,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                              <path
                                d="M5 7h14M10 7V5h4v2m-7 0 1 13h8l1-13"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        </div>

                        {/* special request */}
                        <div style={{ marginTop: 8, marginLeft: 2 }}>
                          {r.remark ? (
                            <button
                              type="button"
                              onClick={() => setRemarkFor(r)}
                              className="ord-tap"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "5px 10px",
                                borderRadius: 999,
                                background: C.goldTint,
                                border: `1px solid ${C.goldLine}`,
                                color: C.goldDeep,
                                fontSize: 11.5,
                                fontWeight: 600,
                                cursor: "pointer",
                                fontFamily: C.font,
                                maxWidth: "100%",
                              }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                <path
                                  d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              <span
                                style={{
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  maxWidth: 210,
                                }}
                              >
                                {r.remark}
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setRemarkFor(r)}
                              className="ord-tap"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: 0,
                                border: "none",
                                background: "transparent",
                                color: C.ink3,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                fontFamily: C.font,
                              }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                                <path
                                  d="M12 5v14M5 12h14"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                />
                              </svg>
                              Add a special request
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ── guest details ─────────────────────────────────── */}
              <section style={{ marginTop: 22 }}>
                <button
                  type="button"
                  onClick={() => setDetailsOpen((v) => !v)}
                  className="ord-tap"
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    borderRadius: 16,
                    border: `1px solid ${C.line}`,
                    background: C.surface,
                    cursor: "pointer",
                    fontFamily: C.font,
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 999,
                      background: C.surfaceWarm,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 15,
                      flexShrink: 0,
                    }}
                  >
                    👤
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 13.5,
                        fontWeight: 650,
                        color: C.ink,
                      }}
                    >
                      {cart.guest.name || "Add your details"}
                    </span>
                    <span
                      style={{ display: "block", fontSize: 11.5, color: C.ink3, marginTop: 1 }}
                    >
                      Optional — helps us serve you faster
                    </span>
                  </span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    style={{
                      color: C.ink3,
                      transform: detailsOpen ? "rotate(180deg)" : "none",
                      transition: "transform .2s ease",
                    }}
                  >
                    <path
                      d="m6 9 6 6 6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                {detailsOpen ? (
                  <div
                    className="ord-card ord-up"
                    style={{ marginTop: 10, padding: 14, display: "grid", gap: 10 }}
                  >
                    <Field
                      label="Your name"
                      value={cart.guest.name}
                      placeholder="e.g. Ajana"
                      onChange={(v) => cart.setGuestDetails({ name: v })}
                    />
                    <Field
                      label="Phone number"
                      value={cart.guest.phone}
                      placeholder="07X XXX XXXX"
                      inputMode="tel"
                      onChange={(v) => cart.setGuestDetails({ phone: v })}
                    />
                    <div>
                      <div className="ord-eyebrow" style={{ marginBottom: 6 }}>
                        Number of guests
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => cart.setGuestDetails({ pax: n })}
                            className="ord-tap"
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 999,
                              cursor: "pointer",
                              fontFamily: C.font,
                              fontSize: 14,
                              fontWeight: 700,
                              border: `1px solid ${cart.guest.pax === n ? C.primary : C.line}`,
                              background: cart.guest.pax === n ? C.primary : C.surface,
                              color: cart.guest.pax === n ? "#FFF9F2" : C.ink2,
                            }}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>

              {/* ── totals ────────────────────────────────────────── */}
              <section className="ord-card" style={{ marginTop: 18, padding: "14px 16px" }}>
                <Row label="Items on your bill" value={money(cart.existingTotal)} muted />
                <Row label="New items" value={money(cart.newTotal)} />
                <div style={{ height: 1, background: C.lineSoft, margin: "10px 0" }} />
                <Row label="Total" value={money(cart.grandTotal)} strong />
              </section>

              <p
                style={{
                  textAlign: "center",
                  color: C.ink3,
                  fontSize: 11.5,
                  marginTop: 16,
                  lineHeight: 1.6,
                }}
              >
                Your order goes straight to the kitchen. Payment is at the till.
              </p>
            </div>
          )}
        </div>
      </OrderShell>

      {remarkFor ? (
        <RemarkSheet
          itemName={remarkFor.name}
          value={remarkFor.remark}
          onClose={() => setRemarkFor(null)}
          onSave={(remark) => {
            cart.setRemark(remarkFor.lineKey, remark);
            setRemarkFor(null);
          }}
        />
      ) : null}
    </>
  );
}

function QtyBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label === "+" ? "Increase quantity" : "Decrease quantity"}
      className="ord-tap"
      style={{
        width: 28,
        height: 28,
        borderRadius: 999,
        border: "none",
        background: C.surface,
        color: C.primary,
        fontSize: 15,
        fontWeight: 700,
        lineHeight: 1,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: C.font,
        boxShadow: C.shadowSm,
      }}
    >
      {label}
    </button>
  );
}

function Row({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span
        style={{
          fontSize: strong ? 14 : 12.5,
          fontWeight: strong ? 750 : 500,
          color: strong ? C.ink : muted ? C.ink3 : C.ink2,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: strong ? 16 : 13,
          fontWeight: strong ? 750 : 650,
          color: strong ? C.primary : muted ? C.ink3 : C.ink,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
  inputMode,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  inputMode?: "text" | "tel";
}) {
  return (
    <div>
      <div className="ord-eyebrow" style={{ marginBottom: 6 }}>
        {label}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        style={{
          width: "100%",
          height: 44,
          border: `1px solid ${C.line}`,
          borderRadius: 12,
          padding: "0 12px",
          fontFamily: C.font,
          fontSize: 14,
          color: C.ink,
          background: C.surfaceAlt,
          outline: "none",
        }}
      />
    </div>
  );
}
