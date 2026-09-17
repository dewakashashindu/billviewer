// ============================================================
// LOCATION: components/reports/reportCharts.ts
// Per-report chart builders. Every chart is computed from the
// SAME data object the table renders (no extra DB calls), and
// each report gets charts that match ITS columns — plus a
// location-wise breakdown whenever locations exist.
// ============================================================
import type { SalesSummaryData } from "./SalesSummaryReport";
import type { SalesDetailsData } from "./SalesDetailsReport";
import type { CatSummaryData, CatDetailData } from "./CategoryReports";
import type { PaymentSummaryData } from "./PaymentReports";
import type { BillPayModeGridData } from "./PaymentGridReports";
import type { TxnSummaryData } from "./TransactionSummaryReport";
import type { StewardData } from "./StewardReports";
import type { TaxVatData } from "./TaxVatReport";
import type { VoidData } from "./VoidReport";
import type { PaxData } from "./PaxCountReport";
import type { OpenTablesData } from "./OpenTablesReport";
import type { TraceData } from "./TraceReport";
import type { CreditSummaryData } from "./CreditSummaryReport";
import type { CreditHistoryData } from "./CreditHistoryReport";
import type { HourlySalesData } from "./HourlySalesReport";
import type { BillTypeData, CcData, CbdData } from "./CashierReports";
import type { MiiData } from "./MenuItemIssueReports";
import type { ImvData } from "./ItemMovementReport";
import type { CioData } from "./CashInOutReport";
import type { KotData } from "./KotBotReport";
import type { CphData, CadData } from "./CreditSettlementReports";

export interface ChartPoint {
  label: string;
  values: number[];
}
export interface ChartModel {
  id: string;
  title: string;
  kind: "bars" | "pie" | "hbars";
  series: string[];
  points: ChartPoint[];
  unit: "currency" | "number";
}

const r2 = (n: number) => Math.round(n * 100) / 100;

const dateKey = (d: string): string => {
  const p = d.includes("-") ? d.split("-") : d.includes("/") ? d.split("/") : null;
  if (!p || p.length !== 3) return d;
  if (p[0].length === 4) return `${p[0]}-${p[1]}-${p[2]}`;
  return `${p[2]}-${p[1]}-${p[0]}`;
};
const byDateAsc = (a: ChartPoint, b: ChartPoint) =>
  dateKey(a.label).localeCompare(dateKey(b.label));

type Agg = Map<string, number[]>;
const bump = (m: Agg, label: string, series: number, v: number, size: number) => {
  let a = m.get(label);
  if (!a) {
    a = new Array(size).fill(0);
    m.set(label, a);
  }
  a[series] = r2(a[series] + v);
};
const toPoints = (m: Agg, sorted = true): ChartPoint[] => {
  const pts = Array.from(m.entries()).map(([label, values]) => ({ label, values }));
  return sorted ? pts.sort(byDateAsc) : pts.sort((a, b) => b.values[0] - a.values[0]);
};
const only = (c: ChartModel | null): ChartModel[] => (c && c.points.length > 0 ? [c] : []);

const bars = (
  id: string,
  title: string,
  series: string[],
  points: ChartPoint[],
  unit: ChartModel["unit"]
): ChartModel | null => (points.length > 0 ? { id, title, kind: "bars", series, points, unit } : null);
const pie = (
  id: string,
  title: string,
  points: ChartPoint[],
  unit: ChartModel["unit"]
): ChartModel | null => (points.length > 0 ? { id, title, kind: "pie", series: ["Total"], points, unit } : null);
const hbars = (
  id: string,
  title: string,
  points: ChartPoint[],
  unit: ChartModel["unit"]
): ChartModel | null =>
  points.length > 0 ? { id, title, kind: "hbars", series: ["Total"], points: points.slice(0, 10), unit } : null;

const locHbars = (
  id: string,
  title: string,
  locs: Array<{ name: string; value: number }>,
  unit: ChartModel["unit"]
): ChartModel | null =>
  hbars(
    id,
    title,
    locs
      .filter((l) => l.value !== 0)
      .sort((a, b) => b.value - a.value)
      .map((l) => ({ label: l.name, values: [l.value] })),
    unit
  );

