import {
  getTransactionSummaryAction,
  getSalesSummaryAction,
  getSalesDetailsAction,
  getCategorySummaryAction,
  getCategoryDetailAction,
  getPaymentSummaryAction,
  getBillPayModeGridAction,
  getStewardWiseAction,
  getServiceChargeAction,
  getTaxVatAction,
  getVoidReportAction,
  getPaxCountAction,
  getOpenTablesAction,
  getSlipTraceAction,
  getCreditSummaryAction,
  getCreditHistoryAction,
  getCreditPayHistoryAction,
  getHourlySalesAction,
  getBillTypePaymentAction,
  getCashierCollectionAction,
  getCashierBreakdownAction,
  getMenuIssueAction,
  getItemMovementAction,
  getCashInOutAction,
  getKotBotAction,
  getCreditAccountDetailAction,
  getCashierBreakdownGridAction,
} from "@/app/actions/reports";

export interface ColumnConfig {
  header: string;
  accessorKey: string;
  type?: "number" | "currency" | "text" | "date";
}

export interface ReportFilterSpec {
  type: "order-mode" | "bill-type" | "pay-mode";
  param: string; // URL param name (om / bt)
  label: string;
  options: { value: string; label: string }[];
}

export interface ReportConfig {
  id: string;
  title: string;
  subtitle?: string;
  // "sales-summary" / "sales-details" wage custom renderers wenuwata — generic table eka nemei
  render?:
    | "sales-summary"
    | "sales-details"
    | "category-summary"
    | "category-detail"
    | "payment-summary"
    | "payment-grid"
    | "transaction-summary"
    | "steward-wise"
    | "tax-vat"
    | "void-report"
    | "pax-count"
    | "open-tables"
    | "trace"
    | "credit-summary"
    | "credit-history"
    | "credit-pay-history"
    | "credit-account-detail"
    | "hourly-sales"
    | "billtype"
    | "cashier-collection"
    | "cashier-breakdown"
    | "mii"
    | "mii-date"
    | "item-movement"
    | "cash-inout"
    | "kot-bot";
  filter?: ReportFilterSpec;
  // fixed bill type (9 Complimentary Cost = CM)
  lockBillType?: string;
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
    subtitle: "Daily transaction performance (POS Vw_DailyPerformance)",
    render: "transaction-summary",
    fetchAction: getTransactionSummaryAction,
    columns: [],
  },
  "sales-summary": {
    id: "sales-summary",
    title: "Sales Summary",
    subtitle: "Bill-wise daily collection (grouped by date)",
    render: "sales-summary", // custom renderer — generic table eka nisa
    fetchAction: getSalesSummaryAction,
    columns: [], // custom render eka nisa columns onepa
  },
  "sales-details": {
    id: "sales-details",
    title: "Sales Details",
    subtitle: "Bill-wise item details with totals (grouped by location & date)",
    render: "sales-details", // custom renderer — generic table eka nisa
    fetchAction: getSalesDetailsAction,
    columns: [],
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
  // 1.3.1 — POS "Sales By Category – Summery" (Sp_SalesCategory)
  "sales-category-summary": {
    id: "sales-category-summary",
    title: "Sales By Category – Summery",
    subtitle: "Category-wise sales totals (grouped by location)",
    render: "category-summary",
    fetchAction: getCategorySummaryAction,
    columns: [],
  },
  // 1.3.2 — POS "Sales By Category – Detail" (Vw_CatSales)
  "sales-category-detail": {
    id: "sales-category-detail",
    title: "Sales By Category – Detail",
    subtitle: "Bill-wise category sales details (grouped by location)",
    render: "category-detail",
    fetchAction: getCategoryDetailAction,
    columns: [],
  },
  // 2.1 — POS "Payment Mode – Payment Summary" (Vw_SalesPayModes)
  "payment-summary": {
    id: "payment-summary",
    title: "Payment Mode – Payment Summary",
    subtitle: "Bill-wise payment collections (grouped by location & date)",
    render: "payment-summary",
    fetchAction: getPaymentSummaryAction,
    columns: [],
  },
  // 2.2 — POS "Payment Collection – Mode Wise" (PayCode filter)
  "payment-summary-wise": {
    id: "payment-summary-wise",
    title: "Payment Collection – Mode Wise",
    subtitle: "Payment summary filtered by payment mode",
    render: "payment-summary",
    fetchAction: getPaymentSummaryAction,
    columns: [],
    filter: {
      type: "pay-mode",
      param: "pm",
      label: "Pay Mode",
      options: [
        { value: "001", label: "CASH" },
        { value: "002", label: "MASTER CARD" },
        { value: "003", label: "VISA CARD" },
        { value: "004", label: "ANEX" },
        { value: "005", label: "CREDIT" },
      ],
    },
  },
  // 6.1 — Table Management - Steward Wise
  "steward-wise": {
    id: "steward-wise",
    title: "Steward Wise",
    subtitle: "Steward-wise daily collections (grouped by steward & location)",
    render: "steward-wise",
    fetchAction: getStewardWiseAction,
    columns: [],
  },
  // 8.1 — Taxes & Service Charge - Service Charge Report
  "service-charge": {
    id: "service-charge",
    title: "Service Charge Report",
    subtitle: "Steward-wise service charge collections (POS 8.1)",
    render: "steward-wise",
    fetchAction: getServiceChargeAction,
    columns: [],
  },
  // 8.2 — Taxes & Service Charge - Tax & VAT Report
  "tax-vat": {
    id: "tax-vat",
    title: "Taxes And VAT Report",
    subtitle: "Bill-wise VAT / TDL / packing breakdown (POS 8.2)",
    render: "tax-vat",
    fetchAction: getTaxVatAction,
    columns: [],
  },
  // 9 — Complimentary Cost (Vw_SalesDetail, BillType = 'CM')
  "complimentary-cost": {
    id: "complimentary-cost",
    title: "Complimentary Cost Report",
    subtitle: "CM bill item details (grouped by location & bill)",
    render: "sales-details",
    fetchAction: getSalesDetailsAction,
    lockBillType: "CM",
    columns: [],
  },
  // 12 — Cash In/Out Report (VW_CASHINOUTREPORT)
  "cash-inout": {
    id: "cash-inout",
    title: "Cash In/Out Report",
    subtitle: "Cash in/out transactions with categories (POS 12)",
    render: "cash-inout",
    fetchAction: getCashInOutAction,
    columns: [],
  },
  // 5.1 — Item Movement (Vw_SalesDetail / Sp_ItemMovementNon)
  "item-movement": {
    id: "item-movement",
    title: "Item Movement",
    subtitle: "Fast / slow / non moving items (POS 5.1)",
    render: "item-movement",
    fetchAction: getItemMovementAction,
    columns: [],
  },
  // 4.1 — Menu Item Issue - Item Issue (Vw_MenuIssue, dept wise)
  "menu-item-issue": {
    id: "menu-item-issue",
    title: "Menu Item Issue - Item Issue",
    subtitle: "Sales department wise issued items (POS 4.1)",
    render: "mii",
    fetchAction: getMenuIssueAction,
    columns: [],
  },
  // 4.2 — Menu Item Issue By Date
  "menu-item-issue-date": {
    id: "menu-item-issue-date",
    title: "Menu Item Issue By Date",
    subtitle: "Issued items sectioned by date (POS 4.2)",
    render: "mii-date",
    fetchAction: getMenuIssueAction,
    columns: [],
  },
  // 2.4 — Payment - Bill Type Wise (VW_SalesSummery group by BILLTYPE)
  "payment-billtype": {
    id: "payment-billtype",
    title: "Payment - Bill Type Wise",
    subtitle: "Collections grouped by bill type (POS 2.4)",
    render: "billtype",
    fetchAction: getBillTypePaymentAction,
    columns: [],
  },
  // 3.1 — Cashier Collection - Cashier Wise Sales
  "cashier-collection": {
    id: "cashier-collection",
    title: "Cashier Wise Sales",
    subtitle: "Per-cashier bill collections, ordered by date (POS 3.1)",
    render: "cashier-collection",
    fetchAction: getCashierCollectionAction,
    columns: [],
  },
  // 3.2 — Cashier Collection - Payment Break Down
  "cashier-payment-breakdown": {
    id: "cashier-payment-breakdown",
    title: "Payment Break Down",
    subtitle: "Cashier-wise payment mode breakdown (POS 3.2)",
    render: "cashier-breakdown",
    fetchAction: getCashierBreakdownAction,
    columns: [],
  },
  // 1.5 — Hourly Sales (Vw_HourlySales, fallback VW_SalesSummery)
  "hourly-sales": {
    id: "hourly-sales",
    title: "Hourly Sales",
    subtitle: "Sales value & bills per hour of day (POS 1.5)",
    render: "hourly-sales",
    fetchAction: getHourlySalesAction,
    columns: [],
  },
  // 21.1 — Credit Settlement - Current Credit Summary (Vw_CreditCustomer)
  "credit-summary": {
    id: "credit-summary",
    title: "Current Credit Summery",
    subtitle: "Customer outstanding credit balances (POS 21.1)",
    render: "credit-summary",
    fetchAction: getCreditSummaryAction,
    columns: [],
  },
  // 21.2 — Credit Settlement - Credit History (Vw_CreditHistory)
  "credit-history": {
    id: "credit-history",
    title: "Credit History",
    subtitle: "Customer credit transactions — search to pick a customer (POS 21.2)",
    render: "credit-history",
    fetchAction: getCreditHistoryAction,
    columns: [],
  },
  // 21.3 — Credit Settlement - Payment History (Vw_creditPaymemtHistory)
  "credit-pay-history": {
    id: "credit-pay-history",
    title: "Credit Payment History",
    subtitle: "Customer payments vs invoices with balances (POS 21.3)",
    render: "credit-pay-history",
    fetchAction: getCreditPayHistoryAction,
    columns: [],
  },
  // 21.4 — Credit Settlement – Account Detail (Vw_Credit_SettelementHistory_Details)
  "credit-account-detail": {
    id: "credit-account-detail",
    title: "Credit Account Detail",
    subtitle: "Customer account trace — INV / PAY / CHG movements (POS 21.4)",
    render: "credit-account-detail",
    fetchAction: getCreditAccountDetailAction,
    columns: [],
  },
  // 14 — Open (On-Going) Tables (Vw_HoldUps)
  "open-tables": {
    id: "open-tables",
    title: "Open (On-Going) Tables",
    subtitle: "Currently held tables with item details (POS 14)",
    render: "open-tables",
    fetchAction: getOpenTablesAction,
    columns: [],
  },
  // 15.1 — Tracing - Slip Trace (Vw_SlipPrintDetails)
  "slip-trace": {
    id: "slip-trace",
    title: "Slip Trace",
    subtitle: "Slip print trace by bill & birth no (POS 15.1)",
    render: "trace",
    fetchAction: getSlipTraceAction,
    columns: [],
  },
  // 15.2 — Tracing - Invoice Trace (Vw_SlipPrintDetails + BillNo)
  "invoice-trace": {
    id: "invoice-trace",
    title: "Invoice Trace",
    subtitle: "Trace one invoice — type the invoice no in search (POS 15.2)",
    render: "trace",
    fetchAction: getSlipTraceAction,
    columns: [],
  },
  // 10 — Void Summery and Detail (Vw_VoidItemSettlement)
  "void-report": {
    id: "void-report",
    title: "Void Summery and Detail",
    subtitle: "Voided items by cashier with sub totals (POS 10)",
    render: "void-report",
    fetchAction: getVoidReportAction,
    columns: [],
  },
  // 11 — Pax Count (Vw_PaxCount)
  "pax-count": {
    id: "pax-count",
    title: "Pax Count",
    subtitle: "Average pax per bill & spending per pax (POS 11)",
    render: "pax-count",
    fetchAction: getPaxCountAction,
    columns: [],
  },
  // 2.3 — POS "Bills By Pay Mode Wise" pivot grid (Vw_PayModes)
  "payment-bill-paymode-grid": {
    id: "payment-bill-paymode-grid",
    title: "Payment – Bill Pay Mode Wise Grid",
    subtitle: "Bill × pay mode pivot grid (grouped by location)",
    render: "payment-grid",
    fetchAction: getBillPayModeGridAction,
    columns: [],
  },
  // 3.3 — Cashier Collection – Payment Break Down – Grid (Sp_SalesPayment_casher)
  "cashier-breakdown-grid": {
    id: "cashier-breakdown-grid",
    title: "Payment Break Down – Grid",
    subtitle: "Bill × pay-mode grid per cashier (POS 3.3)",
    render: "payment-grid",
    fetchAction: getCashierBreakdownGridAction,
    columns: [],
  },
  // 16 — KOT/BOT Tracing (Vw_ItemSalesDetails)
  "kot-bot": {
    id: "kot-bot",
    title: "KOT/BOT Tracing",
    subtitle: "Trace KOT/BOT issues by server & order type (POS 16)",
    render: "kot-bot",
    fetchAction: getKotBotAction,
    columns: [],
  },
};
