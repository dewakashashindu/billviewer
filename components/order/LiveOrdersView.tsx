// ============================================================
// LOCATION: components/order/LiveOrdersView.tsx
// The staff / kitchen view of the customer QR orders.
// ============================================================
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { LiveOrder } from "@/lib/orderService";

const BROWN = "#684830";
const DARK = "#45301D";
const MID = "#907860";
const FAINT = "#6B543E";
const BORDER = "#E4D6BF";
const CREAM = "#FCF7F3";
const PALE = "#F0E8D8";

function timeAgo(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  return `${h} h ${min % 60} min ago`;
}

export default function LiveOrdersView({
  orders,
  source,
}: {
  orders: LiveOrder[];
  source: "database" | "mock";
}) {
  const router = useRouter();

  // Pull fresh orders every 30 seconds (the server component re-reads
  // the DB and hands the new list down, so the "x min ago" labels
  // are recomputed as well).
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(t);
  }, [router]);

  return (
    <div style={{ padding: "18px 20px 40px", maxWidth: 1100, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              color: DARK,
              letterSpacing: "-0.01em",
            }}
          >
            Live Web Orders
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: FAINT }}>
            Orders placed from the table QR codes · refreshes every 30 seconds
            {source === "mock" ? " · (demo data)" : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.refresh()}
          style={{
            height: 38,
            padding: "0 16px",
            borderRadius: 10,
            border: `1px solid ${BORDER}`,
            background: CREAM,
            color: BROWN,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Refresh now
        </button>
      </div>

      {orders.length === 0 ? (
        <div
          style={{
            marginTop: 22,
            background: CREAM,
            border: `1px solid ${BORDER}`,
            borderRadius: 18,
            padding: "48px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40 }}>🕊️</div>
          <div style={{ marginTop: 10, fontSize: 16, fontWeight: 700, color: DARK }}>
            No open web orders
          </div>
          <p style={{ margin: "6px auto 0", fontSize: 13, color: FAINT, maxWidth: 380 }}>
            When a guest scans a table QR and places an order it appears here
            straight away.
          </p>
        </div>
      ) : (
        <div
          style={{
            marginTop: 22,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))",
            gap: 16,
          }}
        >
          {orders.map((o) => {
            const isTakeaway =
              o.orderType === "TA" || /^TA(?:-|$)/i.test(o.tableNo || "");
            return (
            <div
              key={o.invoiceNo}
              style={{
                background: CREAM,
                border: `1px solid ${BORDER}`,
                borderRadius: 18,
                overflow: "hidden",
                boxShadow: "0 4px 16px rgba(69,48,29,0.06)",
              }}
            >
              {/* header */}
              <div
                style={{
                  padding: "13px 16px",
                  background: "linear-gradient(180deg,#F7EFE3 0%,#FCF7F3 100%)",
                  borderBottom: `1px solid ${BORDER}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    background: BROWN,
                    color: "#fff",
                    borderRadius: 9,
                    padding: "5px 10px",
                    fontSize: 12.5,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {isTakeaway ? o.tableNo || "Takeaway" : `Table ${o.tableNo || "—"}`}
                </span>
                <span
                  style={{
                    flex: 1,
                    fontSize: 11.5,
                    color: FAINT,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {o.invoiceNo}
                </span>
                <span style={{ fontSize: 11, color: MID, whiteSpace: "nowrap" }}>
                  {timeAgo(o.placedAt)}
                </span>
              </div>

              {/* meta */}
              {(o.customerName || o.customerPhone || o.pax > 0 || o.tableGroup) && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    padding: "10px 16px 0",
                  }}
                >
                  {o.tableGroup ? <Chip text={o.tableGroup} /> : null}
                  {o.pax > 0 ? <Chip text={`${o.pax} guests`} /> : null}
                  {o.customerName ? <Chip text={o.customerName} /> : null}
                  {o.customerPhone ? <Chip text={o.customerPhone} /> : null}
                </div>
              )}

              {/* lines */}
              <div style={{ padding: "10px 16px 4px" }}>
                {o.lines.map((l, i) => (
                  <div
                    key={`${l.itemCode}-${i}`}
                    style={{
                      display: "flex",
                      gap: 10,
                      padding: "7px 0",
                      borderTop: i === 0 ? "none" : `1px solid ${PALE}`,
                      alignItems: "flex-start",
                    }}
                  >
                    <span
                      style={{
                        minWidth: 26,
                        height: 24,
                        padding: "0 7px",
                        borderRadius: 7,
                        background: PALE,
                        color: BROWN,
                        fontSize: 12,
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {l.qty}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: DARK,
                        }}
                      >
                        {l.name}
                      </span>
                      {l.remark ? (
                        <span
                          style={{
                            display: "inline-block",
                            marginTop: 3,
                            fontSize: 11,
                            color: "#8A5A2B",
                            background: "#FBF0DC",
                            border: "1px solid #EBD6B0",
                            borderRadius: 99,
                            padding: "2px 8px",
                          }}
                        >
                          {l.remark}
                        </span>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>

              {/* total */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  padding: "10px 16px 13px",
                  borderTop: `1px solid ${BORDER}`,
                  marginTop: 4,
                }}
              >
                <span style={{ fontSize: 12, color: FAINT }}>Order total</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: BROWN }}>
                  Rs. {o.total.toLocaleString("en-LK")}
                </span>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({ text }: { text: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        color: FAINT,
        background: PALE,
        borderRadius: 99,
        padding: "3px 9px",
        fontWeight: 600,
      }}
    >
      {text}
    </span>
  );
}