// ── 7.1 Transaction Summary ──
function txnCharts(d: TxnSummaryData): ChartModel[] {
  const paxM: Agg = new Map();
  const spendM: Agg = new Map();
  const deptM: Agg = new Map();
  const locs: Array<{ name: string; value: number }> = [];
  for (const loc of d.locationGroups ?? []) {
    locs.push({ name: loc.locName || loc.locCode, value: loc.totals.salesVolume });
    for (const r of loc.rows ?? []) {
      bump(paxM, r.txnDate, 0, r.localPax, 3);
      bump(paxM, r.txnDate, 1, r.foreignPax, 3);
      bump(paxM, r.txnDate, 2, r.totalPax, 3);
      const a = spendM.get(r.txnDate) ?? [0, 0, 0];
      a[0] += r.spendingPerBill * r.bills; // volume
      a[1] += r.bills;
      a[2] += r.totalPax;
      spendM.set(r.txnDate, a);
      bump(deptM, r.txnDate, 0, r.foodSales, 4);
      bump(deptM, r.txnDate, 1, r.beverageSales, 4);
      bump(deptM, r.txnDate, 2, r.sugarSales, 4);
      bump(deptM, r.txnDate, 3, r.otherSales, 4);
    }
  }
  const spendPts: ChartPoint[] = Array.from(spendM.entries())
    .map(([label, a]) => ({
      label,
      values: [
        a[1] > 0 ? r2(a[0] / a[1]) : 0,
        a[2] > 0 ? r2(a[0] / a[2]) : 0,
        a[1] > 0 ? r2(a[2] / a[1]) : 0,
      ],
    }))
    .sort(byDateAsc);
  return [
    ...only(bars("txn-pax", "Pax Per Day — Local / Foreign / Total", ["Local Pax", "Foreign Pax", "Total Pax"], toPoints(paxM), "number")),
    ...only(bars("txn-spend", "Per-Day Spending / Bill · Spending / Pax · Avg Pax / Bill", ["Spending / Bill", "Spending / Pax", "Avg Pax / Bill"], spendPts, "number")),
    ...only(bars("txn-dept", "Department Sales Per Day", ["Food", "Beverage", "Sugar", "Other"], toPoints(deptM), "currency")),
    ...only(locHbars("txn-loc", "Location-wise Sales Volume", locs, "currency")),
  ];
}

// ── 1.1.x Sales Summary ──
function summaryCharts(d: SalesSummaryData): ChartModel[] {
  const dayM: Agg = new Map();
  const billsM: Agg = new Map();
  const modeM: Agg = new Map();
  const typeM: Agg = new Map();
  const locs: Array<{ name: string; value: number }> = [];
  for (const loc of d.locationGroups ?? []) {
    locs.push({ name: loc.locName || loc.locCode, value: loc.locTotal });
    for (const g of loc.dateGroups ?? []) {
      bump(dayM, g.date, 0, g.dayTotal, 1);
      bump(billsM, g.date, 0, (g.rows ?? []).length, 1);
      for (const r of g.rows ?? []) {
        bump(modeM, r.orderMode || "Other", 0, r.netTotal, 1);
        bump(typeM, r.billType || "Other", 0, r.netTotal, 1);
      }
    }
  }
  return [
    ...only(bars("sum-day", "Daily Collection", ["Net Total"], toPoints(dayM), "currency")),
    ...only(bars("sum-bills", "Bills Per Day", ["Bills"], toPoints(billsM), "number")),
    ...only(pie("sum-mode", "Order Mode Split", toPoints(modeM, false), "currency")),
    ...only(pie("sum-type", "Bill Type Split", toPoints(typeM, false), "currency")),
    ...only(locHbars("sum-loc", "Location-wise Collection", locs, "currency")),
  ];
}

// ── 1.2.x Sales Details (+ 9 Complimentary) ──
function detailsCharts(d: SalesDetailsData, cm: boolean): ChartModel[] {
  const dayM: Agg = new Map();
  const itemM: Agg = new Map();
  const locs: Array<{ name: string; value: number }> = [];
  for (const loc of d.locationGroups ?? []) {
    locs.push({ name: loc.locName || loc.locCode, value: loc.locNetTotal });
    for (const g of loc.dateGroups ?? []) {
      bump(dayM, g.date, 0, g.dayNetTotal, 1);
      for (const b of g.bills ?? [])
        for (const it of b.items ?? []) bump(itemM, it.name || "Unknown", 0, it.totItemPrice, 1);
    }
  }
  return [
    ...only(bars("det-day", cm ? "Daily Complimentary Value" : "Daily Net Total", ["Net Total"], toPoints(dayM), "currency")),
    ...only(hbars("det-items", cm ? "Top Complimentary Items" : "Top 10 Items", toPoints(itemM, false), "currency")),
    ...only(locHbars("det-loc", "Location-wise Net Total", locs, "currency")),
  ];
}

