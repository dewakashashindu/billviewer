"use client";

import { useRouter } from "next/navigation";

// Reports catalogue — cards grid. Clicking a linked card opens the report
// with this-month range (sidebar eken click kalama date popup eka wenawa).
const REPORTS = [
  {
    id: "transaction-summary",
    title: "Transaction Summary By Date",
    desc: "Daily aggregated sales performance — bills, pax, sales volume, tax",
    icon: "📊",
    linked: true,
  },
  {
    id: null,
    title: "Item-wise Sales",
    desc: "Menu item level sales breakdown",
    icon: "🍽️",
    linked: false,
  },
  {
    id: null,
    title: "Department-wise Sales",
    desc: "Food / beverage / other department split",
    icon: "🏷️",
    linked: false,
  },
  {
    id: null,
    title: "Hourly Sales",
    desc: "Peak hour analysis",
    icon: "⏰",
    linked: false,
  },
  {
    id: null,
    title: "Bill Audit",
    desc: "Detailed bill listing with user & terminal info",
    icon: "🧾",
    linked: false,
  },
  {
    id: null,
    title: "Payment Mode Summary",
    desc: "Cash / card / credit split by date",
    icon: "💳",
    linked: false,
  },
];

export default function ReportsLandingPage() {
  const router = useRouter();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];

  return (
    <div style={{ padding: "28px 26px", fontFamily: "Inter, sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#0f172a" }}>
          Reports
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "#64748b" }}>
          Click a report to view it
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
          gap: 14,
        }}
      >
        {REPORTS.map((r) => (
          <button
            key={r.title}
            onClick={() =>
              r.linked &&
              router.push(`/reports/${r.id}?from=${monthStart}&to=${now.toISOString().split("T")[0]}`)
            }
            style={{
              textAlign: "left",
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: "18px 18px 16px",
              background: r.linked ? "#fff" : "#f8fafc",
              cursor: r.linked ? "pointer" : "default",
              opacity: r.linked ? 1 : 0.65,
              boxShadow: r.linked ? "0 1px 3px rgba(15,23,42,0.05)" : "none",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ fontSize: 22 }}>{r.icon}</span>
              {!r.linked && (
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                    color: "#94a3b8",
                    background: "#e2e8f0",
                    padding: "3px 8px",
                    borderRadius: 999,
                  }}
                >
                  Coming Soon
                </span>
              )}
            </div>
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 14,
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              {r.title}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#64748b", lineHeight: "18px" }}>
              {r.desc}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
