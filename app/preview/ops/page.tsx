"use client";

// PUBLIC PREVIEW (login nathuwa) — dashboard tabs.
// demoOnly → session/DB nathiwa local demo data ekakin render wenawa.
import DashboardTabs from "@/components/dashboard/DashboardTabs";

export default function OpsPreviewPage() {
  return (
    <div style={{ padding: 16, background: "#FCF7F3", minHeight: "100vh" }}>
      <DashboardTabs demoOnly>
        <div
          style={{
            border: "1px dashed #E4D6BF",
            borderRadius: 12,
            background: "#fff",
            padding: "22px 16px",
            fontSize: 12,
            color: "#684830",
          }}
        >
          <b>Performance Analytics</b> — the existing dashboard cards and charts
          appear here (unchanged), with the date range set to 1st of the month →
          today. Sign in to see live data.
        </div>
      </DashboardTabs>
    </div>
  );
}
