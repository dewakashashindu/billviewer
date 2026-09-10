"use client";

import { useRouter } from "next/navigation";

/* ── inline SVG icons (emoji naha — professional icons) ── */
const iconWrap = { width: 34, height: 34, borderRadius: 9, background: "#fff4e8", border: "1px solid #fbe0c2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } as const;
const stroke = { stroke: "#d97a1c", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
const IBar = () => (<svg width="17" height="17" viewBox="0 0 24 24" {...stroke}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" /></svg>);
const IBill = () => (<svg width="17" height="17" viewBox="0 0 24 24" {...stroke}><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z" /><line x1="9" y1="7" x2="15" y2="7" /><line x1="9" y1="11" x2="15" y2="11" /><line x1="9" y1="15" x2="13" y2="15" /></svg>);
const IPlate = () => (<svg width="17" height="17" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /></svg>);
const ITag = () => (<svg width="17" height="17" viewBox="0 0 24 24" {...stroke}><path d="M20.6 13.4L12 22 2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z" /><circle cx="7" cy="7" r="1.2" /></svg>);
const IClock = () => (<svg width="17" height="17" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></svg>);
const ICard = () => (<svg width="17" height="17" viewBox="0 0 24 24" {...stroke}><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>);

// Reports catalogue — cards grid. Clicking a linked card opens the report
// with this-month range (sidebar eken click kalama date popup eka wenawa).
const REPORTS = [
  {
    id: "transaction-summary",
    title: "Transaction Summary By Date",
    desc: "Daily aggregated sales performance — bills, pax, sales volume, tax",
    icon: "bar",
    linked: true,
  },
  {
    id: "sales-summary",
    title: "Sales Summary",
    desc: "Bill-wise daily collection grouped by date",
    icon: "bill",
    linked: true,
  },
  {
    id: null,
    title: "Item-wise Sales",
    desc: "Menu item level sales breakdown",
    icon: "plate",
    linked: false,
  },
  {
    id: null,
    title: "Department-wise Sales",
    desc: "Food / beverage / other department split",
    icon: "tag",
    linked: false,
  },
  {
    id: null,
    title: "Hourly Sales",
    desc: "Peak hour analysis",
    icon: "clock",
    linked: false,
  },
  {
    id: null,
    title: "Bill Audit",
    desc: "Detailed bill listing with user & terminal info",
    icon: "bill",
    linked: false,
  },
  {
    id: null,
    title: "Payment Mode Summary",
    desc: "Cash / card / credit split by date",
    icon: "card",
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
              <span style={iconWrap}>
                {r.icon === "bar" && <IBar />}
                {r.icon === "bill" && <IBill />}
                {r.icon === "plate" && <IPlate />}
                {r.icon === "tag" && <ITag />}
                {r.icon === "clock" && <IClock />}
                {r.icon === "card" && <ICard />}
              </span>
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