// ── 1.3.1 Category Summary ──
function catSummaryCharts(d: CatSummaryData): ChartModel[] {
  const catM: Agg = new Map();
  const locs: Array<{ name: string; value: number }> = [];
  for (const loc of d.locationGroups ?? []) {
    locs.push({ name: loc.locName || loc.locCode, value: loc.locTotal });
    for (const c of loc.cats ?? []) bump(catM, c.level1 || "UNKNOWN", 0, c.total, 1);
  }
  return [
    ...only(pie("cat-pie", "Category Share", toPoints(catM, false), "currency")),
    ...only(hbars("cat-top", "Top Categories", toPoints(catM, false), "currency")),
    ...only(locHbars("cat-loc", "Location-wise Sales", locs, "currency")),
  ];
}

// ── 1.3.2 Category Detail ──
function catDetailCharts(d: CatDetailData): ChartModel[] {
  const catM: Agg = new Map();
  const dayM: Agg = new Map();
  const locs: Array<{ name: string; value: number }> = [];
  for (const loc of d.locationGroups ?? []) {
    locs.push({ name: loc.locName || loc.locCode, value: loc.locTotal });
    for (const c of loc.cats ?? []) {
      bump(catM, c.level1 || "UNKNOWN", 0, c.total, 1);
      for (const s of c.subs ?? [])
        for (const r of s.rows ?? []) bump(dayM, r.txnDate, 0, r.saleTotal, 1);
    }
  }
  return [
    ...only(bars("catd-day", "Daily Category Sales", ["Total"], toPoints(dayM), "currency")),
    ...only(pie("catd-pie", "Category Share", toPoints(catM, false), "currency")),
    ...only(locHbars("catd-loc", "Location-wise Sales", locs, "currency")),
  ];
}

// ── 2.1 / 2.2 Payment ──
function paymentCharts(d: PaymentSummaryData): ChartModel[] {
  const modeM: Agg = new Map();
  const dayM: Agg = new Map();
  const locs: Array<{ name: string; value: number }> = [];
  for (const loc of d.locationGroups ?? []) {
    locs.push({ name: loc.locName || loc.locCode, value: loc.locTotal });
    for (const g of loc.dateGroups ?? []) {
      bump(dayM, g.date, 0, g.dailyTotal, 1);
      for (const b of g.bills ?? [])
        for (const p of b.payments ?? []) bump(modeM, p.desc || "Other", 0, p.amount, 1);
    }
  }
  return [
    ...only(pie("pay-pie", "Payment Mode Split", toPoints(modeM, false), "currency")),
    ...only(bars("pay-day", "Daily Collections", ["Total"], toPoints(dayM), "currency")),
    ...only(locHbars("pay-loc", "Location-wise Collections", locs, "currency")),
  ];
}

// ── 2.3 Bill Pay Mode Grid ──
function gridCharts(d: BillPayModeGridData): ChartModel[] {
  const modeM: Agg = new Map();
  const billM: Agg = new Map();
  const locs: Array<{ name: string; value: number }> = [];
  for (const loc of d.locationGroups ?? []) {
    locs.push({ name: loc.locName || loc.locCode, value: loc.locTotal });
    for (const [m, v] of Object.entries(loc.modeTotals ?? {})) bump(modeM, m, 0, v, 1);
    for (const b of loc.bills ?? []) bump(billM, b.billNo, 0, b.total, 1);
  }
  return [
    ...only(pie("grid-pie", "Pay Mode Totals", toPoints(modeM, false), "currency")),
    ...only(hbars("grid-bills", "Top 10 Bills", toPoints(billM, false), "currency")),
    ...only(locHbars("grid-loc", "Location-wise Totals", locs, "currency")),
  ];
}

