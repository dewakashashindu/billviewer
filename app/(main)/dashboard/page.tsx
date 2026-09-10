"use client";

import { useRouter } from "next/navigation";

const iso = (d: Date) => d.toISOString().split("T")[0];

/* ── inline SVG icons (emoji naha — professional icons) ── */
const iconStyle = { marginBottom: 8, display: "block" } as const;
const IBill = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#eb9b46" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={iconStyle}>
    <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z" />
    <line x1="9" y1="7" x2="15" y2="7" /><line x1="9" y1="11" x2="15" y2="11" /><line x1="9" y1="15" x2="13" y2="15" />
  </svg>
);
const IMoney = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#eb9b46" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={iconStyle}>
    <circle cx="12" cy="12" r="9" /><path d="M12 7v10M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1-3 2.2c0 3 6 1.6 6 4.6 0 1.2-1.3 2.2-3 2.2s-3-1.1-3-2.5" />
  </svg>
);
const IChartUp = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#eb9b46" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={iconStyle}>
    <polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" />
  </svg>
);
const IBar = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#eb9b46" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={iconStyle}>
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" />
  </svg>
);
const IFolder = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#eb9b46" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={iconStyle}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

export default function DashboardPage() {
  const router = useRouter();
  const now = new Date();

  const monthStart = iso(new Date(now.getFullYear(), now.getMonth(), 1));

  return (
    <div style={{ padding: "28px 26px", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 26 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#0f172a" }}>
          Dashboard
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "#64748b" }}>
          Restaurant reporting overview — MICROECHEF
        </p>
      </div>

      {/* Quick stat cards (placeholder) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 14,
          marginBottom: 30,
        }}
      >
        {[
          { label: "Today's Bills", value: "—", Icon: IBill },
          { label: "Today's Sales", value: "—", Icon: IMoney },
          { label: "This Month Sales", value: "—", Icon: IChartUp },
          { label: "Avg / Bill", value: "—", Icon: IBar },
        ].map((c) => (
          <div
            key={c.label}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: "18px 18px 16px",
              background: "#fff",
              boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
            }}
          >
            <c.Icon />
            <p
              style={{
                margin: 0,
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: 0.5,
                color: "#64748b",
                textTransform: "uppercase",
              }}
            >
              {c.label}
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 24,
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              {c.value}
            </p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <h2 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
        Quick Links
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 14,
        }}
      >
        <button
          onClick={() =>
            router.push(`/reports/transaction-summary?from=${monthStart}&to=${iso(now)}`)
          }
          style={{
            textAlign: "left",
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            padding: "18px 18px 16px",
            background: "linear-gradient(135deg,#f8fafc,#fff)",
            cursor: "pointer",
          }}
        >
          <IBar />
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 14,
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            Transaction Summary By Date
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#64748b" }}>
            Daily sales, pax & tax summary — this month
          </p>
        </button>

        <button
          onClick={() => router.push("/reports")}
          style={{
            textAlign: "left",
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            padding: "18px 18px 16px",
            background: "linear-gradient(135deg,#f8fafc,#fff)",
            cursor: "pointer",
          }}
        >
          <IFolder />
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 14,
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            All Reports
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#64748b" }}>
            Browse the full reports catalogue
          </p>
        </button>
      </div>
    </div>
  );
}
