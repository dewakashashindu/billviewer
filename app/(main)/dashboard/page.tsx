"use client";

import { useRouter } from "next/navigation";

const iso = (d: Date) => d.toISOString().split("T")[0];

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
          { label: "Today's Bills", value: "—", icon: "🧾" },
          { label: "Today's Sales", value: "—", icon: "💰" },
          { label: "This Month Sales", value: "—", icon: "📈" },
          { label: "Avg / Bill", value: "—", icon: "📊" },
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
            <div style={{ fontSize: 20, marginBottom: 8 }}>{c.icon}</div>
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
          <p style={{ margin: 0, fontSize: 20 }}>📊</p>
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
          <p style={{ margin: 0, fontSize: 20 }}>🗂️</p>
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