// ── 6.1 / 8.1 Steward & Service Charge ──
function stewardCharts(d: StewardData, ser: boolean): ChartModel[] {
  const stewM: Agg = new Map();
  const dayM: Agg = new Map();
  const locM: Agg = new Map();
  for (const s of d.stewards ?? [])
    for (const l of s.locs ?? []) {
      bump(locM, l.locName || l.locCode, 0, ser ? l.totals.serChg : l.totals.grand, 1);
      for (const r of l.rows ?? []) {
        bump(dayM, r.date, 0, ser ? r.serChg : r.grand, 1);
      }
      bump(stewM, `${s.stewId} ${s.stewName}`.trim(), 0, ser ? s.stewTotals.serChg : s.stewTotals.grand, 1);
    }
  return [
    ...only(hbars("stw-h", ser ? "Steward-wise Service Charge" : "Steward-wise Sales", toPoints(stewM, false), "currency")),
    ...only(bars("stw-day", ser ? "Daily Service Charge" : "Daily Sales", ["Total"], toPoints(dayM), "currency")),
    ...only(hbars("stw-loc", "Location-wise", toPoints(locM, false), "currency")),
  ];
}

// ── 8.2 Tax & VAT ──
function taxCharts(d: TaxVatData): ChartModel[] {
  const dayM: Agg = new Map();
  const compM: Agg = new Map();
  const locs: Array<{ name: string; value: number }> = [];
  for (const loc of d.locationGroups ?? []) {
    locs.push({ name: loc.locName || loc.locCode, value: loc.totals.vatTdl });
    bump(compM, "VAT", 0, loc.totals.vat, 1);
    bump(compM, "TDL", 0, loc.totals.tdl, 1);
    bump(compM, "Other VAT", 0, loc.totals.otherVat, 1);
    bump(compM, "Packing", 0, loc.totals.packing, 1);
    for (const r of loc.rows ?? []) bump(dayM, r.date, 0, r.vatTdl, 1);
  }
  return [
    ...only(bars("tax-day", "VAT+TDL Per Day", ["VAT+TDL"], toPoints(dayM), "currency")),
    ...only(pie("tax-pie", "Tax Component Split", toPoints(compM, false), "currency")),
    ...only(locHbars("tax-loc", "Location-wise VAT+TDL", locs, "currency")),
  ];
}

// ── 10 Void ──
function voidCharts(d: VoidData): ChartModel[] {
  const cashM: Agg = new Map();
  const dayM: Agg = new Map();
  const locs: Array<{ name: string; value: number }> = [];
  for (const l of d.locationGroups ?? []) {
    locs.push({ name: l.locName || l.locCode, value: l.voidTotal });
    for (const c of l.cashiers ?? []) {
      bump(cashM, `${c.casherId} ${c.casherName}`.trim(), 0, c.subTotal, 1);
      for (const r of c.rows ?? []) bump(dayM, r.date, 0, r.value, 1);
    }
  }
  return [
    ...only(hbars("void-h", "Cashier-wise Voids", toPoints(cashM, false), "currency")),
    ...only(bars("void-day", "Daily Void Value", ["Total"], toPoints(dayM), "currency")),
    ...only(locHbars("void-loc", "Location-wise Voids", locs, "currency")),
  ];
}

// ── 11 Pax Count ──
function paxCharts(d: PaxData): ChartModel[] {
  const dayM: Agg = new Map();
  const spendM: Agg = new Map();
  const locs: Array<{ name: string; value: number }> = [];
  for (const l of d.locationGroups ?? []) {
    locs.push({ name: l.locName || l.locCode, value: l.totals.totalPax });
    for (const s of l.summary ?? []) {
      bump(dayM, s.date, 0, s.totalPax, 2);
      bump(dayM, s.date, 1, s.totalBills, 2);
    }
    for (const b of l.bills ?? []) bump(spendM, b.date, 0, b.avgSpending, 1);
  }
  return [
    ...only(bars("pax-day", "Total Pax vs Bills Per Day", ["Total Pax", "Total Bills"], toPoints(dayM), "number")),
    ...only(bars("pax-spend", "Average Spending On Pax Per Day", ["Avg Spending"], toPoints(spendM), "currency")),
    ...only(locHbars("pax-loc", "Location-wise Pax", locs, "number")),
  ];
}

