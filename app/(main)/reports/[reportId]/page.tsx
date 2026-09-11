"use client";

// ============================================================
// LOCATION: app/(main)/reports/[reportId]/page.tsx
// FULL REPLACE — unified report page (identical structure for
// ALL reports — generic table + sales-summary custom render):
//   • single fetch effect (sales summary includes)
//   • toolbar (search/dates/zoom/chart/share/PDF) — same props
//   • page-level loading + error blocks (same style)
//   • sales summary gets pdfDocument too (share/PDF identical)
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { UNAUTHORIZED_ERROR } from "@/lib/auth";
import { REPORTS_CONFIG } from "@/config/reports.config";
import DynamicReportTable from "@/components/reports/DynamicReportTable";
import ReportToolbar from "@/components/ReportToolbar";
import ReportDashboard from "@/components/ReportDashboard";
import { computeAnalytics } from "@/components/reports/analytics";
import ReportPdfDocument from "@/components/reports/ReportPdfDocument";
import SalesSummaryReport, {
  filterSalesSummary,
} from "@/components/reports/SalesSummaryReport";
import SalesDetailsReport, {
  filterSalesDetails,
  type SalesDetailsData,
} from "@/components/reports/SalesDetailsReport";
import SalesSummaryPdfDocument from "@/components/reports/SalesSummaryPdfDocument";
import SalesDetailsPdfDocument from "@/components/reports/SalesDetailsPdfDocument";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const p2 = (n: number) => String(n).padStart(2, "0");
const fmtDMonY = (iso: string) => {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${MONTHS[Number(m) - 1]}/${y}`;
};

// ── shared loading block (identical for every report) ──
function LoadingBlock() {
  return (
    <div style={{ padding: "60px 20px", textAlign: "center" }}>
      <style>{`@keyframes rep-spin{to{transform:rotate(360deg)}}`}</style>
      <svg
        width="30"
        height="30"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#94a3b8"
        strokeWidth="2.4"
        strokeLinecap="round"
        style={{
          margin: "0 auto 12px",
          display: "block",
          animation: "rep-spin 0.9s linear infinite",
        }}
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#64748b" }}>
        Loading Report Data...
      </p>
    </div>
  );
}

// ── shared error banner (identical for every report) ──
function ErrorBlock({ message }: { message: string }) {
  return (
    <div style={{ padding: "18px 24px 0" }}>
      <div
        style={{
          background: "#fef2f2",
          border: "1px solid #fecaca",
          color: "#b91c1c",
          fontSize: 13,
          fontWeight: 500,
          borderRadius: 10,
          padding: "11px 15px",
        }}
      >
        {message}
      </div>
    </div>
  );
}

export default function DynamicReportPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportId = params?.reportId as string;
  const config = REPORTS_CONFIG[reportId];

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [chartMode, setChartMode] = useState(false);
  const [printedAt] = useState(() => new Date());

  // URL params: ?from=YYYY-MM-DD&to=YYYY-MM-DD (sidebar date popup eken)
  // local date — toISOString UTC nisa day shift wenna (31/Dec bug)
  const p2l = (n: number) => String(n).padStart(2, "0");
  const localIso = (d: Date) =>
    `${d.getFullYear()}-${p2l(d.getMonth() + 1)}-${p2l(d.getDate())}`;
  const yearStart = localIso(
    new Date(new Date().getFullYear(), 0, 1)
  );
  const today = localIso(new Date());

  const [startDate, setStartDate] = useState(
    searchParams.get("from") || yearStart
  );
  const [endDate, setEndDate] = useState(searchParams.get("to") || today);
  const [loc, setLoc] = useState(searchParams.get("loc") || "");
  const [orderMode, setOrderMode] = useState(searchParams.get("om") || "");
  const [billType, setBillType] = useState(searchParams.get("bt") || "");

  // URL change (sidebar modal eken aluth range) -> state update
  useEffect(() => {
    const f = searchParams.get("from");
    const t = searchParams.get("to");
    if (f) setStartDate(f);
    if (t) setEndDate(t);
    setLoc(searchParams.get("loc") || "");
    setOrderMode(searchParams.get("om") || "");
    setBillType(searchParams.get("bt") || "");
  }, [searchParams]);

  // ── single fetch effect — ALL reports (sales summary includes) ──
  useEffect(() => {
    if (!config) return;
    let alive = true;
    // session එක නැති/ඉකුත් වෙලා නම් → login එකට (server action එකෙන්
    // UNAUTHORIZED එනවා — lib/actionAuth.ts)
    const goLogin = () => {
      if (alive) router.replace("/login");
    };
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await config.fetchAction({
          startDate,
          endDate,
          outletId: loc || undefined,
          orderMode: orderMode || undefined,
          billType: billType || undefined,
        });
        if (!alive) return;
        // session එක ඉකුත් වෙලා / නැති වෙලා නම් → login එකට
        if (res?.error === UNAUTHORIZED_ERROR) {
          goLogin();
          return;
        }
        if (res?.success && res.data != null) {
          setData(res.data);
        } else {
          setData(null);
          setError(res?.error || "Failed to load report data");
        }
      } catch (e: any) {
        if (!alive) return;
        if (e?.message === UNAUTHORIZED_ERROR) {
          goLogin();
          return;
        }
        setData(null);
        setError(e?.message || "Failed to load report data");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [reportId, config, startDate, endDate, loc, orderMode, billType, router]);

  // reset view state on report change
  useEffect(() => {
    setSearch("");
    setChartMode(false);
  }, [reportId]);

  // generic rows (array data) + search filter
  const rows: any[] = Array.isArray(data) ? data : [];
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((row) =>
      Object.values(row ?? {}).some((v) =>
        String(v ?? "").toLowerCase().includes(q)
      )
    );
  }, [rows, search]);

  // ✅ Analytics — generic rows reports walata (browser athulema aggregate)
  const analyticsRows = computeAnalytics({ rows: filteredRows });

  // object-shape data (locationGroups) — sales-summary / sales-details render වලට
  const objectData = data && !Array.isArray(data) ? (data as any) : null;
  // sales-summary search filter — sales-summary render එකට විතරයි!
  // (sales-details / transaction-summary dateGroups වල rows නෑ →
  //  filterSalesSummary දැම්මම search කරද්දි crash වුණා)
  const summary = config?.render === "sales-summary" ? objectData : null;
  const filteredSummary = useMemo(
    () => (summary ? filterSalesSummary(summary, search) : null),
    [summary, search]
  );

  // ── hooks dariyata PASSEDU early returns ──
  if (!config) {
    return (
      <div
        style={{
          padding: "60px 20px",
          textAlign: "center",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#334155" }}>
          Report Not Found.
        </p>
      </div>
    );
  }

  const printDate = `${p2(printedAt.getDate())}-${
    MONTHS[printedAt.getMonth()]
  }-${printedAt.getFullYear()}`;
  const printTime = (() => {
    let h = printedAt.getHours();
    const ap = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    return `${h}:${p2(printedAt.getMinutes())}:${p2(printedAt.getSeconds())} ${ap}`;
  })();

  const rangeChange = (f: string, t: string) => {
    setStartDate(f);
    setEndDate(t);
  };

  // ── Sales Summary (custom render — SAME toolbar/loading/error/chart) ──
  if (config.render === "sales-summary") {
    // ✅ alut analytics dashboard — fetch karapu data ekemn hadanawa
    const analyticsSum = computeAnalytics({ summary: filteredSummary });

    const pdfDoc = filteredSummary ? (
      <SalesSummaryPdfDocument
        title={config.title}
        printDate={printDate}
        printTime={printTime}
        from={fmtDMonY(startDate)}
        to={fmtDMonY(endDate)}
        locationGroups={filteredSummary.locationGroups}
        grandTotal={filteredSummary.grandTotal}
      />
    ) : undefined;

    return (
      <>
        <ReportToolbar
          title={config.title}
          subtitle={config.subtitle}
          from={startDate}
          to={endDate}
          onRangeChange={rangeChange}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search bill no, steward, mode..."
          pdfDocument={pdfDoc}
          pdfFileName={`sales-summary-${startDate}_to_${endDate}.pdf`}
          chartSupported={!!analyticsSum || chartMode}
          chartMode={chartMode}
          onChartToggle={() => setChartMode((c) => !c)}
        />
        <div id="report-zoom-area" style={{ flex: 1 }}>
          {loading ? (
            <LoadingBlock />
          ) : error ? (
            <ErrorBlock message={error} />
          ) : chartMode && analyticsSum ? (
            <ReportDashboard analytics={analyticsSum} title={config.title} />
          ) : filteredSummary ? (
            <SalesSummaryReport report={filteredSummary} />
          ) : null}
        </div>
      </>
    );
  }

  // ── Sales Details (custom render — bill-wise items + totals box) ──
  if (config.render === "sales-details") {
    const details = objectData
      ? (objectData as unknown as SalesDetailsData)
      : null;
    const filteredDetails = details
      ? filterSalesDetails(details, search)
      : null;

    // ✅ alut analytics dashboard — bills+items data ekemn aggregate
    const analyticsDet = computeAnalytics({ details: filteredDetails });

    const pdfDocDetails = filteredDetails ? (
      <SalesDetailsPdfDocument
        title={config.title}
        printDate={printDate}
        printTime={printTime}
        from={fmtDMonY(startDate)}
        to={fmtDMonY(endDate)}
        locationGroups={filteredDetails.locationGroups}
      />
    ) : undefined;

    return (
      <>
        <ReportToolbar
          title={config.title}
          subtitle={config.subtitle}
          from={startDate}
          to={endDate}
          onRangeChange={rangeChange}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search bill no, item, steward..."
          pdfDocument={pdfDocDetails}
          pdfFileName={`sales-details-${startDate}_to_${endDate}.pdf`}
          chartSupported={!!analyticsDet || chartMode}
          chartMode={chartMode}
          onChartToggle={() => setChartMode((c) => !c)}
        />
        <div id="report-zoom-area" style={{ flex: 1 }}>
          {loading ? (
            <LoadingBlock />
          ) : error ? (
            <ErrorBlock message={error} />
          ) : chartMode && analyticsDet ? (
            <ReportDashboard analytics={analyticsDet} title={config.title} />
          ) : filteredDetails ? (
            <SalesDetailsReport report={filteredDetails} />
          ) : null}
        </div>
      </>
    );
  }

  // ── Generic reports (Transaction Summary etc.) ──
  const pdfDoc = (
    <ReportPdfDocument
      title={config.title}
      from={fmtDMonY(startDate)}
      to={fmtDMonY(endDate)}
      columns={config.columns}
      data={filteredRows}
    />
  );

  return (
    <>
      <ReportToolbar
        title={config.title}
        subtitle={config.subtitle}
        from={startDate}
        to={endDate}
        onRangeChange={rangeChange}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search..."
        pdfDocument={pdfDoc}
        pdfFileName={`${config.id}-${startDate}_to_${endDate}.pdf`}
        chartSupported={!!analyticsRows || chartMode}
        chartMode={chartMode}
        onChartToggle={() => setChartMode((c) => !c)}
      />
      <div id="report-zoom-area" style={{ flex: 1 }}>
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorBlock message={error} />
        ) : chartMode && analyticsRows ? (
          <ReportDashboard analytics={analyticsRows} title={config.title} />
        ) : (
          <DynamicReportTable
            columns={config.columns}
            data={filteredRows}
          />
        )}
      </div>
    </>
  );
}
