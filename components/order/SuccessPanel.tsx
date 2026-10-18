// ============================================================
// LOCATION: components/order/SuccessPanel.tsx
// Step 4 — the order is on its way to the kitchen.
// ============================================================
"use client";

import { useRouter } from "next/navigation";
import { C } from "./theme";

export default function SuccessPanel({
  table,
  token,
  invoiceNo,
  itemCount,
}: {
  table: string;
  token: string;
  invoiceNo: string;
  itemCount: number;
}) {
  const router = useRouter();

  const go = (path: string) => {
    const q = new URLSearchParams({ table });
    if (token) q.set("t", token);
    router.push(`${path}?${q.toString()}`);
  };

  return (
    <div className="ord-root">
      <div
        className="ord-col"
        style={{
          position: "relative",
          overflowY: "auto",
          overflowX: "hidden",
          justifyContent: "center",
          alignItems: "center",
          padding: "0 26px",
        }}
      >
        {/* soft background */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(70% 45% at 50% 18%, rgba(62,122,85,0.16) 0%, rgba(251,246,240,0) 68%)",
          }}
        />

        <div
          className="ord-up"
          style={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            textAlign: "center",
            margin: "auto",
            padding: "24px 0",
          }}
        >
          {/* tick */}
          <div
            style={{
              width: 96,
              height: 96,
              margin: "0 auto",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="ord-ping" />
            <span
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 999,
                background: C.surface,
                border: `1px solid ${C.line}`,
                boxShadow: C.shadowMd,
              }}
            />
            <svg
              className="ord-tick"
              width="54"
              height="54"
              viewBox="0 0 54 54"
              style={{ position: "relative", zIndex: 1 }}
            >
              <circle cx="27" cy="27" r="24" />
              <path d="M16 28.5 23.5 36 39 20" />
            </svg>
          </div>

          <h1
            className="ord-display"
            style={{ margin: "22px 0 0", color: C.ink, fontSize: 30 }}
          >
            Order received
          </h1>
          <p
            style={{
              color: C.ink2,
              fontSize: 14,
              lineHeight: 1.6,
              margin: "8px auto 0",
              maxWidth: 300,
            }}
          >
            The kitchen has your order. Sit back, relax and enjoy your meal.
          </p>

          {/* summary card */}
          <div
            className="ord-card ord-up"
            style={{ marginTop: 26, padding: "16px 18px", textAlign: "left" }}
          >
            <SummaryRow label="Table" value={table || "—"} />
            <SummaryRow label="Items" value={String(itemCount || 0)} />
            <SummaryRow label="Order number" value={invoiceNo || "—"} mono />
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 26 }}>
            <button
              type="button"
              onClick={() => go("/order/menu")}
              className="ord-btn ord-btn-primary"
              style={{ height: 52, fontSize: 15 }}
            >
              Add more items
            </button>
            <button
              type="button"
              onClick={() => go("/order")}
              className="ord-btn ord-btn-ghost"
              style={{ height: 50, fontSize: 14 }}
            >
              Done
            </button>
          </div>

          <p
            style={{
              color: C.ink3,
              fontSize: 11.5,
              marginTop: 20,
              lineHeight: 1.6,
            }}
          >
            Need anything else? Add more items or call your waiter.
          </p>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
        padding: "7px 0",
      }}
    >
      <span style={{ fontSize: 12.5, color: C.ink3 }}>{label}</span>
      <span
        style={{
          fontSize: 13.5,
          fontWeight: 700,
          color: C.ink,
          fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : C.font,
          textAlign: "right",
          wordBreak: "break-all",
        }}
      >
        {value}
      </span>
    </div>
  );
}