// ── 14 Open Tables ──
function openCharts(d: OpenTablesData): ChartModel[] {
  const secM: Agg = new Map();
  const modeM: Agg = new Map();
  for (const s of d.sections ?? []) {
    bump(secM, `TABLE ${s.code}`, 0, s.amount, 1);
    for (const r of s.rows ?? []) bump(modeM, r.mode || "Other", 0, r.value, 1);
  }
  return [
    ...only(hbars("open-h", "Open Table Amounts", toPoints(secM, false), "currency")),
    ...only(pie("open-mode", "Order Mode Split (open)", toPoints(modeM, false), "currency")),
  ];
}

// ── 15.x Slip / Invoice Trace ──
function traceCharts(d: TraceData): ChartModel[] {
  const actM: Agg = new Map();
  const dayM: Agg = new Map();
  const locs: Array<{ name: string; value: number }> = [];
  for (const l of d.locationGroups ?? []) {
    locs.push({ name: l.locName || l.locCode, value: l.locTotal });
    for (const b of l.bills ?? [])
      for (const r of b.rows ?? []) {
        bump(actM, r.action || "Other", 0, r.amount, 1);
        bump(dayM, r.date, 0, r.amount, 1);
      }
  }
  return [
    ...only(pie("trc-pie", "Trace Action Split", toPoints(actM, false), "currency")),
    ...only(bars("trc-day", "Trace Value Per Day", ["Total"], toPoints(dayM), "currency")),
    ...only(locHbars("trc-loc", "Location-wise Trace", locs, "currency")),
  ];
}

// ── 21.1 Credit Summary ──
function credSumCharts(d: CreditSummaryData): ChartModel[] {
  const custM: Agg = new Map();
  const locs: Array<{ name: string; value: number }> = [];
  for (const l of d.locationGroups ?? []) {
    locs.push({ name: l.locName || l.locCode, value: l.locTotal });
    for (const c of l.customers ?? []) bump(custM, `${c.code} ${c.name}`, 0, c.total, 1);
  }
  return [
    ...only(hbars("cred-top", "Top Credit Customers", toPoints(custM, false), "currency")),
    ...only(locHbars("cred-loc", "Location-wise Outstanding Credit", locs, "currency")),
  ];
}

// ── 21.2 / 21.3 Credit & Payment History ──
function credHistCharts(d: CreditHistoryData): ChartModel[] {
  const dayM: Agg = new Map();
  const locs: Array<{ name: string; value: number }> = [];
  for (const l of d.locationGroups ?? []) {
    locs.push({ name: l.locName || l.locCode, value: l.locTotal });
    for (const c of l.customers ?? [])
      for (const r of c.rows ?? []) bump(dayM, r.date, 0, r.tranAmt, 1);
  }
  return [
    ...only(bars("cred-day", "Credit Transactions Per Day", ["Total"], toPoints(dayM), "currency")),
    ...only(locHbars("cred-loc", "Location-wise Credit Activity", locs, "currency")),
  ];
}

// ── 1.5 Hourly Sales ──
function hourlyCharts(d: HourlySalesData): ChartModel[] {
  const saleM: Agg = new Map();
  const billM: Agg = new Map();
  const locs: Array<{ name: string; value: number }> = [];
  for (const l of d.locationGroups ?? []) {
    locs.push({ name: l.locName || l.locCode, value: l.locTotal });
    for (const r of l.rows ?? []) {
      bump(saleM, r.label, 0, r.value, 1);
      bump(billM, r.label, 0, r.bills, 1);
    }
  }
  return [
    ...only(bars("hr-sales", "Sales Value by Hour", ["Sales"], toPoints(saleM), "currency")),
    ...only(bars("hr-bills", "Bills by Hour", ["Bills"], toPoints(billM), "number")),
    ...only(locHbars("hr-loc", "Location-wise Sales", locs, "currency")),
  ];
}

// ── 2.4 Bill Type Wise ──
function btCharts(d: BillTypeData): ChartModel[] {
  const typeM: Agg = new Map();
  const locs: Array<{ name: string; value: number }> = [];
  for (const l of d.locationGroups ?? []) {
    locs.push({ name: l.locName || l.locCode, value: l.locTotal });
    for (const r of l.rows ?? []) bump(typeM, r.type, 0, r.total, 1);
  }
  return [
    ...only(pie("bt-pie", "Collections by Bill Type", toPoints(typeM, false), "currency")),
    ...only(locHbars("bt-loc", "Location-wise Collections", locs, "currency")),
  ];
}

