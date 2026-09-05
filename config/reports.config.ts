import { getTransactionSummaryAction } from "@/app/actions/reports";

export interface ColumnConfig {
  header: string;
  accessorKey: string;
  type?: "number" | "currency" | "text" | "date";
}

export interface ReportConfig {
  id: string;
  title: string;
  subtitle?: string;
  fetchAction: (filters: any) => Promise<{ success: boolean; data?: any[]; error?: string }>;
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
  // Reports 50 දක්වා අලුත් Reports මෙතැනට Config එකක් ලෙස පහසුවෙන් Add කළ හැක
};