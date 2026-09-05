"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { REPORTS_CONFIG } from "@/config/reports.config";
import DynamicReportTable from "@/components/reports/DynamicReportTable";
import { PDFDownloadLink } from "@react-pdf/renderer";
import ReportPdfDocument from "@/components/reports/ReportPdfDocument";

export default function DynamicReportPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const reportId = params?.reportId as string;
  const config = REPORTS_CONFIG[reportId];

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // URL params: ?from=YYYY-MM-DD&to=YYYY-MM-DD (sidebar date popup eken enawa)
  const yearStart = new Date(new Date().getFullYear(), 0, 1)
    .toISOString()
    .split("T")[0];
  const today = new Date().toISOString().split("T")[0];

  const [startDate, setStartDate] = useState(
    searchParams.get("from") || yearStart
  );
  const [endDate, setEndDate] = useState(searchParams.get("to") || today);

  // URL change (sidebar modal eken aluth date range ekak) nam state update
  useEffect(() => {
    const f = searchParams.get("from");
    const t = searchParams.get("to");
    if (f) setStartDate(f);
    if (t) setEndDate(t);
  }, [searchParams]);

  useEffect(() => {
    if (!config) return;

    async function loadReportData() {
      setLoading(true);
      setError(null);
      const res = await config.fetchAction({ startDate, endDate });

      if (res.success && res.data) {
        setData(res.data);
      } else {
        setData([]);
        setError(res.error || "Failed to load report data");
      }
      setLoading(false);
    }

    loadReportData();
  }, [reportId, config, startDate, endDate]);

  if (!config) return <div className="p-6">Report Not Found.</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{config.title}</h1>
          <p className="text-sm text-slate-500">{config.subtitle}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* ── Date range filter ── */}
          <label className="text-xs text-slate-500">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-slate-300 rounded px-2 py-1.5 text-xs"
          />
          <label className="text-xs text-slate-500">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-slate-300 rounded px-2 py-1.5 text-xs"
          />

          {!loading && (
            <PDFDownloadLink
              document={
                <ReportPdfDocument
                  title={config.title}
                  columns={config.columns}
                  data={data}
                />
              }
              fileName={`${config.id}-${startDate}_to_${endDate}.pdf`}
              className="bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded shadow hover:bg-blue-700"
            >
              {({ loading: pdfLoading }) =>
                pdfLoading ? "Preparing PDF..." : "Download PDF"
              }
            </PDFDownloadLink>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-slate-500">
          Loading Report Data...
        </div>
      ) : (
        <DynamicReportTable columns={config.columns} data={data} />
      )}
    </div>
  );
}