// ── 3.1 Cashier Collection ──
function ccCharts(d: CcData): ChartModel[] {
  const cashM: Agg = new Map();
  const dayM: Agg = new Map();
  const locs: Array<{ name: string; value: number }> = [];
  for (const l of d.locationGroups ?? []) {
    locs.push({ name: l.locName || l.locCode, value: l.locTotal });
    for (const c of l.cashiers ?? []) {
      bump(cashM, c.code, 0, c.total, 1);
      for (const b of c.bills ?? []) bump(dayM, b.dateTime.split(" ")[0] ?? "", 0, b.value, 1);
    }
  }
  return [
    ...only(hbars("cc-top", "Cashier Collections Ranking", toPoints(cashM, false), "currency")),
    ...only(bars("cc-day", "Collections Per Day", ["Total"], toPoints(dayM), "currency")),
    ...only(locHbars("cc-loc", "Location-wise Collections", locs, "currency")),
  ];
}

// ── 3.2 Payment Break Down ──
function cbdCharts(d: CbdData): ChartModel[] {
  const modeM: Agg = new Map();
  const locs: Array<{ name: string; value: number }> = [];
  for (const l of d.locationGroups ?? []) {
    locs.push({ name: l.locName || l.locCode, value: l.locTotal });
    for (const c of l.cashiers ?? [])
      for (const m of c.modes ?? []) bump(modeM, m.mode, 0, m.total, 1);
  }
  return [
    ...only(pie("cbd-pie", "Payment Mode Split", toPoints(modeM, false), "currency")),
    ...only(locHbars("cbd-loc", "Location-wise Payments", locs, "currency")),
  ];
}

// ── 4.x Menu Item Issue ──
function miiCharts(d: MiiData): ChartModel[] {
  const deptM: Agg = new Map();
  const itemM: Agg = new Map();
  const dayM: Agg = new Map();
  const locs: Array<{ name: string; value: number }> = [];
  for (const l of d.locationGroups ?? []) {
    locs.push({ name: l.locName || l.locCode, value: l.locTotal });
    for (const dt of l.dates ?? []) {
      bump(dayM, dt.date, 0, dt.total, 1);
      for (const dep of dt.depts ?? []) {
        bump(deptM, dep.dept, 0, dep.total, 1);
        for (const r of dep.rows ?? []) bump(itemM, `${r.code} ${r.desc}`, 0, r.total, 1);
      }
    }
  }
  return [
    ...only(pie("mii-dept", "Issue Value by Department", toPoints(deptM, false), "currency")),
    ...only(hbars("mii-top", "Top Issued Items", toPoints(itemM, false), "currency")),
    ...only(bars("mii-day", "Issue Value Per Day", ["Total"], toPoints(dayM), "currency")),
    ...only(locHbars("mii-loc", "Location-wise Issues", locs, "currency")),
  ];
}

// ── 5.1 Item Movement ──
function imvCharts(d: ImvData): ChartModel[] {
  if (d.mode === "non") return [];
  const itemM: Agg = new Map();
  const locs: Array<{ name: string; value: number }> = [];
  for (const l of d.locationGroups ?? []) {
    let lv = 0;
    for (const r of l.rows ?? []) {
      bump(itemM, `${r.code} ${r.desc}`, 0, r.qty, 1);
      lv += r.qty;
    }
    locs.push({ name: l.locName || l.locCode, value: Math.round(lv * 100) / 100 });
  }
  return [
    ...only(hbars("imv-top", d.mode === "fast" ? "Fastest Moving Items (qty)" : "Slowest Moving Items (qty)", toPoints(itemM, false), "number")),
    ...only(locHbars("imv-loc", "Location-wise Moved Qty", locs, "number")),
  ];
}

