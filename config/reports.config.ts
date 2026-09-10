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

/** DateRangeModal එකේ අමතර filter dropdown එකක් (POS 1.1.1 / 1.1.2) */
export interface ReportFilterSpec {
  type: "order-mode" | "bill-type";
  param: string; // URL param name (om / bt)
  label: string;
  options: { value: string; label: string }[];
}

export interface ReportConfig {
  id: string;
  title: string;
  subtitle?: string;
  // "sales-summary" / "sales-details" wage custom renderers wenuwata — generic table eka nemei
  render?: "sales-summary" | "sales-details";
  // අමතර filter එකක් ඕන report එකකට (Order Mode / Bill Type)
  filter?: ReportFilterSpec;
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
  // 1.1.1 — POS eke "Sales Summery – Order Mode wise"
  "sales-summary-order-mode": {
    id: "sales-summary-order-mode",
    title: "Sales Summery – Order Mode Wise",
    subtitle: "Bill-wise daily collection filtered by order mode",
    render: "sales-summary",
    fetchAction: getSalesSummaryAction,
    columns: [],
    filter: {
      type: "order-mode",
      param: "om",
      label: "Order Mode",
      options: [
        { value: "DI", label: "Dining" },
        { value: "TA", label: "TakeAway" },
        { value: "DL", label: "Delivery" },
        { value: "PU", label: "PickUp" },
      ],
    },
  },
  // 1.1.2 — POS eke "Sales Summery – Bill Type Wise"
  "sales-summary-bill-type": {
    id: "sales-summary-bill-type",
    title: "Sales Summery – Bill Type Wise",
    subtitle: "Bill-wise daily collection filtered by bill type",
    render: "sales-summary",
    fetchAction: getSalesSummaryAction,
    columns: [],
    filter: {
      type: "bill-type",
      param: "bt",
      label: "Bill Type",
      options: [
        { value: "SD", label: "Standered" },
        { value: "CM", label: "Complimentary" },
        { value: "CO", label: "Cost" },
      ],
    },
  },
  // 1.2.1 — POS eke "Sales Detail – Bill Type Wise" (item-level, Vw_SalesDetail)
  "sales-details-bill-type": {
    id: "sales-details-bill-type",
    title: "Sales Detail – Bill Type Wise",
    subtitle: "Bill-wise item details filtered by bill type",
    render: "sales-details",
    fetchAction: getSalesDetailsAction,
    columns: [],
    filter: {
      type: "bill-type",
      param: "bt",
      label: "Bill Type",
      options: [
        { value: "SD", label: "Standered" },
        { value: "CM", label: "Complimentary" },
        { value: "CO", label: "Cost" },
      ],
    },
  },
  // 1.2.2 — POS eke "Sales Detail – Order Mode Wise" (item-level)
  "sales-details-order-mode": {
    id: "sales-details-order-mode",
    title: "Sales Detail – Order Mode Wise",
    subtitle: "Bill-wise item details filtered by order mode",
    render: "sales-details",
    fetchAction: getSalesDetailsAction,
    columns: [],
    filter: {
      type: "order-mode",
      param: "om",
      label: "Order Mode",
      options: [
        { value: "DI", label: "Dining" },
        { value: "TA", label: "TakeAway" },
        { value: "DL", label: "Delivery" },
        { value: "PU", label: "PickUp" },
      ],
    },
  },
  // Reports 50 දක්වා අලුත් Reports මෙතැනට Config එකක් ලෙස පහසුවෙන් Add කළ හැක
};