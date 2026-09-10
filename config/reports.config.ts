import {
  getTransactionSummaryAction,
  getSalesSummaryAction,
  getSalesDetailsAction,
} from "@/app/actions/reports";

export interface ColumnConfig {
  header: string;
  accessorKey: string;
  type?: "number" | "currency" | "text" | "date";
}

export interface ReportConfig {
  id: string;
  title: string;
  subtitle?: string;
  // "sales-summary" / "sales-details" wage custom renderers wenuwata — generic table eka nemei
  render?: "sales-summary" | "sales-details";
  // 📊 Graphic view — report ekata galapenna chart eka (default: date-wise bars)
  //   bars  = vertical (date-wise) | hbars = horizontal ranking | pie = share donut
  chart?: {
    type: "bars" | "hbars" | "pie";
    labelKey: string; // SQL row eke label column (accessorKey)
    valueKey: string; // SQL row eke value column
  };
  fetchAction: (filters: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  columns: ColumnConfig[];
}

export const REPORTS_CONFIG: Record<string, ReportConfig> = {
  "transaction-summary": {
    id: "transaction-summary",
    title: "Transaction Summary By Date",
    subtitle: "Daily aggregated sales performance",
    fetchAction: getTransactionSummaryAction,
    columns: [
      { header: "Txn Date", accessorKey: "txnDate", type: "text" },
      { header: "Bills", accessorKey: "bills", type: "number" },
      { header: "Local Pax", accessorKey: "localPax", type: "number" },
      { header: "Foreign Pax", accessorKey: "foreignPax", type: "number" },
      { header: "Total Pax", accessorKey: "totalPax", type: "number" },
      { header: "Spending / Bill", accessorKey: "spendingPerBill", type: "currency" },
      { header: "Spending / Pax", accessorKey: "spendingPerPax", type: "currency" },
      { header: "Food Sales", accessorKey: "foodSales", type: "currency" },
      { header: "Beverage Sales", accessorKey: "beverageSales", type: "currency" },
      { header: "Sales Volume", accessorKey: "salesVolume", type: "currency" },
    ],
  },
  "sales-summary": {
    id: "sales-summary",
    title: "Sales Summary",
    subtitle: "Bill-wise daily collection (grouped by date)",
    render: "sales-summary", // custom renderer — generic table eka wenuwata
    fetchAction: getSalesSummaryAction,
    columns: [], // custom render eka nisa columns onepa
  },
  "sales-details": {
    id: "sales-details",
    title: "Sales Details",
    subtitle: "Bill-wise item details with totals (grouped by location & date)",
    render: "sales-details", // custom renderer — generic table eka wenuwata
    fetchAction: getSalesDetailsAction,
    columns: [], // custom render eka nisa columns onepa
  },
  // Reports 50 දක්වා අලුත් Reports මෙතැනට Config එකක් ලෙස පහසුවෙන් Add කළ හැක
};