// ── 12 Cash In/Out ──
function cioCharts(d: CioData): ChartModel[] {
  const dayM: Agg = new Map();
  const catM: Agg = new Map();
  const locs: Array<{ name: string; value: number }> = [];
  for (const l of d.locationGroups ?? []) {
    locs.push({ name: l.locName || l.locCode, value: Math.round((l.locIn + l.locOut) * 100) / 100 });
    for (const dt of l.dates ?? []) {
      const cur = dayM.get(dt.date) || [0, 0];
      cur[0] = Math.round((cur[0] + dt.inTotal) * 100) / 100;
      cur[1] = Math.round((cur[1] + dt.outTotal) * 100) / 100;
      dayM.set(dt.date, cur);
      for (const r of dt.rows ?? []) bump(catM, r.category || "Other", 0, r.payIn + r.payOut, 1);
    }
  }
  const dayPts = Array.from(dayM.entries()).map(([label, values]) => ({ label, values }));
  return [
    ...only({ id: "cio-day", title: "Cash In / Out Per Day", kind: "bars", series: ["Pay In", "Pay Out"], points: dayPts, unit: "currency" }),
    ...only(hbars("cio-cat", "Category-wise Movement", toPoints(catM, false), "currency")),
    ...only(locHbars("cio-loc", "Location-wise Movement", locs, "currency")),
  ];
}

// ── 16 KOT/BOT Tracing ──
function kotCharts(d: KotData): ChartModel[] {
  const typM: Agg = new Map();
  const itemM: Agg = new Map();
  const hourM: Agg = new Map();
  const locs: Array<{ name: string; value: number }> = [];
  let hasTime = false;
  for (const l of d.locations ?? []) {
    locs.push({ name: l.locName || l.locCode, value: l.total });
    for (const s of l.servers ?? [])
      for (const t of s.types ?? []) {
        bump(typM, t.orderTyp, 0, t.count, 1);
        for (const r of t.rows ?? []) {
          bump(itemM, r.item || "Unknown", 0, r.qty, 1);
          const hm = String(r.issueTime || "").match(/^(\d{1,2}):/);
          if (hm) {
            hasTime = true;
            bump(hourM, `${String(Number(hm[1])).padStart(2, "0")}:00`, 0, 1, 1);
          }
        }
      }
  }
  const hourPts = Array.from(hourM.entries())
    .sort((x, y) => x[0].localeCompare(y[0]))
    .map(([label, values]) => ({ label, values }));
  return [
    ...only(hbars("kot-typ", "KOT vs BOT Issues", toPoints(typM, true), "number")),
    ...(hasTime ? only({ id: "kot-hour", title: "KOT/BOT Issues by Hour", kind: "bars", series: ["Issues"], points: hourPts, unit: "number" }) : []),
    ...only(hbars("kot-item", "Top Issued Items (qty)", toPoints(itemM, false).slice(0, 10), "number")),
    ...only(locHbars("kot-loc", "Location-wise Issues", locs, "number")),
  ];
}

// ── 21.3 Credit Payment History ──
function cphCharts(d: CphData): ChartModel[] {
  const dayM: Agg = new Map();
  const cusM: Agg = new Map();
  const locs: Array<{ name: string; value: number }> = [];
  for (const l of d.locationGroups ?? []) {
    let lv = 0;
    for (const c of l.customers ?? []) {
      bump(cusM, `${c.code} ${c.name}`, 0, c.totalPaid, 1);
      lv += c.totalPaid;
      for (const r of c.rows ?? []) if (r.paidDate) bump(dayM, r.paidDate, 0, r.paidAmt, 1);
    }
    locs.push({ name: l.locName || l.locCode, value: r2(lv) });
  }
  return [
    ...only(bars("cph-day", "Payments Received Per Day", ["Paid Amt"], toPoints(dayM).sort(byDateAsc), "currency")),
    ...only(hbars("cph-cus", "Customer-wise Payments", toPoints(cusM, false), "currency")),
    ...only(locHbars("cph-loc", "Location-wise Payments", locs, "currency")),
  ];
}

