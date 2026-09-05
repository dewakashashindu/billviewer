"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { REPORTS_CONFIG } from "@/config/reports.config";
import DynamicReportTable from "@/components/reports/DynamicReportTable";
import { PDFDownloadLink } from "@react-pdf/renderer";
import ReportPdfDocument from "@/components/reports/ReportPdfDocument";

export default function DynamicReportPage() {
  const params = useParams();
  const reportId = params?.reportId as string;
  const config = REPORTS_CONFIG[reportId];

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!config) return;

    async function loadReportData() {
      setLoading(true);
      const res = await config.fetchAction({
        startDate: "2026-01-01",
        endDate: "2026-09-05",
      });

      if (res.success && res.data) {
        setData(res.data);
      }
      setLoading(false);
    }

    loadReportData();
  }, [reportId, config]);

  if (!config) return <div className="p-6">Report Not Found.</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">{config.title}</h1>
          <p className="text-sm text-slate-500">{config.subtitle}</p>
        </div>

        {!loading && (
          <PDFDownloadLink
            document={<ReportPdfDocument title={config.title} columns={config.columns} data={data} />}
            fileName={`${config.id}-report.pdf`}
            className="bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded shadow hover:bg-blue-700"
          >
            {({ loading: pdfLoading }) => (pdfLoading ? "Preparing PDF..." : "Download PDF")}
          </PDFDownloadLink>
        )}
      </div>

      {loading ? (
        <div className="py-10 text-center text-slate-500">Loading Report Data...</div>
      ) : (
        <DynamicReportTable columns={config.columns} data={data} />
      )}
    </div>
  );
}