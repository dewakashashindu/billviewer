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
import ReportChartsView from "@/components/reports/ReportChartsView";
import { buildReportCharts } from "@/components/reports/reportCharts";
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
import CategorySummaryReport, {
  CategoryDetailReport,
  filterCategorySummary,
  filterCategoryDetail,
  type CatSummaryData,
  type CatDetailData,
} from "@/components/reports/CategoryReports";
import {
  CategorySummaryPdfDocument,
  CategoryDetailPdfDocument,
} from "@/components/reports/CategoryPdfDocuments";
import PaymentSummaryReport, {
  filterPayments,
  type PaymentSummaryData,
} from "@/components/reports/PaymentReports";
import PaymentSummaryPdfDocument from "@/components/reports/PaymentPdfDocument";
import BillPayModeGridReport, {
  filterPayGrid,
  type BillPayModeGridData,
} from "@/components/reports/PaymentGridReports";
import BillPayModeGridPdfDocument from "@/components/reports/PaymentGridPdfDocument";
import TransactionSummaryReport, {
  filterTxnSummary,
  flattenTxnForPdf,
  TXN_PDF_COLUMNS,
  type TxnSummaryData,
} from "@/components/reports/TransactionSummaryReport";
import StewardSummaryReport, {
  filterSteward,
  flattenStewardForPdf,
  STW_PDF_COLUMNS,
  type StewardData,
} from "@/components/reports/StewardReports";
import TaxVatReport, {
  filterTaxVat,
  type TaxVatData,
} from "@/components/reports/TaxVatReport";
import TaxVatPdfDocument from "@/components/reports/TaxVatPdfDocument";
import VoidReport, {
  filterVoid,
  VoidPdfDocument,
  type VoidData,
} from "@/components/reports/VoidReport";
import PaxCountReport, {
  filterPax,
  PaxCountPdfDocument,
  type PaxData,
} from "@/components/reports/PaxCountReport";
import OpenTablesReport, {
  filterOpen,
  openToRows,
  OpenTablesPdfDocument,
  type OpenTablesData,
} from "@/components/reports/OpenTablesReport";
import TraceReport, {
  filterTrace,
  traceToRows,
  TracePdfDocument,
  type TraceData,
} from "@/components/reports/TraceReport";
import CreditSummaryReport, {
  filterCreditSummary,
  credSumToRows,
  CreditSummaryPdfDocument,
  type CreditSummaryData,
} from "@/components/reports/CreditSummaryReport";
import CreditHistoryReport, {
  filterCreditHistory,
  credHistToRows,
  CreditHistoryPdfDocument,
  type CreditHistoryData,
} from "@/components/reports/CreditHistoryReport";
import HourlySalesReport, {
  filterHourly,
  hourlyToRows,
  HourlySalesPdfDocument,
  type HourlySalesData,
} from "@/components/reports/HourlySalesReport";
import {
  BillTypeReport,
  filterBillType,
  billTypeToRows,
  BillTypePdfDocument,
  CashierCollectionReport,
  filterCc,
  ccToRows,
  CashierCollectionPdfDocument,
  CashierBreakdownReport,
  filterCbd,
  cbdToRows,
  CashierBreakdownPdfDocument,
  type BillTypeData,
  type CcData,
  type CbdData,
} from "@/components/reports/CashierReports";
import MenuItemIssueReport, {
  MenuItemIssueByDateReport,
  filterMii,
  miiToRows,
  MenuItemIssuePdfDocument,
  type MiiData,
} from "@/components/reports/MenuItemIssueReports";
import ItemMovementReport, {
  filterImv,
  imvToRows,
  ItemMovementPdfDocument,
  type ImvData,
  type ImvMode,
} from "@/components/reports/ItemMovementReport";
import CashInOutReport, {
  filterCio,
  cioToRows,
  CashInOutPdfDocument,
  type CioData,
} from "@/components/reports/CashInOutReport";
import KotBotReport, {
  filterKot,
  kotToRows,
  KotBotPdfDocument,
  type KotData,
} from "@/components/reports/KotBotReport";
import PaymentHistoryReport, {
  AccountDetailReport,
  filterCph,
  cphToRows,
  filterCad,
  cadToRows,
  PaymentHistoryPdfDocument,
  AccountDetailPdfDocument,
  type CphData,
  type CadData,
} from "@/components/reports/CreditSettlementReports";

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
  const [payMode, setPayMode] = useState(searchParams.get("pm") || "");
  const [miiCost, setMiiCost] = useState(false);
  const [imvMode, setImvMode] = useState<ImvMode>("fast");
  const [imvThr, setImvThr] = useState(10);
  const [cioCat, setCioCat] = useState("");
  const [kotType, setKotType] = useState("all");
  const [credCus, setCredCus] = useState("");
  const [cashSel, setCashSel] = useState("");

  // URL change (sidebar modal eken aluth range) -> state update
  useEffect(() => {
    const f = searchParams.get("from");
    const t = searchParams.get("to");
    if (f) setStartDate(f);
    if (t) setEndDate(t);
    setLoc(searchParams.get("loc") || "");
    setOrderMode(searchParams.get("om") || "");
    setBillType(searchParams.get("bt") || "");
    setPayMode(searchParams.get("pm") || "");
  }, [searchParams]);

  // ── single fetch effect — ALL reports (sales summary includes) ──
  useEffect(() => {
    if (!config) return;
    let alive = true;
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
          billType: billType || config.lockBillType || undefined,
          payMode: payMode || undefined,
          withCost: miiCost || undefined,
          movement: imvMode,
          threshold: imvThr,
          payCat: cioCat || undefined,
          trcType: kotType,
          cusId: credCus || undefined,
          cashier: cashSel || undefined,
        });
        if (!alive) return;
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
  }, [reportId, config, startDate, endDate, loc, orderMode, billType, payMode, miiCost, imvMode, imvThr, cioCat, kotType, credCus, cashSel, router]);

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
  const chartsRows = buildReportCharts(reportId, filteredRows);

  const objectData = data && !Array.isArray(data) ? (data as any) : null;
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
    const chartsSum = buildReportCharts(reportId, filteredSummary);

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
          chartSupported={chartsSum.length > 0}
          chartMode={chartMode}
          onChartToggle={() => setChartMode((c) => !c)}
        />
        <div id="report-zoom-area" style={{ flex: 1 }}>
          {loading ? (
            <LoadingBlock />
          ) : error ? (
            <ErrorBlock message={error} />
          ) : chartMode && chartsSum.length > 0 ? (
            <ReportChartsView charts={chartsSum} title={config.title} />
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
    const chartsDet = buildReportCharts(reportId, filteredDetails);

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
          chartSupported={chartsDet.length > 0}
          chartMode={chartMode}
          onChartToggle={() => setChartMode((c) => !c)}
        />
        <div id="report-zoom-area" style={{ flex: 1 }}>
          {loading ? (
            <LoadingBlock />
          ) : error ? (
            <ErrorBlock message={error} />
          ) : chartMode && chartsDet.length > 0 ? (
            <ReportChartsView charts={chartsDet} title={config.title} />
          ) : filteredDetails ? (
            <SalesDetailsReport report={filteredDetails} />
          ) : null}
        </div>
      </>
    );
  }

  // ── Sales By Category – Summery (1.3.1) ──
  if (config.render === "category-summary") {
    const catSum = objectData
      ? (objectData as unknown as CatSummaryData)
      : null;
    const filteredCats = catSum
      ? filterCategorySummary(catSum, search)
      : null;
    const chartsCats = filteredCats ? buildReportCharts(reportId, filteredCats) : [];
    const pdfDocCat = filteredCats ? (
      <CategorySummaryPdfDocument
        title={config.title}
        printDate={printDate}
        printTime={printTime}
        from={fmtDMonY(startDate)}
        to={fmtDMonY(endDate)}
        data={filteredCats}
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
          searchPlaceholder="Search category, item..."
          pdfDocument={pdfDocCat}
          pdfFileName={`category-summary-${startDate}_to_${endDate}.pdf`}
          chartSupported={chartsCats.length > 0}
          chartMode={chartMode}
          onChartToggle={() => setChartMode((c) => !c)}
        />
        <div id="report-zoom-area" style={{ flex: 1 }}>
          {loading ? (
            <LoadingBlock />
          ) : error ? (
            <ErrorBlock message={error} />
          ) : chartMode && chartsCats.length > 0 ? (
            <ReportChartsView charts={chartsCats} title={config.title} />
          ) : filteredCats ? (
            <CategorySummaryReport report={filteredCats} />
          ) : null}
        </div>
      </>
    );
  }

  // ── Sales By Category – Detail (1.3.2) ──
  if (config.render === "category-detail") {
    const catDet = objectData
      ? (objectData as unknown as CatDetailData)
      : null;
    const filteredCatDet = catDet
      ? filterCategoryDetail(catDet, search)
      : null;
    const chartsCatDet = filteredCatDet ? buildReportCharts(reportId, filteredCatDet) : [];
    const pdfDocCatDet = filteredCatDet ? (
      <CategoryDetailPdfDocument
        title={config.title}
        printDate={printDate}
        printTime={printTime}
        from={fmtDMonY(startDate)}
        to={fmtDMonY(endDate)}
        data={filteredCatDet}
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
          pdfDocument={pdfDocCatDet}
          pdfFileName={`category-detail-${startDate}_to_${endDate}.pdf`}
          chartSupported={chartsCatDet.length > 0}
          chartMode={chartMode}
          onChartToggle={() => setChartMode((c) => !c)}
        />
        <div id="report-zoom-area" style={{ flex: 1 }}>
          {loading ? (
            <LoadingBlock />
          ) : error ? (
            <ErrorBlock message={error} />
          ) : chartMode && chartsCatDet.length > 0 ? (
            <ReportChartsView charts={chartsCatDet} title={config.title} />
          ) : filteredCatDet ? (
            <CategoryDetailReport report={filteredCatDet} />
          ) : null}
        </div>
      </>
    );
  }

  // ── Payment Mode – Payment Summary (2.1 / 2.2) ──
  if (config.render === "payment-summary") {
    const payData = objectData
      ? (objectData as unknown as PaymentSummaryData)
      : null;
    const filteredPays = payData ? filterPayments(payData, search) : null;
    const chartsPays = filteredPays ? buildReportCharts(reportId, filteredPays) : [];
    const pdfDocPays = filteredPays ? (
      <PaymentSummaryPdfDocument
        title={config.title}
        printDate={printDate}
        printTime={printTime}
        from={fmtDMonY(startDate)}
        to={fmtDMonY(endDate)}
        data={filteredPays}
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
          searchPlaceholder="Search bill no, payment mode, casher..."
          pdfDocument={pdfDocPays}
          pdfFileName={`payment-summary-${startDate}_to_${endDate}.pdf`}
          chartSupported={chartsPays.length > 0}
          chartMode={chartMode}
          onChartToggle={() => setChartMode((c) => !c)}
        />
        <div id="report-zoom-area" style={{ flex: 1 }}>
          {loading ? (
            <LoadingBlock />
          ) : error ? (
            <ErrorBlock message={error} />
          ) : chartMode && chartsPays.length > 0 ? (
            <ReportChartsView charts={chartsPays} title={config.title} />
          ) : filteredPays ? (
            <PaymentSummaryReport report={filteredPays} />
          ) : null}
        </div>
      </>
    );
  }

  // ── 2.3 Payment – Bill Pay Mode Wise Grid ──
  if (config.render === "payment-grid") {
    const gridData = objectData
      ? (objectData as unknown as BillPayModeGridData)
      : null;
    const filteredGrid = gridData ? filterPayGrid(gridData, search) : null;
    const chartsGrid = filteredGrid ? buildReportCharts(reportId, filteredGrid) : [];
    const pdfDocGrid = filteredGrid ? (
      <BillPayModeGridPdfDocument
        title={config.title}
        printDate={printDate}
        printTime={printTime}
        from={fmtDMonY(startDate)}
        to={fmtDMonY(endDate)}
        data={filteredGrid}
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
          searchPlaceholder="Search bill no, pay mode..."
          pdfDocument={pdfDocGrid}
          pdfFileName={`bill-paymode-grid-${startDate}_to_${endDate}.pdf`}
          chartSupported={chartsGrid.length > 0}
          chartMode={chartMode}
          onChartToggle={() => setChartMode((c) => !c)}
        />
        {(gridData as unknown as { cashiers?: Array<{ id: string; des: string }> } | null)?.cashiers?.length ? (
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: "10px 4px 0",
              fontFamily: "Inter, sans-serif",
              fontSize: 12,
              color: "#334155",
              alignItems: "center",
            }}
          >
            <label style={{ fontWeight: 600 }}>Cashier</label>
            <select
              value={cashSel}
              onChange={(e) => setCashSel(e.target.value)}
              style={{
                padding: "5px 8px",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                fontFamily: "Inter, sans-serif",
                fontSize: 12,
                background: "#fff",
                minWidth: 180,
              }}
            >
              <option value="">— All Cashiers —</option>
              {(gridData as unknown as { cashiers: Array<{ id: string; des: string }> }).cashiers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} · {c.des}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div id="report-zoom-area" style={{ flex: 1 }}>
          {loading ? (
            <LoadingBlock />
          ) : error ? (
            <ErrorBlock message={error} />
          ) : chartMode && chartsGrid.length > 0 ? (
            <ReportChartsView charts={chartsGrid} title={config.title} />
          ) : filteredGrid ? (
            <BillPayModeGridReport report={filteredGrid} />
          ) : null}
        </div>
      </>
    );
  }

  // ── 7.1 Transaction Summary By Date (Vw_DailyPerformance) ──
  if (config.render === "transaction-summary") {
    const txnData = objectData
      ? (objectData as unknown as TxnSummaryData)
      : null;
    const filteredTxn = txnData ? filterTxnSummary(txnData, search) : null;
    const chartsTxn = filteredTxn ? buildReportCharts(reportId, filteredTxn) : [];
    const pdfDocTxn = filteredTxn ? (
      <ReportPdfDocument
        title={config.title}
        from={fmtDMonY(startDate)}
        to={fmtDMonY(endDate)}
        columns={TXN_PDF_COLUMNS}
        data={flattenTxnForPdf(filteredTxn)}
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
          searchPlaceholder="Search date, location..."
          pdfDocument={pdfDocTxn}
          pdfFileName={`transaction-summary-${startDate}_to_${endDate}.pdf`}
          chartSupported={chartsTxn.length > 0}
          chartMode={chartMode}
          onChartToggle={() => setChartMode((c) => !c)}
        />
        <div id="report-zoom-area" style={{ flex: 1 }}>
          {loading ? (
            <LoadingBlock />
          ) : error ? (
            <ErrorBlock message={error} />
          ) : chartMode && chartsTxn.length > 0 ? (
            <ReportChartsView charts={chartsTxn} title={config.title} />
          ) : filteredTxn ? (
            <TransactionSummaryReport report={filteredTxn} />
          ) : null}
        </div>
      </>
    );
  }

  // ── 6.1 / 8.1 Steward Wise & Service Charge ──
  if (config.render === "steward-wise") {
    const stwData = objectData
      ? (objectData as unknown as StewardData)
      : null;
    const filteredStw = stwData ? filterSteward(stwData, search) : null;
    const chartsStw = filteredStw ? buildReportCharts(reportId, filteredStw) : [];
    const pdfDocStw = filteredStw ? (
      <ReportPdfDocument
        title={config.title}
        from={fmtDMonY(startDate)}
        to={fmtDMonY(endDate)}
        columns={STW_PDF_COLUMNS}
        data={flattenStewardForPdf(filteredStw)}
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
          searchPlaceholder="Search steward, location, date..."
          pdfDocument={pdfDocStw}
          pdfFileName={`${config.id}-${startDate}_to_${endDate}.pdf`}
          chartSupported={chartsStw.length > 0}
          chartMode={chartMode}
          onChartToggle={() => setChartMode((c) => !c)}
        />
        <div id="report-zoom-area" style={{ flex: 1 }}>
          {loading ? (
            <LoadingBlock />
          ) : error ? (
            <ErrorBlock message={error} />
          ) : chartMode && chartsStw.length > 0 ? (
            <ReportChartsView charts={chartsStw} title={config.title} />
          ) : filteredStw ? (
            <StewardSummaryReport report={filteredStw} />
          ) : null}
        </div>
      </>
    );
  }

  // ── 8.2 Tax & VAT Report ──
  if (config.render === "tax-vat") {
    const tvData = objectData
      ? (objectData as unknown as TaxVatData)
      : null;
    const filteredTv = tvData ? filterTaxVat(tvData, search) : null;
    const chartsTv = filteredTv ? buildReportCharts(reportId, filteredTv) : [];
    const pdfDocTv = filteredTv ? (
      <TaxVatPdfDocument
        title={config.title}
        printDate={printDate}
        printTime={printTime}
        from={fmtDMonY(startDate)}
        to={fmtDMonY(endDate)}
        data={filteredTv}
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
          searchPlaceholder="Search bill no, date..."
          pdfDocument={pdfDocTv}
          pdfFileName={`tax-vat-${startDate}_to_${endDate}.pdf`}
          chartSupported={chartsTv.length > 0}
          chartMode={chartMode}
          onChartToggle={() => setChartMode((c) => !c)}
        />
        <div id="report-zoom-area" style={{ flex: 1 }}>
          {loading ? (
            <LoadingBlock />
          ) : error ? (
            <ErrorBlock message={error} />
          ) : chartMode && chartsTv.length > 0 ? (
            <ReportChartsView charts={chartsTv} title={config.title} />
          ) : filteredTv ? (
            <TaxVatReport report={filteredTv} />
          ) : null}
        </div>
      </>
    );
  }

  // ── 10 Void Summery and Detail ──
  if (config.render === "void-report") {
    const voidData = objectData
      ? (objectData as unknown as VoidData)
      : null;
    const filteredVoid = voidData ? filterVoid(voidData, search) : null;
    const chartsVoid = filteredVoid ? buildReportCharts(reportId, filteredVoid) : [];
    const pdfDocVoid = filteredVoid ? (
      <VoidPdfDocument
        title={config.title}
        printDate={printDate}
        printTime={printTime}
        from={fmtDMonY(startDate)}
        to={fmtDMonY(endDate)}
        data={filteredVoid}
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
          searchPlaceholder="Search bill no, item, cashier..."
          pdfDocument={pdfDocVoid}
          pdfFileName={`void-${startDate}_to_${endDate}.pdf`}
          chartSupported={chartsVoid.length > 0}
          chartMode={chartMode}
          onChartToggle={() => setChartMode((c) => !c)}
        />
        <div id="report-zoom-area" style={{ flex: 1 }}>
          {loading ? (
            <LoadingBlock />
          ) : error ? (
            <ErrorBlock message={error} />
          ) : chartMode && chartsVoid.length > 0 ? (
            <ReportChartsView charts={chartsVoid} title={config.title} />
          ) : filteredVoid ? (
            <VoidReport report={filteredVoid} />
          ) : null}
        </div>
      </>
    );
  }

  // ── 11 Pax Count ──
  if (config.render === "pax-count") {
    const paxData = objectData
      ? (objectData as unknown as PaxData)
      : null;
    const filteredPax = paxData ? filterPax(paxData, search) : null;
    const chartsPax = filteredPax ? buildReportCharts(reportId, filteredPax) : [];
    const pdfDocPax = filteredPax ? (
      <PaxCountPdfDocument
        title={config.title}
        printDate={printDate}
        printTime={printTime}
        from={fmtDMonY(startDate)}
        to={fmtDMonY(endDate)}
        data={filteredPax}
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
          searchPlaceholder="Search bill no, date..."
          pdfDocument={pdfDocPax}
          pdfFileName={`pax-count-${startDate}_to_${endDate}.pdf`}
          chartSupported={chartsPax.length > 0}
          chartMode={chartMode}
          onChartToggle={() => setChartMode((c) => !c)}
        />
        <div id="report-zoom-area" style={{ flex: 1 }}>
          {loading ? (
            <LoadingBlock />
          ) : error ? (
            <ErrorBlock message={error} />
          ) : chartMode && chartsPax.length > 0 ? (
            <ReportChartsView charts={chartsPax} title={config.title} />
          ) : filteredPax ? (
            <PaxCountReport report={filteredPax} />
          ) : null}
        </div>
      </>
    );
  }

  // ── 12 Cash In/Out ──
  if (config.render === "cash-inout") {
    const cioData = objectData ? (objectData as unknown as CioData) : null;
    const filteredCIO = cioData ? filterCio(cioData, search) : null;
    const chartsCIO = filteredCIO ? buildReportCharts(reportId, filteredCIO) : [];
    const pdfDocCIO = filteredCIO ? (
      <CashInOutPdfDocument
        title={config.title}
        printDate={printDate}
        printTime={printTime}
        from={fmtDMonY(startDate)}
        to={fmtDMonY(endDate)}
        data={filteredCIO}
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
          searchPlaceholder="Search txn, category, remarks, user..."
          pdfDocument={pdfDocCIO}
          pdfFileName={`cash-inout-${startDate}_to_${endDate}.pdf`}
          chartSupported={chartsCIO.length > 0}
          chartMode={chartMode}
          onChartToggle={() => setChartMode((c) => !c)}
        />
        {cioData && cioData.categories.length > 0 ? (
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: "10px 4px 0",
              fontFamily: "Inter, sans-serif",
              fontSize: 12,
              color: "#334155",
              alignItems: "center",
            }}
          >
            <label style={{ fontWeight: 600 }}>Include Category</label>
            <select
              value={cioCat}
              onChange={(e) => setCioCat(e.target.value)}
              style={{
                padding: "5px 8px",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                fontFamily: "Inter, sans-serif",
                fontSize: 12,
                background: "#fff",
                minWidth: 180,
              }}
            >
              <option value="">— All Categories —</option>
              {cioData.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} · {c.des}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div id="report-zoom-area" style={{ flex: 1 }}>
          {loading ? (
            <LoadingBlock />
          ) : error ? (
            <ErrorBlock message={error} />
          ) : chartMode && chartsCIO.length > 0 ? (
            <ReportChartsView charts={chartsCIO} title={config.title} />
          ) : filteredCIO ? (
            <CashInOutReport report={filteredCIO} />
          ) : null}
        </div>
      </>
    );
  }

  // ── 16 KOT/BOT Tracing ──
  if (config.render === "kot-bot") {
    const kotData = objectData ? (objectData as unknown as KotData) : null;
    const filteredKOT = kotData ? filterKot(kotData, search) : null;
    const chartsKOT = filteredKOT ? buildReportCharts(reportId, filteredKOT) : [];
    const pdfDocKOT = filteredKOT ? (
      <KotBotPdfDocument
        title={config.title}
        printDate={printDate}
        printTime={printTime}
        from={fmtDMonY(startDate)}
        to={fmtDMonY(endDate)}
        data={filteredKOT}
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
          searchPlaceholder="Search ordno, item, user, remark..."
          pdfDocument={pdfDocKOT}
          pdfFileName={`kot-bot-${startDate}_to_${endDate}.pdf`}
          chartSupported={chartsKOT.length > 0}
          chartMode={chartMode}
          onChartToggle={() => setChartMode((c) => !c)}
        />
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "10px 4px 0",
            fontFamily: "Inter, sans-serif",
            fontSize: 12,
            color: "#334155",
            alignItems: "center",
          }}
        >
          <label style={{ fontWeight: 600 }}>Trc Type</label>
          <select
            value={kotType}
            onChange={(e) => setKotType(e.target.value)}
            style={{
              padding: "5px 8px",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              fontFamily: "Inter, sans-serif",
              fontSize: 12,
              background: "#fff",
              minWidth: 140,
            }}
          >
            <option value="all">All</option>
            <option value="kitchen">Kitchen</option>
            <option value="bar">Bar</option>
            <option value="other">Other</option>
            <option value="bay1">Bay 1</option>
            <option value="bay2">Bay 2</option>
            <option value="bay3">Bay 3</option>
            <option value="bay4">Bay 4</option>
            <option value="bay5">Bay 5</option>
            <option value="bay6">Bay 6</option>
            <option value="bay7">Bay 7</option>
            <option value="head">Head</option>
          </select>
        </div>
        <div id="report-zoom-area" style={{ flex: 1 }}>
          {loading ? (
            <LoadingBlock />
          ) : error ? (
            <ErrorBlock message={error} />
          ) : chartMode && chartsKOT.length > 0 ? (
            <ReportChartsView charts={chartsKOT} title={config.title} />
          ) : filteredKOT ? (
            <KotBotReport report={filteredKOT} />
          ) : null}
        </div>
      </>
    );
  }

  // ── 21.3 / 21.4 Credit Settlement — Payment History / Account Detail ──
  if (config.render === "credit-pay-history" || config.render === "credit-account-detail") {
    const isCph = config.render === "credit-pay-history";
    const cphData = isCph && objectData ? (objectData as unknown as CphData) : null;
    const cadData = !isCph && objectData ? (objectData as unknown as CadData) : null;
    const filteredCPH = cphData ? filterCph(cphData, search) : null;
    const filteredCAD = cadData ? filterCad(cadData, search) : null;
    const chartsCR = filteredCPH
      ? buildReportCharts(reportId, filteredCPH)
      : filteredCAD
        ? buildReportCharts(reportId, filteredCAD)
        : [];
    const custList = cphData ? cphData.customers : cadData ? cadData.customers : [];
    const pdfDocCR = filteredCPH ? (
      <PaymentHistoryPdfDocument
        title={config.title}
        printDate={printDate}
        printTime={printTime}
        from={fmtDMonY(startDate)}
        to={fmtDMonY(endDate)}
        data={filteredCPH}
      />
    ) : filteredCAD ? (
      <AccountDetailPdfDocument
        title={config.title}
        printDate={printDate}
        printTime={printTime}
        from={fmtDMonY(startDate)}
        to={fmtDMonY(endDate)}
        data={filteredCAD}
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
          searchPlaceholder="Search customer, bill, invoice..."
          pdfDocument={pdfDocCR}
          pdfFileName={`${config.id}-${startDate}_to_${endDate}.pdf`}
          chartSupported={chartsCR.length > 0}
          chartMode={chartMode}
          onChartToggle={() => setChartMode((c) => !c)}
        />
        {custList.length > 0 ? (
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: "10px 4px 0",
              fontFamily: "Inter, sans-serif",
              fontSize: 12,
              color: "#334155",
              alignItems: "center",
            }}
          >
            <label style={{ fontWeight: 600 }}>Customer</label>
            <select
              value={credCus}
              onChange={(e) => setCredCus(e.target.value)}
              style={{
                padding: "5px 8px",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                fontFamily: "Inter, sans-serif",
                fontSize: 12,
                background: "#fff",
                minWidth: 180,
              }}
            >
              <option value="">— Select All —</option>
              {custList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} · {c.des}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div id="report-zoom-area" style={{ flex: 1 }}>
          {loading ? (
            <LoadingBlock />
          ) : error ? (
            <ErrorBlock message={error} />
          ) : chartMode && chartsCR.length > 0 ? (
            <ReportChartsView charts={chartsCR} title={config.title} />
          ) : filteredCPH ? (
            <PaymentHistoryReport report={filteredCPH} />
          ) : filteredCAD ? (
            <AccountDetailReport report={filteredCAD} />
          ) : null}
        </div>
      </>
    );
  }

  // ── 5.1 Item Movement ──
  if (config.render === "item-movement") {
    const imvData = objectData ? (objectData as unknown as ImvData) : null;
    const filteredIMV = imvData ? filterImv(imvData, search) : null;
    const chartsIMV = filteredIMV ? buildReportCharts(reportId, filteredIMV) : [];
    const pdfDocIMV = filteredIMV ? (
      <ItemMovementPdfDocument
        title={config.title}
        printDate={printDate}
        printTime={printTime}
        from={fmtDMonY(startDate)}
        to={fmtDMonY(endDate)}
        data={filteredIMV}
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
          searchPlaceholder="Search item code or name..."
          pdfDocument={pdfDocIMV}
          pdfFileName={`item-movement-${imvMode}-${startDate}_to_${endDate}.pdf`}
          chartSupported={chartsIMV.length > 0}
          chartMode={chartMode}
          onChartToggle={() => setChartMode((c) => !c)}
        />
        <div
          style={{
            display: "flex",
            gap: 18,
            padding: "10px 4px 0",
            fontFamily: "Inter, sans-serif",
            fontSize: 12,
            color: "#334155",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {(["fast", "slow", "non"] as ImvMode[]).map((m) => (
            <label key={m} style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer", fontWeight: 600 }}>
              <input
                type="radio"
                name="imv-mode"
                checked={imvMode === m}
                onChange={() => setImvMode(m)}
              />
              {m === "fast" ? "Fast Moving" : m === "slow" ? "Slow Moving" : "Non Moving"}
            </label>
          ))}
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 600 }}>
            Threshold
            <input
              type="number"
              min={1}
              value={imvThr}
              onChange={(e) => setImvThr(Math.max(1, Number(e.target.value) || 1))}
              style={{
                width: 64,
                padding: "4px 8px",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                fontFamily: "Inter, sans-serif",
                fontSize: 12,
              }}
            />
          </label>
        </div>
        <div id="report-zoom-area" style={{ flex: 1 }}>
          {loading ? (
            <LoadingBlock />
          ) : error ? (
            <ErrorBlock message={error} />
          ) : chartMode && chartsIMV.length > 0 ? (
            <ReportChartsView charts={chartsIMV} title={config.title} />
          ) : filteredIMV ? (
            <ItemMovementReport report={filteredIMV} />
          ) : null}
        </div>
      </>
    );
  }

  // ── 4.1 / 4.2 Menu Item Issue ──
  if (config.render === "mii" || config.render === "mii-date") {
    const miiData = objectData ? (objectData as unknown as MiiData) : null;
    const filteredMII = miiData ? filterMii(miiData, search) : null;
    const chartsMII = filteredMII ? buildReportCharts(reportId, filteredMII) : [];
    const pdfDocMII = filteredMII ? (
      <MenuItemIssuePdfDocument
        title={config.title}
        printDate={printDate}
        printTime={printTime}
        from={fmtDMonY(startDate)}
        to={fmtDMonY(endDate)}
        data={filteredMII}
        byDate={config.render === "mii-date"}
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
          searchPlaceholder="Search item code, name, dept..."
          pdfDocument={pdfDocMII}
          pdfFileName={`${config.id}-${startDate}_to_${endDate}.pdf`}
          chartSupported={chartsMII.length > 0}
          chartMode={chartMode}
          onChartToggle={() => setChartMode((c) => !c)}
        />
        <div
          style={{
            display: "flex",
            gap: 16,
            padding: "10px 4px 0",
            fontFamily: "Inter, sans-serif",
            fontSize: 12,
            color: "#334155",
            alignItems: "center",
          }}
        >
          <label style={{ display: "flex", gap: 7, alignItems: "center", cursor: "pointer", fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={miiCost}
              onChange={(e) => setMiiCost(e.target.checked)}
            />
            With Sale Cost
          </label>
          <span style={{ color: "#94a3b8", fontSize: 11 }}>
            (POS dialog checkbox — uses Sp_SalesItemIssueWSC when ticked)
          </span>
        </div>
        <div id="report-zoom-area" style={{ flex: 1 }}>
          {loading ? (
            <LoadingBlock />
          ) : error ? (
            <ErrorBlock message={error} />
          ) : chartMode && chartsMII.length > 0 ? (
            <ReportChartsView charts={chartsMII} title={config.title} />
          ) : filteredMII ? (
            config.render === "mii-date" ? (
              <MenuItemIssueByDateReport report={filteredMII} />
            ) : (
              <MenuItemIssueReport report={filteredMII} />
            )
          ) : null}
        </div>
      </>
    );
  }

  // ── 2.4 Payment - Bill Type Wise ──
  if (config.render === "billtype") {
    const btData = objectData ? (objectData as unknown as BillTypeData) : null;
    const filteredBT = btData ? filterBillType(btData, search) : null;
    const chartsBT = filteredBT ? buildReportCharts(reportId, filteredBT) : [];
    const pdfDocBT = filteredBT ? (
      <BillTypePdfDocument title={config.title} printDate={printDate} printTime={printTime} from={fmtDMonY(startDate)} to={fmtDMonY(endDate)} data={filteredBT} />
    ) : undefined;
    return (
      <>
        <ReportToolbar title={config.title} subtitle={config.subtitle} from={startDate} to={endDate} onRangeChange={rangeChange} search={search} onSearchChange={setSearch} searchPlaceholder="Search bill type..." pdfDocument={pdfDocBT} pdfFileName={`payment-billtype-${startDate}_to_${endDate}.pdf`} chartSupported={chartsBT.length > 0} chartMode={chartMode} onChartToggle={() => setChartMode((c) => !c)} />
        <div id="report-zoom-area" style={{ flex: 1 }}>
          {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} /> : chartMode && chartsBT.length > 0 ? <ReportChartsView charts={chartsBT} title={config.title} /> : filteredBT ? <BillTypeReport report={filteredBT} /> : null}
        </div>
      </>
    );
  }

  // ── 3.1 Cashier Wise Sales ──
  if (config.render === "cashier-collection") {
    const ccData = objectData ? (objectData as unknown as CcData) : null;
    const filteredCC = ccData ? filterCc(ccData, search) : null;
    const chartsCC = filteredCC ? buildReportCharts(reportId, filteredCC) : [];
    const pdfDocCC = filteredCC ? (
      <CashierCollectionPdfDocument title={config.title} printDate={printDate} printTime={printTime} from={fmtDMonY(startDate)} to={fmtDMonY(endDate)} data={filteredCC} />
    ) : undefined;
    return (
      <>
        <ReportToolbar title={config.title} subtitle={config.subtitle} from={startDate} to={endDate} onRangeChange={rangeChange} search={search} onSearchChange={setSearch} searchPlaceholder="Search cashier or bill no..." pdfDocument={pdfDocCC} pdfFileName={`cashier-collection-${startDate}_to_${endDate}.pdf`} chartSupported={chartsCC.length > 0} chartMode={chartMode} onChartToggle={() => setChartMode((c) => !c)} />
        <div id="report-zoom-area" style={{ flex: 1 }}>
          {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} /> : chartMode && chartsCC.length > 0 ? <ReportChartsView charts={chartsCC} title={config.title} /> : filteredCC ? <CashierCollectionReport report={filteredCC} /> : null}
        </div>
      </>
    );
  }

  // ── 3.2 Payment Break Down ──
  if (config.render === "cashier-breakdown") {
    const cbdData = objectData ? (objectData as unknown as CbdData) : null;
    const filteredCBD = cbdData ? filterCbd(cbdData, search) : null;
    const chartsCBD = filteredCBD ? buildReportCharts(reportId, filteredCBD) : [];
    const pdfDocCBD = filteredCBD ? (
      <CashierBreakdownPdfDocument title={config.title} printDate={printDate} printTime={printTime} from={fmtDMonY(startDate)} to={fmtDMonY(endDate)} data={filteredCBD} />
    ) : undefined;
    return (
      <>
        <ReportToolbar title={config.title} subtitle={config.subtitle} from={startDate} to={endDate} onRangeChange={rangeChange} search={search} onSearchChange={setSearch} searchPlaceholder="Search cashier or mode..." pdfDocument={pdfDocCBD} pdfFileName={`payment-breakdown-${startDate}_to_${endDate}.pdf`} chartSupported={chartsCBD.length > 0} chartMode={chartMode} onChartToggle={() => setChartMode((c) => !c)} />
        <div id="report-zoom-area" style={{ flex: 1 }}>
          {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} /> : chartMode && chartsCBD.length > 0 ? <ReportChartsView charts={chartsCBD} title={config.title} /> : filteredCBD ? <CashierBreakdownReport report={filteredCBD} /> : null}
        </div>
      </>
    );
  }

  // ── 1.5 Hourly Sales ──
  if (config.render === "hourly-sales") {
    const hrData = objectData
      ? (objectData as unknown as HourlySalesData)
      : null;
    const filteredHR = hrData ? filterHourly(hrData, search) : null;
    const chartsHR = filteredHR ? buildReportCharts(reportId, filteredHR) : [];
    const pdfDocHR = filteredHR ? (
      <HourlySalesPdfDocument
        title={config.title}
        printDate={printDate}
        printTime={printTime}
        from={fmtDMonY(startDate)}
        to={fmtDMonY(endDate)}
        data={filteredHR}
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
          searchPlaceholder="Search hour or location..."
          pdfDocument={pdfDocHR}
          pdfFileName={`hourly-sales-${startDate}_to_${endDate}.pdf`}
          chartSupported={chartsHR.length > 0}
          chartMode={chartMode}
          onChartToggle={() => setChartMode((c) => !c)}
        />
        <div id="report-zoom-area" style={{ flex: 1 }}>
          {loading ? (
            <LoadingBlock />
          ) : error ? (
            <ErrorBlock message={error} />
          ) : chartMode && chartsHR.length > 0 ? (
            <ReportChartsView charts={chartsHR} title={config.title} />
          ) : filteredHR ? (
            <HourlySalesReport report={filteredHR} />
          ) : null}
        </div>
      </>
    );
  }

  // ── 21.1 Current Credit Summary ──
  if (config.render === "credit-summary") {
    const csData = objectData
      ? (objectData as unknown as CreditSummaryData)
      : null;
    const filteredCS = csData ? filterCreditSummary(csData, search) : null;
    const chartsCS = filteredCS ? buildReportCharts(reportId, filteredCS) : [];
    const pdfDocCS = filteredCS ? (
      <CreditSummaryPdfDocument
        title={config.title}
        printDate={printDate}
        printTime={printTime}
        from={fmtDMonY(startDate)}
        to={fmtDMonY(endDate)}
        data={filteredCS}
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
          searchPlaceholder="Search customer code or name..."
          pdfDocument={pdfDocCS}
          pdfFileName={`credit-summary-${startDate}_to_${endDate}.pdf`}
          chartSupported={chartsCS.length > 0}
          chartMode={chartMode}
          onChartToggle={() => setChartMode((c) => !c)}
        />
        <div id="report-zoom-area" style={{ flex: 1 }}>
          {loading ? (
            <LoadingBlock />
          ) : error ? (
            <ErrorBlock message={error} />
          ) : chartMode && chartsCS.length > 0 ? (
            <ReportChartsView charts={chartsCS} title={config.title} />
          ) : filteredCS ? (
            <CreditSummaryReport report={filteredCS} />
          ) : null}
        </div>
      </>
    );
  }

  // ── 21.2 / 21.3 Credit & Payment History ──
  if (config.render === "credit-history") {
    const chData = objectData
      ? (objectData as unknown as CreditHistoryData)
      : null;
    const filteredCH = chData ? filterCreditHistory(chData, search) : null;
    const chartsCH = filteredCH ? buildReportCharts(reportId, filteredCH) : [];
    const pdfDocCH = filteredCH ? (
      <CreditHistoryPdfDocument
        title={config.title}
        printDate={printDate}
        printTime={printTime}
        from={fmtDMonY(startDate)}
        to={fmtDMonY(endDate)}
        data={filteredCH}
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
          searchPlaceholder="Search customer code or name..."
          pdfDocument={pdfDocCH}
          pdfFileName={`${config.id}-${startDate}_to_${endDate}.pdf`}
          chartSupported={chartsCH.length > 0}
          chartMode={chartMode}
          onChartToggle={() => setChartMode((c) => !c)}
        />
        <div id="report-zoom-area" style={{ flex: 1 }}>
          {loading ? (
            <LoadingBlock />
          ) : error ? (
            <ErrorBlock message={error} />
          ) : chartMode && chartsCH.length > 0 ? (
            <ReportChartsView charts={chartsCH} title={config.title} />
          ) : filteredCH ? (
            <CreditHistoryReport report={filteredCH} />
          ) : null}
        </div>
      </>
    );
  }

  // ── 14 Open (On-Going) Tables ──
  if (config.render === "open-tables") {
    const openData = objectData
      ? (objectData as unknown as OpenTablesData)
      : null;
    const filteredOpen = openData ? filterOpen(openData, search) : null;
    const chartsOpen = filteredOpen ? buildReportCharts(reportId, filteredOpen) : [];
    const pdfDocOpen = filteredOpen ? (
      <OpenTablesPdfDocument
        title={config.title}
        printDate={printDate}
        printTime={printTime}
        from={fmtDMonY(startDate)}
        to={fmtDMonY(endDate)}
        data={filteredOpen}
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
          searchPlaceholder="Search table, item, cashier..."
          pdfDocument={pdfDocOpen}
          pdfFileName={`open-tables-${startDate}_to_${endDate}.pdf`}
          chartSupported={chartsOpen.length > 0}
          chartMode={chartMode}
          onChartToggle={() => setChartMode((c) => !c)}
        />
        <div id="report-zoom-area" style={{ flex: 1 }}>
          {loading ? (
            <LoadingBlock />
          ) : error ? (
            <ErrorBlock message={error} />
          ) : chartMode && chartsOpen.length > 0 ? (
            <ReportChartsView charts={chartsOpen} title={config.title} />
          ) : filteredOpen ? (
            <OpenTablesReport report={filteredOpen} />
          ) : null}
        </div>
      </>
    );
  }

  // ── 15.1 / 15.2 Slip & Invoice Trace ──
  if (config.render === "trace") {
    const traceData = objectData
      ? (objectData as unknown as TraceData)
      : null;
    const filteredTrace = traceData ? filterTrace(traceData, search) : null;
    const chartsTrace = filteredTrace ? buildReportCharts(reportId, filteredTrace) : [];
    const pdfDocTrace = filteredTrace ? (
      <TracePdfDocument
        title={config.title}
        printDate={printDate}
        printTime={printTime}
        from={fmtDMonY(startDate)}
        to={fmtDMonY(endDate)}
        data={filteredTrace}
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
          searchPlaceholder={reportId === "invoice-trace" ? "Type invoice number..." : "Search bill no, ref, action..."}
          pdfDocument={pdfDocTrace}
          pdfFileName={`${config.id}-${startDate}_to_${endDate}.pdf`}
          chartSupported={chartsTrace.length > 0}
          chartMode={chartMode}
          onChartToggle={() => setChartMode((c) => !c)}
        />
        <div id="report-zoom-area" style={{ flex: 1 }}>
          {loading ? (
            <LoadingBlock />
          ) : error ? (
            <ErrorBlock message={error} />
          ) : chartMode && chartsTrace.length > 0 ? (
            <ReportChartsView charts={chartsTrace} title={config.title} />
          ) : filteredTrace ? (
            <TraceReport report={filteredTrace} invoiceHint={reportId === "invoice-trace"} />
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
        chartSupported={chartsRows.length > 0}
        chartMode={chartMode}
        onChartToggle={() => setChartMode((c) => !c)}
      />
      <div id="report-zoom-area" style={{ flex: 1 }}>
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorBlock message={error} />
        ) : chartMode && chartsRows.length > 0 ? (
            <ReportChartsView charts={chartsRows} title={config.title} />
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