// ── 21.4 Credit Account Detail ──
function cadCharts(d: CadData): ChartModel[] {
  const typeM: Agg = new Map();
  const dayM: Agg = new Map();
  const cusM: Agg = new Map();
  const locs: Array<{ name: string; value: number }> = [];
  for (const l of d.locationGroups ?? []) {
    let lv = 0;
    for (const c of l.customers ?? []) {
      lv += c.lastBal;
      bump(cusM, `${c.code} ${c.name}`, 0, c.lastBal, 1);
      for (const r of c.rows ?? []) {
        bump(typeM, r.trnType || "OTHER", 0, r.trnAmt, 1);
        if (r.trnDate) bump(dayM, r.trnDate, 0, r.trnAmt, 1);
      }
    }
    locs.push({ name: l.locName || l.locCode, value: r2(lv) });
  }
  return [
    ...only(hbars("cad-type", "Transaction Amount by Type", toPoints(typeM, false), "currency")),
    ...only(bars("cad-day", "Transaction Amount Per Day", ["Trn Amt"], toPoints(dayM).sort(byDateAsc), "currency")),
    ...only(hbars("cad-cus", "Customer Outstanding Balance", toPoints(cusM, false), "currency")),
    ...only(locHbars("cad-loc", "Location-wise Balance", locs, "currency")),
  ];
}

// ── generic flat rows fallback ──
function rowsCharts(rows: Array<Record<string, unknown>>): ChartModel[] {
  const dayM: Agg = new Map();
  const locM: Agg = new Map();
  for (const r of rows ?? []) {
    const v = Number(r.salesVolume ?? r.totalSales ?? r.netTotal ?? r.total ?? 0);
    const dte = String(r.txnDate ?? r.date ?? "");
    if (dte) bump(dayM, dte, 0, v, 1);
    const lc = String(r.locName ?? r.location ?? "");
    if (lc) bump(locM, lc, 0, v, 1);
  }
  return [
    ...only(bars("gen-day", "Daily Total", ["Total"], toPoints(dayM), "currency")),
    ...only(hbars("gen-loc", "Location-wise", toPoints(locM, false), "currency")),
  ];
}

export function buildReportCharts(reportId: string, data: unknown): ChartModel[] {
  if (!data) return [];
  if (Array.isArray(data)) return rowsCharts(data);
  if (reportId.startsWith("sales-summary")) return summaryCharts(data as SalesSummaryData);
  if (reportId.startsWith("sales-details") || reportId === "complimentary-cost")
    return detailsCharts(data as SalesDetailsData, reportId === "complimentary-cost");
  if (reportId === "sales-category-summary") return catSummaryCharts(data as CatSummaryData);
  if (reportId === "sales-category-detail") return catDetailCharts(data as CatDetailData);
  if (reportId === "payment-summary" || reportId === "payment-summary-wise")
    return paymentCharts(data as PaymentSummaryData);
  if (reportId === "payment-bill-paymode-grid" || reportId === "cashier-breakdown-grid") return gridCharts(data as BillPayModeGridData);
  if (reportId === "transaction-summary") return txnCharts(data as TxnSummaryData);
  if (reportId === "steward-wise") return stewardCharts(data as StewardData, false);
  if (reportId === "service-charge") return stewardCharts(data as StewardData, true);
  if (reportId === "tax-vat") return taxCharts(data as TaxVatData);
  if (reportId === "void-report") return voidCharts(data as VoidData);
  if (reportId === "pax-count") return paxCharts(data as PaxData);
  if (reportId === "open-tables") return openCharts(data as OpenTablesData);
  if (reportId === "slip-trace" || reportId === "invoice-trace") return traceCharts(data as TraceData);
  if (reportId === "credit-summary") return credSumCharts(data as CreditSummaryData);
  if (reportId === "credit-history") return credHistCharts(data as CreditHistoryData);
  if (reportId === "credit-pay-history") return cphCharts(data as CphData);
  if (reportId === "credit-account-detail") return cadCharts(data as CadData);
  if (reportId === "hourly-sales") return hourlyCharts(data as HourlySalesData);
  if (reportId === "payment-billtype") return btCharts(data as BillTypeData);
  if (reportId === "cashier-collection") return ccCharts(data as CcData);
  if (reportId === "cashier-payment-breakdown") return cbdCharts(data as CbdData);
  if (reportId === "menu-item-issue" || reportId === "menu-item-issue-date") return miiCharts(data as MiiData);
  if (reportId === "item-movement") return imvCharts(data as ImvData);
  if (reportId === "cash-inout") return cioCharts(data as CioData);
  if (reportId === "kot-bot") return kotCharts(data as KotData);
  return [];
}
