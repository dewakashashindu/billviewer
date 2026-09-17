"use server";

// ============================================================
// Reports data — VW_SalesSummery view eken (mssql pool, lib/db.ts)
// View eka: Tbl_BillHeader + Tbl_LocationMaster + Tbl_UserDetails
// View name eka .env eken override: SALES_SUMMARY_VIEW
// ============================================================
import sql from "mssql";
import { getPool, isDbConfigured } from "@/lib/db";
import { requireSession, actionError } from "@/lib/actionAuth";

export interface ReportFilter {
  startDate: string;
  endDate: string;
  outletId?: number | string;
  /** Sales Summery – Order Mode Wise (DI/TA/DL/PU) */
  orderMode?: string;
  /** Sales Summery – Bill Type Wise (SD/CM/CO) */
  billType?: string;
  /** Payment Collection – Mode Wise (001/002/...) */
  payMode?: string;
  /** 4.x Menu Item Issue — "With Sale Cost" checkbox (WSC SP variant) */
  withCost?: boolean;
  /** 5.1 Item Movement — fast | slow | non */
  movement?: string;
  /** 5.1 Item Movement — Top N threshold */
  threshold?: number;
  /** 12 Cash In/Out — category filter (PAYCatID) */
  payCat?: string;
  /** 16 KOT/BOT Tracing — tracing type (all|kitchen|bar|other|bay1..bay7|head) */
  trcType?: string;
  /** 21.3/21.4 Credit Settlement — customer filter (CusID) */
  cusId?: string;
  /** 3.3 Cashier Breakdown Grid — cashier filter */
  cashier?: string;
}

const SUMMARY_VIEW = process.env.SALES_SUMMARY_VIEW || "VW_SalesSummery";

/**
 * POS eke "Sales Detail – All" report eka exclude karana bill types.
 * POS query eka:
 *   ... Where Txndate Between <from> And <to> And LocCode = <loc>
 *       AND BILLTYPE <> 'CM' And DoNotShowInSales <> '1'
 *
 * CM = Credit Memo — meka filter nokaloth Sales Details totals POS ekata
 * wada wadinawa. (POS eka NULL BillType rows danna ba — `<> 'CM'` eken
 * NULL → UNKNOWN wela row eka ath wenne. Methana ISNULL() ekata wrap karala
 * NULL rows (CM nemeyi nam) retain karanne — sales data ath wenna epa nisa.
 * POS ekata 100% samana semantics one nam ISNULL() eka ain karanna.)
 */
const EXCLUDED_BILL_TYPES = ["CM"];

/**
 * (POS eka `billtype` wage lowercase use karanawa, sys.columns eke
 *  `BillType` wage thiyenna puluwan — nisa case eka ignore karanawa.)
 */
function hasColumn(cols: Set<string>, name: string): boolean {
  const n = name.toLowerCase();
  for (const c of cols) if (c.toLowerCase() === n) return true;
  return false;
}

/**
 * POS report query wala shared WHERE filters:
 *   AND billtype <> 'CM'  AND DoNotShowInSales <> '1'
 *
 *
 *
 */
function buildPosFilters(opts: {
  cols: Set<string>;
  alias: string; // "" (no alias) | "v." | "h."
  billType?: string; // explicit Bill Type selection (overrides CM exclusion)
  orderMode?: string; // explicit Order Mode selection
}): { sql: string; bind: (req: sql.Request) => void } {
  const a = opts.alias;
  const parts: string[] = [];
  const binds: ((req: sql.Request) => void)[] = [];

  // ── Bill type ──
  if (hasColumn(opts.cols, "BillType")) {
    if (opts.billType != null && opts.billType !== "") {
      parts.push(`AND LTRIM(RTRIM(${a}BillType)) = @btSel`);
      const v = String(opts.billType);
      binds.push((r) => r.input("btSel", sql.VarChar(10), v));
    } else {
      parts.push(
        `AND ISNULL(LTRIM(RTRIM(${a}BillType)), '') NOT IN (${EXCLUDED_BILL_TYPES.map((_, i) => `@bt${i}`).join(", ")})`
      );
      binds.push((r) =>
        EXCLUDED_BILL_TYPES.forEach((t, i) =>
          r.input(`bt${i}`, sql.VarChar(10), t)
        )
      );
    }
  } else {
    console.warn(
      `[reports] '${a || ""}BillType' column not found in view — bill-type filter skipped`
    );
  }

  // ── Order mode ──
  if (opts.orderMode != null && opts.orderMode !== "") {
    if (hasColumn(opts.cols, "OrderMode")) {
      parts.push(`AND LTRIM(RTRIM(${a}OrderMode)) = @om`);
      const v = String(opts.orderMode);
      binds.push((r) => r.input("om", sql.VarChar(10), v));
    } else {
      console.warn(
        `[reports] '${a || ""}OrderMode' column not found in view — order-mode filter skipped`
      );
    }
  }

  // ── Cancelled bills ──
  if (hasColumn(opts.cols, "DoNotShowInSales")) {
    parts.push(`AND ISNULL(${a}DoNotShowInSales, 0) = 0`);
  } else {
    console.warn(
      `[reports] '${a || ""}DoNotShowInSales' column not found in view — cancelled-bill filter skipped`
    );
  }

  return { sql: parts.join("\n        "), bind: (r) => binds.forEach((b) => b(r)) };
}

/** View eke thiyena columns detect karanawa (LocalPax wage columns
 *  thiyenawada balanna — view versions wala adu wedi thiyenna puluwan) */
async function getViewColumns(
  pool: sql.ConnectionPool
): Promise<Set<string>> {
  const req = pool.request();
  req.input("viewName", sql.NVarChar(200), `dbo.${SUMMARY_VIEW}`);
  const res = await req.query(
    `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID(@viewName)`
  );
  return new Set(res.recordset.map((r: any) => String(r.name)));
}

export async function getTransactionSummaryAction(filters: ReportFilter) {
  try {
    await requireSession();
    if (!isDbConfigured()) {
      return { success: false, error: "Database not configured (DB_* env vars missing)" };
    }
    const { startDate, endDate, outletId } = filters;
    const pool = await getPool();

    // POS 7.1: Select * from Vw_DailyPerformance Where Txndate Between ...
    // Falls back to the sales summary view when Vw_DailyPerformance is absent.
    const DAILY_VIEW = process.env.DAILY_PERFORMANCE_VIEW || "Vw_DailyPerformance";
    let view = DAILY_VIEW;
    let cols = await viewColumnsGeneric(pool, view);
    if (cols.size === 0) {
      view = SUMMARY_VIEW;
      cols = await viewColumnsGeneric(pool, view);
    }
    if (cols.size === 0) {
      return {
        success: false,
        error: `View 'dbo.${DAILY_VIEW}' / 'dbo.${SUMMARY_VIEW}' not found in database`,
      };
    }

    const loc = pickCol(cols, ["LocCode", "Loc", "Location", "Outlet"]);
    const date = pickCol(cols, ["Txndate", "TXNdate", "TrnDate", "SalesDate", "BillDate"]);
    if (!loc || !date) {
      return {
        success: false,
        error: `Unable to map transaction view columns — missing: ${!loc ? "loc (LocCode) " : ""}${!date ? "date (Txndate)" : ""}. Actual view columns: ${Array.from(cols).join(", ")}`,
      };
    }
    const billsC = pickCol(cols, ["Bills", "BillCount", "NoBills", "NOBills"]);
    const localC = pickCol(cols, ["LocalPax", "NOPax"]);
    const foreignC = pickCol(cols, ["ForiegnPax", "ForeignPax"]);
    const foodC = pickCol(cols, ["FoodSales", "Food"]);
    const bevC = pickCol(cols, ["BeverageSales", "Beverage"]);
    const sugarC = pickCol(cols, ["SugarSales", "Sugar"]);
    const otherC = pickCol(cols, ["OtherSales", "Other"]);
    const suppC = pickCol(cols, ["SalesSupp", "SuppSales", "SalesSuppliments"]);
    const woeC = pickCol(cols, ["SalesWOE", "SalesWOExtra"]);
    const extraC = pickCol(cols, ["TotExtraInne", "TotExtraIncome", "ExtraIncome"]);
    const volC = pickCol(cols, ["SalesVolume", "NetTotal", "TotalSales"]);
    const secC = pickCol(cols, ["AvgSeconds", "AvgSec"]);
    const donot = pickCol(cols, ["DoNotShowInSales"]);

    const sum = (c: string | null) => (c ? `SUM(ISNULL(v.[${c}], 0))` : "0");

    const r = pool.request();
    r.input("startDate", sql.DateTime2, new Date(startDate));
    r.input("endDate", sql.DateTime2, new Date(`${endDate} 23:59:59`));
    if (outletId) r.input("outletId", sql.VarChar(20), String(outletId));

    const result = await r.query(`
      SELECT
        LTRIM(RTRIM(v.[${loc}])) AS LocCode,
        CONVERT(varchar(10), v.[${date}], 103) AS TxnDate,
        ${billsC ? `SUM(ISNULL(v.[${billsC}], 0))` : "COUNT(*)"} AS Bills,
        ${sum(localC)} AS LocalPax,
        ${sum(foreignC)} AS ForeignPax,
        ${sum(foodC)} AS FoodSales,
        ${sum(bevC)} AS BeverageSales,
        ${sum(sugarC)} AS SugarSales,
        ${sum(otherC)} AS OtherSales,
        ${sum(suppC)} AS SalesSupp,
        ${sum(woeC)} AS SalesWOE,
        ${sum(extraC)} AS TotExtra,
        ${sum(volC)} AS SalesVolume,
        ${secC ? `SUM(ISNULL(v.[${secC}], 0) * ${billsC ? `ISNULL(v.[${billsC}], 0)` : "1"})` : "0"} AS WeightSec
      FROM dbo.${view} v WITH (NOLOCK)
      WHERE v.[${date}] >= @startDate
        AND v.[${date}] < DATEADD(day, 1, @endDate)
        ${donot ? `AND ISNULL(v.[${donot}], 0) <> 1` : ""}
        ${outletId ? `AND LTRIM(RTRIM(v.[${loc}])) = @outletId` : ""}
      GROUP BY LTRIM(RTRIM(v.[${loc}])), CONVERT(varchar(10), v.[${date}], 103)
      ORDER BY LocCode, TxnDate
    `);

    const r2 = (n: number) => Math.round(n * 100) / 100;
    const fmtDur = (sec: number) => {
      const s = Math.max(0, Math.round(sec));
      const p = (n: number) => String(n).padStart(2, "0");
      return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
    };

    type Agg = {
      bills: number; localPax: number; foreignPax: number; food: number; bev: number;
      sugar: number; other: number; supp: number; woe: number; extra: number;
      vol: number; wsec: number;
    };
    const zero = (): Agg => ({ bills: 0, localPax: 0, foreignPax: 0, food: 0, bev: 0, sugar: 0, other: 0, supp: 0, woe: 0, extra: 0, vol: 0, wsec: 0 });
    const toRow = (txnDate: string, a: Agg) => {
      const totalPax = a.localPax + a.foreignPax;
      return {
        txnDate,
        bills: a.bills,
        localPax: a.localPax,
        foreignPax: a.foreignPax,
        totalPax,
        spendingPerBill: a.bills > 0 ? r2(a.vol / a.bills) : 0,
        spendingPerPax: totalPax > 0 ? r2(a.vol / totalPax) : 0,
        avgPaxPerBill: a.bills > 0 ? r2(totalPax / a.bills) : 0,
        avgTimePerBill: a.bills > 0 ? fmtDur(a.wsec / a.bills) : "00:00:00",
        foodSales: r2(a.food),
        beverageSales: r2(a.bev),
        sugarSales: r2(a.sugar),
        otherSales: r2(a.other),
        salesSupp: r2(a.supp),
        salesWOE: r2(a.woe),
        totExtraIncome: r2(a.extra),
        salesVolume: r2(a.vol),
      };
    };
    const addAgg = (a: Agg, row: { [k: string]: unknown }) => {
      a.bills += Number(row.Bills ?? 0);
      a.localPax += Number(row.LocalPax ?? 0);
      a.foreignPax += Number(row.ForeignPax ?? 0);
      a.food += Number(row.FoodSales ?? 0);
      a.bev += Number(row.BeverageSales ?? 0);
      a.sugar += Number(row.SugarSales ?? 0);
      a.other += Number(row.OtherSales ?? 0);
      a.supp += Number(row.SalesSupp ?? 0);
      a.woe += Number(row.SalesWOE ?? 0);
      a.extra += Number(row.TotExtra ?? 0);
      a.vol += Number(row.SalesVolume ?? 0);
      a.wsec += Number(row.WeightSec ?? 0);
    };

    const locMap = new Map<string, { locCode: string; locName: string; rows: ReturnType<typeof toRow>[]; agg: Agg }>();
    const grandAgg = zero();
    for (const row of result.recordset as Array<{ [k: string]: unknown }>) {
      const lc = String(row.LocCode ?? "");
      let L = locMap.get(lc);
      if (!L) {
        L = { locCode: lc, locName: lc, rows: [], agg: zero() };
        locMap.set(lc, L);
      }
      const a = zero();
      addAgg(a, row);
      addAgg(L.agg, row);
      addAgg(grandAgg, row);
      L.rows.push(toRow(String(row.TxnDate ?? ""), a));
    }

    const locationGroups = Array.from(locMap.values())
      .sort((a, b) => a.locCode.localeCompare(b.locCode))
      .map((L) => ({ locCode: L.locCode, locName: L.locName, rows: L.rows, totals: toRow("Total", L.agg) }));

    return {
      success: true,
      data: {
        locationGroups,
        grand: toRow("Total", grandAgg),
        billDuration: grandAgg.bills > 0 ? fmtDur(grandAgg.wsec / grandAgg.bills) : "00:00:00",
      },
    };
  } catch (error) {
    console.error("Report Action Error:", error);
    return actionError(error);
  }
}

// ============================================================
// Sales Summary (bill-wise) — POS "Sales Summery" PDF eka wage
// Bill-level rows VW_SalesSummery eken → date eken group wenawa
// ============================================================
export async function getSalesSummaryAction(filters: ReportFilter) {
  try {
    await requireSession();

    if (!isDbConfigured()) {
      return {
        success: false,
        error: "Database not configured (DB_* env vars missing)",
      };
    }

    const { startDate, endDate, outletId } = filters;
    const pool = await getPool();

    // View columns detect (TxnTime wage optional columns guard karanna)
    const req0 = pool.request();
    req0.input("viewName", sql.NVarChar(200), `dbo.${SUMMARY_VIEW}`);
    const colsRes = await req0.query(
      `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID(@viewName)`
    );
    const cols = new Set(colsRes.recordset.map((r) => String((r as { name: string }).name)));
    if (cols.size === 0) {
      return {
        success: false,
        error: `View 'dbo.${SUMMARY_VIEW}' not found in database`,
      };
    }

    // POS "Sales Summery – ALL / Order Mode Wise / Bill Type Wise" filters:
    //   AND DoNotShowInSales <> '1'
    const pf = buildPosFilters({
      cols,
      alias: "v.",
      orderMode: filters.orderMode,
      billType: filters.billType,
    });

    const req = pool.request();
    req.input("startDate", sql.DateTime2, new Date(startDate));
    req.input("endDate", sql.DateTime2, new Date(`${endDate} 23:59:59`));
    if (outletId) req.input("outletId", sql.VarChar(20), String(outletId));
    pf.bind(req);

    const txnTimeExpr = cols.has("TxnTime") ? "v.TxnTime" : "NULL";
    const billTypeExpr = cols.has("BillType") ? "LTRIM(RTRIM(v.BillType))" : "''";
    const orderModeExpr = cols.has("OrderMode") ? "LTRIM(RTRIM(v.OrderMode))" : "''";

    const result = await req.query(`
      SELECT
        LTRIM(RTRIM(v.LocCode)) AS LocCode,
        ISNULL(NULLIF(LTRIM(RTRIM(v.LocDes)), ''), LTRIM(RTRIM(v.LocCode))) AS LocDes,
        LTRIM(RTRIM(v.BillNo)) AS BillNo,
        v.Txndate,
        ${txnTimeExpr} AS TxnTimeVal,
        ISNULL(v.NetTotal, 0) AS NetTotal,
        ${billTypeExpr} AS BillType,
        ${orderModeExpr} AS OrderMode,
        ISNULL(NULLIF(LTRIM(RTRIM(su.UserName)), ''), LTRIM(RTRIM(v.StewID))) AS StewardName,
        ISNULL(NULLIF(LTRIM(RTRIM(cu.UserName)), ''), LTRIM(RTRIM(v.CasherID))) AS CasherName
      FROM dbo.${SUMMARY_VIEW} v WITH (NOLOCK)
      LEFT JOIN Tbl_UserDetails su WITH (NOLOCK)
        ON LTRIM(RTRIM(su.UserId)) = LTRIM(RTRIM(v.StewID))
      LEFT JOIN Tbl_UserDetails cu WITH (NOLOCK)
        ON LTRIM(RTRIM(cu.UserId)) = LTRIM(RTRIM(v.CasherID))
      WHERE v.Txndate >= @startDate
        AND v.Txndate < DATEADD(day, 1, @endDate)
        ${pf.sql}
        ${outletId ? "AND LTRIM(RTRIM(v.LocCode)) = @outletId" : ""}
      ORDER BY v.LocCode, v.Txndate, v.BillNo
    `);

    const BILL_TYPE_MAP: Record<string, string> = { SD: "Standered" };
    const ORDER_MODE_MAP: Record<string, string> = {
      DI: "Dining",
      TA: "TakeAway",
      DL: "Delivery",
      PU: "PickUp",
      OT: "Other",
    };

    const p2 = (n: number) => String(n).padStart(2, "0");
    const time12 = (d: Date): string => {
      let h = d.getHours();
      const ap = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `${h}:${p2(d.getMinutes())}:${p2(d.getSeconds())}${ap}`;
    };
    const dayStr = (d: Date) =>
      `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
    const isMidnight = (d: Date) =>
      d.getHours() + d.getMinutes() + d.getSeconds() === 0;
    const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

    // ── LOCATION-WISE grouping (POS PDF eka wage):
    const locMap = new Map<
      string,
      {
        locCode: string;
        locName: string;
        dateMap: Map<string, { rows: any[]; dayTotal: number }>;
        locTotal: number;
      }
    >();

    for (const row of result.recordset as any[]) {
      const locCode = String(row.LocCode ?? "").trim() || "-";
      const locName =
        String(row.LocDes ?? "").trim() ||
        String(row.LocCode ?? "").trim() ||
        locCode;

      if (!locMap.has(locCode)) {
        locMap.set(locCode, {
          locCode,
          locName,
          dateMap: new Map(),
          locTotal: 0,
        });
      }
      const loc = locMap.get(locCode)!;

      const txnd: Date =
        row.Txndate instanceof Date ? row.Txndate : new Date(row.Txndate);
      const key = dayStr(txnd);
      if (!loc.dateMap.has(key))
        loc.dateMap.set(key, { rows: [], dayTotal: 0 });
      const g = loc.dateMap.get(key)!;

      const t1 = row.TxnTimeVal instanceof Date ? row.TxnTimeVal : null;
      let timeStr = "";
      if (t1 && !isMidnight(t1)) timeStr = time12(t1);
      else if (!isMidnight(txnd)) timeStr = time12(txnd);

      const bt = String(row.BillType ?? "").trim();
      const om = String(row.OrderMode ?? "").trim();

      g.rows.push({
        billNo: String(row.BillNo ?? "").trim(),
        netTotal: r2(row.NetTotal ?? 0),
        steward: String(row.StewardName ?? "").trim(),
        billType: BILL_TYPE_MAP[bt] ?? bt,
        orderMode: ORDER_MODE_MAP[om] ?? om,
        txnTime: timeStr,
        casher: String(row.CasherName ?? "").trim(),
      });
      g.dayTotal = r2(g.dayTotal + (row.NetTotal ?? 0));
      loc.locTotal = r2(loc.locTotal + (row.NetTotal ?? 0));
    }

    const locationGroups = Array.from(locMap.values())
      .sort((a, b) => a.locCode.localeCompare(b.locCode))
      .map((loc) => ({
        locCode: loc.locCode,
        locName: loc.locName,
        locTotal: loc.locTotal,
        dateGroups: Array.from(loc.dateMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, g]) => ({ date, ...g })),
      }));

    const grandTotal = r2(
      locationGroups.reduce((s, l) => s + l.locTotal, 0)
    );

    return { success: true, data: { locationGroups, grandTotal } };
  } catch (error) {
    console.error("Sales Summary Action Error:", error);
    return actionError(error);
  }
}

// ============================================================
// Sales Details (bill-wise ITEM details) — POS "Sales Details"
// PDF eka wage. Source: Tbl_BillDetails (items) JOIN
// Tbl_BillHeader (bill meta + totals) + masters.
// Shape:
//   { dateGroups: [{ date, bills: [{ billNo, billType, userName,
//       steward, noPax, tableNo, orderMode, items: [{ name, qty,
//       salesPrice, totItemPrice }], totals: {...} }], dayNetTotal }] }
// ============================================================
export async function getSalesDetailsAction(filters: ReportFilter) {
  try {
    await requireSession();

    if (!isDbConfigured()) {
      return {
        success: false,
        error: "Database not configured (DB_* env vars missing)",
      };
    }

    const { startDate, endDate, outletId } = filters;
    const pool = await getPool();

    // Tbl_BillHeader eke me columns okkoma thiyenawa (meke view ekak nemei) —
    // nisa fixed set ekak. POS "Sales Detail – All / Bill Type / Order Mode" filters.
    const pf = buildPosFilters({
      cols: new Set(["BillType", "DoNotShowInSales", "OrderMode"]),
      alias: "h.",
      billType: filters.billType, // SD/CM/CO for Bill Type Wise
      orderMode: filters.orderMode, // DI/TA/DL/PU for Order Mode Wise
    });

    const req = pool.request();
    req.input("startDate", sql.VarChar(10), startDate);
    req.input("endDate", sql.VarChar(10), endDate);
    if (outletId)
      req.input("outletId", sql.VarChar(20), String(outletId));
    pf.bind(req);

    const result = await req.query(`
      SET NOCOUNT ON;

      SELECT
        CONVERT(varchar(12), h.Txndate, 103)            AS BillDate,
        LTRIM(RTRIM(h.BillNo))                          AS BillNo,
        h.BillType                                      AS BillTypeRaw,
        ISNULL(NULLIF(LTRIM(RTRIM(cu.UserName)), ''), LTRIM(RTRIM(h.CasherID))) AS UserName,
        ISNULL(NULLIF(LTRIM(RTRIM(su.UserName)), ''), LTRIM(RTRIM(h.StewID)))   AS Steward,
        h.NOPax                                         AS NOPax,
        LTRIM(RTRIM(h.TableNo))                         AS TableNo,
        ISNULL(NULLIF(LTRIM(RTRIM(om.ModeDes)), ''), LTRIM(RTRIM(h.OrderMode))) AS OrderModeRaw,
        d.Qty                                           AS Qty,
        d.SalesPrice                                    AS SalesPrice,
        d.TotalItmPrice                                 AS TotItmPrice,
        ISNULL(
          NULLIF(LTRIM(RTRIM(m.MenuItmDes)), ''),
          ISNULL(NULLIF(LTRIM(RTRIM(m.PrintDes)), ''), LTRIM(RTRIM(d.SubItmId)))
        )                                               AS ItemName,
        h.Gross        AS Gross,
        h.DisPre       AS DisPre,
        h.DisVal       AS DisVal,
        h.GrossAfterDis AS GrossAfterDis,
        h.SerChg       AS SerChg,
        h.OtherSerChg  AS OtherSerChg,
        h.VAT          AS VAT,
        h.OtherVAT     AS OtherVAT,
        h.TDL          AS TDL,
        h.PackChg      AS PackChg,
        h.DelChg       AS DelChg,
        h.DeleveryAreaChg AS DelAreaChg,
        h.NetTotal        AS NetTotal,
        LTRIM(RTRIM(h.LocCode)) AS LocCodeRaw,
        ISNULL(NULLIF(LTRIM(RTRIM(lm.LocDes)), ''), LTRIM(RTRIM(h.LocCode))) AS LocDes
      FROM Tbl_BillDetails d WITH (NOLOCK)
      INNER JOIN Tbl_BillHeader h WITH (NOLOCK)
        ON LTRIM(RTRIM(h.BillNo)) = LTRIM(RTRIM(d.BillNo))
      LEFT JOIN Tbl_MenuItems m WITH (NOLOCK)
        ON LTRIM(RTRIM(m.MenuItmId)) = LTRIM(RTRIM(d.SubItmId))
      LEFT JOIN Tbl_UserDetails cu WITH (NOLOCK)
        ON LTRIM(RTRIM(cu.UserId)) = LTRIM(RTRIM(h.CasherID))
      LEFT JOIN Tbl_UserDetails su WITH (NOLOCK)
        ON LTRIM(RTRIM(su.UserId)) = LTRIM(RTRIM(h.StewID))
      LEFT JOIN Tbl_OrderModes om WITH (NOLOCK)
        ON LTRIM(RTRIM(om.ModeID)) = LTRIM(RTRIM(h.OrderMode))
      LEFT JOIN Tbl_LocationMaster lm WITH (NOLOCK)
        ON LTRIM(RTRIM(lm.LocCode)) = LTRIM(RTRIM(h.LocCode))
      WHERE h.Txndate >= @startDate
        AND h.Txndate < DATEADD(day, 1, @endDate)
        ${pf.sql}
        ${outletId ? "AND LTRIM(RTRIM(h.LocCode)) = @outletId" : ""}
      ORDER BY h.Txndate, h.BillNo, d.KOTBOTNO, d.SubItmId;
    `);

    const BILL_TYPE_MAP: Record<string, string> = { SD: "Standered" };
    const ORDER_MODE_MAP: Record<string, string> = {
      DI: "Dining",
      TA: "TakeAway",
      DL: "Delivery",
      PU: "PickUp",
      OT: "Other",
    };

    const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    const p2 = (n: number) => String(n).padStart(2, "0");
    const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);

    interface DetBill {
      billNo: string;
      billType: string;
      userName: string;
      steward: string;
      noPax: string;
      tableNo: string;
      orderMode: string;
      items: {
        name: string;
        qty: number;
        salesPrice: number;
        totItemPrice: number;
      }[];
      totals: {
        gross: number;
        discount: number;
        discountPre: number;
        grossAfterDis: number;
        serviceCharge: number;
        otherServiceCharge: number;
        vat: number;
        otherVat: number;
        tdl: number;
        packingCharge: number;
        deliveryCharge: number;
        netTotal: number;
      };
    }

    interface LocEntry {
      locCode: string;
      locName: string;
      locNetTotal: number;
      dateMap: Map<
        string,
        { bills: DetBill[]; billMap: Map<string, DetBill>; dayNetTotal: number }
      >;
    }
    const locMap = new Map<string, LocEntry>();

    for (const row of result.recordset as any[]) {
      const billDate = String(row.BillDate ?? "").trim();
      const billNo = String(row.BillNo ?? "").trim();
      const locCode = String(row.LocCodeRaw ?? "").trim() || "-";
      const locName = String(row.LocDes ?? "").trim() || locCode;

      if (!locMap.has(locCode)) {
        locMap.set(locCode, {
          locCode,
          locName,
          locNetTotal: 0,
          dateMap: new Map(),
        });
      }
      const loc = locMap.get(locCode)!;
      const dateMap = loc.dateMap;

      if (!dateMap.has(billDate)) {
        dateMap.set(billDate, {
          bills: [],
          billMap: new Map(),
          dayNetTotal: 0,
        });
      }
      const grp = dateMap.get(billDate)!;

      if (!grp.billMap.has(billNo)) {
        grp.billMap.set(billNo, {
          billNo,
          billType: BILL_TYPE_MAP[String(row.BillTypeRaw ?? "").trim()] ??
            String(row.BillTypeRaw ?? "").trim(),
          userName: String(row.UserName ?? "").trim(),
          steward: String(row.Steward ?? "").trim(),
          noPax: row.NOPax != null ? num(row.NOPax).toFixed(2) : "",
          tableNo: String(row.TableNo ?? "").trim(),
          orderMode: ORDER_MODE_MAP[String(row.OrderModeRaw ?? "").trim()] ??
            String(row.OrderModeRaw ?? "").trim(),
          items: [],
          totals: {
            gross: r2(num(row.Gross)),
            discount: r2(num(row.DisVal)),
            discountPre: r2(num(row.DisPre)),
            grossAfterDis: r2(num(row.GrossAfterDis)),
            serviceCharge: r2(num(row.SerChg)),
            otherServiceCharge: r2(num(row.OtherSerChg)),
            vat: r2(num(row.VAT)),
            otherVat: r2(num(row.OtherVAT)),
            tdl: r2(num(row.TDL)),
            packingCharge: r2(num(row.PackChg)),
            deliveryCharge: r2(num(row.DelChg) + num(row.DelAreaChg)),
            netTotal: r2(num(row.NetTotal)),
          },
        });
        grp.bills.push(grp.billMap.get(billNo)!);
        grp.dayNetTotal = r2(grp.dayNetTotal + num(row.NetTotal));
        loc.locNetTotal = r2(loc.locNetTotal + num(row.NetTotal));
      }

      const bill = grp.billMap.get(billNo)!;
      if (row.ItemName || row.Qty != null) {
        bill.items.push({
          name: String(row.ItemName ?? "").trim(),
          qty: r2(num(row.Qty)),
          salesPrice: r2(num(row.SalesPrice)),
          totItemPrice: r2(num(row.TotItmPrice)),
        });
      }
    }

    const locationGroups = Array.from(locMap.values())
      .sort((a, b) => a.locCode.localeCompare(b.locCode))
      .map((loc) => ({
        locCode: loc.locCode,
        locName: loc.locName,
        locNetTotal: loc.locNetTotal,
        dateGroups: Array.from(loc.dateMap.entries()).map(([date, g]) => ({
          date,
          bills: g.bills,
          dayNetTotal: g.dayNetTotal,
        })),
      }));

    const grandNetTotal = r2(
      locationGroups.reduce((s, l) => s + l.locNetTotal, 0)
    );

    return { success: true, data: { locationGroups, grandNetTotal } };
  } catch (error) {
    console.error("Sales Details Action Error:", error);
    return actionError(error);
  }
}

// ============================================================
// Locations — Tbl_LocationMaster (date-range popup eke dropdown eka)
// ============================================================
export async function getLocationsAction() {
  try {
    await requireSession();

    if (!isDbConfigured()) {
      return {
        success: false,
        error: "Database not configured (DB_* env vars missing)",
      };
    }
    const pool = await getPool();
    const res = await pool.request().query(`
      SELECT
        LTRIM(RTRIM(LocCode)) AS code,
        ISNULL(NULLIF(LTRIM(RTRIM(LocDes)), ''), LTRIM(RTRIM(LocCode))) AS name
      FROM Tbl_LocationMaster WITH (NOLOCK)
      ORDER BY LTRIM(RTRIM(LocCode));
    `);
    return { success: true, data: res.recordset as { code: string; name: string }[] };
  } catch (error) {
    console.error("Locations Action Error:", error);
    return actionError(error);
  }
}

// ============================================================
// ✅ 1.3.1 / 1.3.2 — Sales By Category (Summery + Detail)
// LIVE DB eke proof wuna: POS source eke column names
// ============================================================
const CATEGORY_VIEW = process.env.CATEGORY_SALES_VIEW || "Vw_CatSales";

function pickCol(cols: Set<string>, candidates: string[]): string | null {
  const lower = new Map<string, string>();
  for (const c of cols) lower.set(c.toLowerCase(), c);
  for (const cand of candidates) {
    const hit = lower.get(cand.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

interface CatCols {
  loc: string;
  locDes: string | null;
  date: string;
  l1: string;
  l2: string | null;
  l3: string | null;
  item: string;
  total: string;
  bill: string | null;
  mode: string | null;
  time: string | null;
  steward: string | null;
  billtype: string | null;
  donot: string | null;
}

const CAT_COL_SPEC: { field: keyof CatCols; required: boolean; candidates: string[] }[] = [
  { field: "loc", required: true, candidates: ["LocCode", "Loc", "Location", "Outlet"] },
  { field: "date", required: true, candidates: ["Txndate", "TrnDate", "SalesDate", "BillDate"] },
  { field: "l1", required: true, candidates: ["LEVEL1", "L1SES", "L1", "MainCategory", "Category", "Cat1"] },
  { field: "item", required: true, candidates: ["Menuitemnm", "MenuItemNm", "MenuItmDes", "ItemName", "MenuItem", "MenuItmId", "Item"] },
  { field: "total", required: true, candidates: ["SaleTotal", "SalesTotal", "itemPrice", "ItemPrice", "TotalSales", "SalesValue", "NetTotal", "Total", "Amount"] },
  { field: "locDes", required: false, candidates: ["LocDes", "LocName", "LocationName", "OutletName"] },
  { field: "l2", required: false, candidates: ["LEVEL2", "L2SES", "L2", "SubCategory", "Cat2"] },
  { field: "l3", required: false, candidates: ["LEVEL3", "L3SES", "L3", "Cat3"] },
  { field: "bill", required: false, candidates: ["BillNO", "BillNo", "Bill"] },
  { field: "mode", required: false, candidates: ["OrderMode", "Mode"] },
  { field: "time", required: false, candidates: ["TxnTime", "TrnTime"] },
  { field: "steward", required: false, candidates: ["Steward", "StewardName"] },
  { field: "billtype", required: false, candidates: ["BILLTYPE", "BillType"] },
  { field: "donot", required: false, candidates: ["DoNotShowInSales"] },
];

function resolveCatCols(
  cols: Set<string>
): { c: CatCols } | { missing: string[] } {
  const c = {} as Record<string, string | null>;
  const missing: string[] = [];
  for (const s of CAT_COL_SPEC) {
    const hit = pickCol(cols, s.candidates);
    if (hit) c[s.field] = hit;
    else if (s.required) missing.push(`${s.field} (${s.candidates.join("/")})`);
    else c[s.field] = null;
  }
  if (missing.length > 0) return { missing };
  return { c: c as unknown as CatCols };
}

async function viewColumns(pool: Awaited<ReturnType<typeof getPool>>) {
  return viewColumnsGeneric(pool, CATEGORY_VIEW);
}

async function viewColumnsGeneric(
  pool: Awaited<ReturnType<typeof getPool>>,
  view: string
) {
  const req0 = pool.request();
  req0.input("viewName", sql.NVarChar(200), `dbo.${view}`);
  const colsRes = await req0.query(
    `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID(@viewName)`
  );
  return new Set(colsRes.recordset.map((r) => String((r as { name: string }).name)));
}

// shared location→category→sub grouping
type CatRowIn = {
  LocCode: string;
  LocDes: string;
  L1: string;
  L2: string;
  L3: string;
  ItemName: string;
  SaleTotal: number;
  BillNo?: string;
  OrderMode?: string;
  TxnTime?: string;
  Steward?: string;
  BillDate?: string;
};
function groupCatRows(recordset: CatRowIn[], withRows: boolean) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  type Row = { billNo: string; item: string; saleTotal: number; orderMode: string; txnTime: string; steward: string; txnDate: string };
  type Sub = { level2: string; level3: string; total: number; items: { name: string; total: number }[]; rows: Row[] };
  type Cat = { level1: string; total: number; subs: Sub[] };
  const locMap = new Map<string, { locCode: string; locName: string; locTotal: number; cats: Map<string, Cat> }>();
  for (const row of recordset) {
    const lc = String(row.LocCode ?? "");
    let loc = locMap.get(lc);
    if (!loc) {
      loc = { locCode: lc, locName: String(row.LocDes ?? lc), locTotal: 0, cats: new Map() };
      locMap.set(lc, loc);
    }
    const l1 = String(row.L1 ?? "UNKNOWN");
    let cat = loc.cats.get(l1);
    if (!cat) {
      cat = { level1: l1, total: 0, subs: [] };
      loc.cats.set(l1, cat);
    }
    const l2 = String(row.L2 ?? "");
    const l3 = String(row.L3 ?? "");
    let sub = cat.subs.find((s) => s.level2 === l2 && s.level3 === l3);
    if (!sub) {
      sub = { level2: l2, level3: l3, total: 0, items: [], rows: [] };
      cat.subs.push(sub);
    }
    const v = r2(Number(row.SaleTotal ?? 0));
    if (withRows) {
      sub.rows.push({
        billNo: String(row.BillNo ?? ""),
        item: String(row.ItemName ?? ""),
        saleTotal: v,
        orderMode: String(row.OrderMode ?? ""),
        txnTime: String(row.TxnTime ?? ""),
        steward: String(row.Steward ?? ""),
        txnDate: String(row.BillDate ?? ""),
      });
    } else {
      sub.items.push({ name: String(row.ItemName ?? ""), total: v });
    }
    sub.total = r2(sub.total + v);
    cat.total = r2(cat.total + v);
    loc.locTotal = r2(loc.locTotal + v);
  }
  const locationGroups = Array.from(locMap.values())
    .sort((a, b) => a.locCode.localeCompare(b.locCode))
    .map((l) => ({
      locCode: l.locCode,
      locName: l.locName,
      locTotal: l.locTotal,
      cats: Array.from(l.cats.values()),
    }));
  return {
    locationGroups,
    grandTotal: r2(locationGroups.reduce((s, l) => s + l.locTotal, 0)),
  };
}

// ── 1.3.1 Summery ──
export async function getCategorySummaryAction(filters: ReportFilter) {
  try {
    await requireSession();
    if (!isDbConfigured()) {
      return { success: false, error: "Database not configured (DB_* env vars missing)" };
    }
    const { startDate, endDate, outletId } = filters;
    const pool = await getPool();
    const cols = await viewColumns(pool);
    if (cols.size === 0) {
      return { success: false, error: `View 'dbo.${CATEGORY_VIEW}' not found in database` };
    }
    const res = resolveCatCols(cols);
    if ("missing" in res) {
      return {
        success: false,
        error: `Unable to map category view columns — missing: ${res.missing.join(", ")}. Actual view columns: ${Array.from(cols).join(", ")}`,
      };
    }
    const c = res.c;
    const locExpr = `LTRIM(RTRIM(v.[${c.loc}]))`;
    const locDesExpr = c.locDes
      ? `ISNULL(NULLIF(LTRIM(RTRIM(v.[${c.locDes}])), ''), ${locExpr})`
      : locExpr;
    const l1Expr = `ISNULL(NULLIF(LTRIM(RTRIM(v.[${c.l1}])), ''), 'UNKNOWN')`;
    const l2Expr = c.l2 ? `ISNULL(LTRIM(RTRIM(v.[${c.l2}])), '')` : `''`;
    const l3Expr = c.l3 ? `ISNULL(LTRIM(RTRIM(v.[${c.l3}])), '')` : `''`;
    const itemExpr = `ISNULL(NULLIF(LTRIM(RTRIM(v.[${c.item}])), ''), 'UNKNOWN')`;

    const req = pool.request();
    req.input("startDate", sql.DateTime2, new Date(startDate));
    req.input("endDate", sql.DateTime2, new Date(`${endDate} 23:59:59`));
    if (outletId) req.input("outletId", sql.VarChar(20), String(outletId));

    const result = await req.query(`
      SELECT
        ${locExpr}      AS LocCode,
        ${locDesExpr}   AS LocDes,
        ${l1Expr}       AS L1,
        ${l2Expr}       AS L2,
        ${l3Expr}       AS L3,
        ${itemExpr}     AS ItemName,
        SUM(ISNULL(v.[${c.total}], 0)) AS SaleTotal
      FROM dbo.${CATEGORY_VIEW} v WITH (NOLOCK)
      WHERE v.[${c.date}] >= @startDate
        AND v.[${c.date}] < DATEADD(day, 1, @endDate)
        ${outletId ? `AND LTRIM(RTRIM(v.[${c.loc}])) = @outletId` : ""}
      GROUP BY ${locExpr}, ${locDesExpr}, ${l1Expr}, ${l2Expr}, ${l3Expr}, ${itemExpr}
      ORDER BY LocCode, L1, L2, L3, ItemName
    `);
    return { success: true, data: groupCatRows(result.recordset as CatRowIn[], false) };
  } catch (error) {
    console.error("Category Summary Action Error:", error);
    return actionError(error);
  }
}

// ── 1.3.2 Detail ──
export async function getCategoryDetailAction(filters: ReportFilter) {
  try {
    await requireSession();
    if (!isDbConfigured()) {
      return { success: false, error: "Database not configured (DB_* env vars missing)" };
    }
    const { startDate, endDate, outletId } = filters;
    const pool = await getPool();
    const cols = await viewColumns(pool);
    if (cols.size === 0) {
      return { success: false, error: `View 'dbo.${CATEGORY_VIEW}' not found in database` };
    }
    const res = resolveCatCols(cols);
    if ("missing" in res) {
      return {
        success: false,
        error: `Unable to map category view columns — missing: ${res.missing.join(", ")}. Actual view columns: ${Array.from(cols).join(", ")}`,
      };
    }
    const c = res.c;
    const locExpr = `LTRIM(RTRIM(v.[${c.loc}]))`;
    const locDesExpr = c.locDes
      ? `ISNULL(NULLIF(LTRIM(RTRIM(v.[${c.locDes}])), ''), ${locExpr})`
      : locExpr;
    const l1Expr = `ISNULL(NULLIF(LTRIM(RTRIM(v.[${c.l1}])), ''), 'UNKNOWN')`;
    const l2Expr = c.l2 ? `ISNULL(LTRIM(RTRIM(v.[${c.l2}])), '')` : `''`;
    const l3Expr = c.l3 ? `ISNULL(LTRIM(RTRIM(v.[${c.l3}])), '')` : `''`;
    const itemExpr = `ISNULL(NULLIF(LTRIM(RTRIM(v.[${c.item}])), ''), 'UNKNOWN')`;

    const p2 = (n: number) => String(n).padStart(2, "0");
    const time12 = (d: Date): string => {
      let h = d.getHours();
      const ap = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `${h}:${p2(d.getMinutes())}:${p2(d.getSeconds())} ${ap}`;
    };

    const req = pool.request();
    req.input("startDate", sql.DateTime2, new Date(startDate));
    req.input("endDate", sql.DateTime2, new Date(`${endDate} 23:59:59`));
    if (outletId) req.input("outletId", sql.VarChar(20), String(outletId));

    const result = await req.query(`
      SELECT
        ${locExpr}    AS LocCode,
        ${locDesExpr} AS LocDes,
        ${l1Expr}     AS L1,
        ${l2Expr}     AS L2,
        ${l3Expr}     AS L3,
        ${itemExpr}   AS ItemName,
        ISNULL(v.[${c.total}], 0) AS SaleTotal,
        ${c.bill ? `LTRIM(RTRIM(v.[${c.bill}]))` : `''`} AS BillNo,
        ${c.mode ? `LTRIM(RTRIM(v.[${c.mode}]))` : `''`} AS OrderMode,
        ${c.time ? `v.[${c.time}]` : `NULL`} AS TxnTimeRaw,
        ${c.steward ? `LTRIM(RTRIM(v.[${c.steward}]))` : `''`} AS Steward,
        CONVERT(varchar(10), v.[${c.date}], 103) AS BillDate
      FROM dbo.${CATEGORY_VIEW} v WITH (NOLOCK)
      WHERE v.[${c.date}] >= @startDate
        AND v.[${c.date}] < DATEADD(day, 1, @endDate)
        ${c.billtype ? `AND ISNULL(LTRIM(RTRIM(v.[${c.billtype}])), '') <> 'CM'` : ""}
        ${c.donot ? `AND ISNULL(v.[${c.donot}], 0) = 0` : ""}
        ${outletId ? `AND LTRIM(RTRIM(v.[${c.loc}])) = @outletId` : ""}
      ORDER BY L1, L2, L3, ItemName
    `);

    const rows = (result.recordset as Array<{ [k: string]: unknown }>).map((r) => {
      const str = (k: string) => String(r[k] ?? "");
      const t = r.TxnTimeRaw ? new Date(String(r.TxnTimeRaw)) : null;
      return {
        LocCode: str("LocCode"),
        LocDes: str("LocDes"),
        L1: str("L1"),
        L2: str("L2"),
        L3: str("L3"),
        ItemName: str("ItemName"),
        SaleTotal: Number(r.SaleTotal ?? 0),
        BillNo: str("BillNo"),
        OrderMode: str("OrderMode"),
        TxnTime: t && !isNaN(t.getTime()) ? time12(t) : "",
        Steward: str("Steward"),
        BillDate: str("BillDate"),
      } as CatRowIn;
    });
    return { success: true, data: groupCatRows(rows, true) };
  } catch (error) {
    console.error("Category Detail Action Error:", error);
    return actionError(error);
  }
}

// ============================================================
// ✅ 2.1 / 2.2 — Payment Mode – Payment Summary (+ Mode Wise)
// POS: Select * from Vw_SalesPayModes Where Txndate Between ...
//      And LocCode = ... AND DoNotShowInSales <> '1'
// ============================================================
const PAY_VIEW = process.env.PAYMENT_MODES_VIEW || "Vw_SalesPayModes";

export async function getPaymentSummaryAction(filters: ReportFilter) {
  try {
    await requireSession();
    if (!isDbConfigured()) {
      return { success: false, error: "Database not configured (DB_* env vars missing)" };
    }
    const { startDate, endDate, outletId, payMode } = filters;
    const pool = await getPool();
    const cols = await viewColumnsGeneric(pool, PAY_VIEW);
    if (cols.size === 0) {
      return { success: false, error: `View 'dbo.${PAY_VIEW}' not found in database` };
    }

    const loc = pickCol(cols, ["LocCode", "Loc", "Location", "Outlet"]);
    const date = pickCol(cols, ["Txndate", "TrnDate", "SalesDate", "BillDate"]);
    const bill = pickCol(cols, ["BillNo", "BillNO", "Bill"]);
    const payDes = pickCol(cols, ["PayDes", "PaymentDes", "PaymentDescription", "PayMode", "ModeDes", "PaymentMode", "Description"]);
    const amount = pickCol(cols, ["ActAmt", "Amount", "PayAmount", "PayValue", "TenderedAmt", "SaleTotal", "Total", "Value"]);
    const req: string[] = [];
    if (!loc) req.push("loc (LocCode)");
    if (!date) req.push("date (Txndate)");
    if (!bill) req.push("bill (BillNo)");
    if (!payDes) req.push("payDes (PayDes/PaymentDescription)");
    if (!amount) req.push("amount (Amount/PayAmount)");
    if (req.length > 0) {
      return {
        success: false,
        error: `Unable to map payment view columns — missing: ${req.join(", ")}. Actual view columns: ${Array.from(cols).join(", ")}`,
      };
    }
    const locDes = pickCol(cols, ["LocDes", "LocName", "LocationName"]);
    const payCode = pickCol(cols, ["PayCode", "PayModeCode", "ModeID", "PaymentCode"]);
    const remarks = pickCol(cols, ["Rmks", "Remarks", "Remark"]);
    const casher = pickCol(cols, ["UserName", "CasherName", "Casher", "CasherID"]);
    const donot = pickCol(cols, ["DoNotShowInSales"]);

    const r = pool.request();
    r.input("startDate", sql.DateTime2, new Date(startDate));
    r.input("endDate", sql.DateTime2, new Date(`${endDate} 23:59:59`));
    if (outletId) r.input("outletId", sql.VarChar(20), String(outletId));
    if (payMode && payCode) r.input("pm", sql.VarChar(10), String(payMode));

    const result = await r.query(`
      SELECT
        LTRIM(RTRIM(v.[${loc}])) AS LocCode,
        ${locDes ? `ISNULL(NULLIF(LTRIM(RTRIM(v.[${locDes}])), ''), LTRIM(RTRIM(v.[${loc}])))` : `LTRIM(RTRIM(v.[${loc}]))`} AS LocDes,
        CONVERT(varchar(10), v.[${date}], 103) AS BillDate,
        LTRIM(RTRIM(v.[${bill}])) AS BillNo,
        LTRIM(RTRIM(v.[${payDes}])) AS PayDes,
        ISNULL(v.[${amount}], 0) AS Amount,
        ${remarks ? `ISNULL(LTRIM(RTRIM(v.[${remarks}])), '')` : `''`} AS Remarks,
        ${casher ? `LTRIM(RTRIM(v.[${casher}]))` : `''`} AS Casher
      FROM dbo.${PAY_VIEW} v WITH (NOLOCK)
      WHERE v.[${date}] >= @startDate
        AND v.[${date}] < DATEADD(day, 1, @endDate)
        ${donot ? `AND ISNULL(v.[${donot}], 0) = 0` : ""}
        ${payMode && payCode ? `AND LTRIM(RTRIM(v.[${payCode}])) = @pm` : ""}
        ${outletId ? `AND LTRIM(RTRIM(v.[${loc}])) = @outletId` : ""}
      ORDER BY v.[${loc}], v.[${date}], BillNo
    `);

    const r2 = (n: number) => Math.round(n * 100) / 100;
    type Pay = { desc: string; amount: number };
    type Bl = { billNo: string; billTotal: number; payments: Pay[]; casher: string; remarks: string };
    type Dg = { date: string; dailyTotal: number; bills: Bl[] };
    const locMap = new Map<string, { locCode: string; locName: string; locTotal: number; dates: Map<string, Dg> }>();

    for (const row of result.recordset as Array<{ [k: string]: unknown }>) {
      const str = (k: string) => String(row[k] ?? "");
      const lc = str("LocCode");
      let L = locMap.get(lc);
      if (!L) {
        L = { locCode: lc, locName: str("LocDes"), locTotal: 0, dates: new Map() };
        locMap.set(lc, L);
      }
      const dKey = str("BillDate");
      let D = L.dates.get(dKey);
      if (!D) {
        D = { date: dKey, dailyTotal: 0, bills: [] };
        L.dates.set(dKey, D);
      }
      const bn = str("BillNo");
      let B = D.bills.find((b) => b.billNo === bn);
      if (!B) {
        B = { billNo: bn, billTotal: 0, payments: [], casher: str("Casher"), remarks: str("Remarks") };
        D.bills.push(B);
      }
      const amt = r2(Number(row.Amount ?? 0));
      B.payments.push({ desc: str("PayDes"), amount: amt });
      B.billTotal = r2(B.billTotal + amt);
      D.dailyTotal = r2(D.dailyTotal + amt);
      L.locTotal = r2(L.locTotal + amt);
    }

    const locationGroups = Array.from(locMap.values())
      .sort((a, b) => a.locCode.localeCompare(b.locCode))
      .map((L) => ({
        locCode: L.locCode,
        locName: L.locName,
        locTotal: L.locTotal,
        dateGroups: Array.from(L.dates.values()),
      }));

    return {
      success: true,
      data: {
        locationGroups,
        grandTotal: r2(locationGroups.reduce((s, l) => s + l.locTotal, 0)),
      },
    };
  } catch (error) {
    console.error("Payment Summary Action Error:", error);
    return actionError(error);
  }
}

// ============================================================
// 2.3 — Payment - Bill Pay Mode Wise Grid (POS: Vw_PayModes)
// POS: Select * from Vw_PayModes Where Txndate Between ...
//      And LocCode = ... and DoNotShowInSales <> '1'
//      Order by BillNo, PayCode
// Pivot: rows = bills, columns = pay modes, right col = bill
// total, bottom row = per-mode totals + grand total.
// Falls back to Vw_SalesPayModes when Vw_PayModes is absent.
// ============================================================
const GRID_VIEW = process.env.BILL_PAYMODE_GRID_VIEW || "Vw_PayModes";

export async function getBillPayModeGridAction(filters: ReportFilter) {
  try {
    await requireSession();
    if (!isDbConfigured()) {
      return { success: false, error: "Database not configured (DB_* env vars missing)" };
    }
    const { startDate, endDate, outletId } = filters;
    const pool = await getPool();

    const tryViews = GRID_VIEW === PAY_VIEW ? [GRID_VIEW] : [GRID_VIEW, PAY_VIEW];
    let view = "";
    let cols = new Set<string>();
    let mapErr = "";
    for (const cand of tryViews) {
      const c = await viewColumnsGeneric(pool, cand);
      if (c.size === 0) continue;
      const mapped =
        pickCol(c, ["LocCode", "Loc", "Location", "Outlet"]) &&
        pickCol(c, ["Txndate", "TrnDate", "SalesDate", "BillDate"]) &&
        pickCol(c, ["BillNo", "BillNO", "Bill"]) &&
        pickCol(c, ["PayDes", "PaymentDes", "PaymentDescription", "PayMode", "ModeDes", "PaymentMode", "Description"]) &&
        pickCol(c, ["ActAmt", "Amount", "PayAmount", "PayValue", "TenderedAmt", "SaleTotal", "Total", "Value"]);
      if (mapped) {
        view = cand;
        cols = c;
        break;
      }
      if (!mapErr) mapErr = `View 'dbo.${cand}' actual columns: ${Array.from(c).join(", ")}`;
    }
    if (!view) {
      return {
        success: false,
        error: `Unable to map payment view columns for '${GRID_VIEW}' / '${PAY_VIEW}'. ${mapErr}`,
      };
    }

    const loc = pickCol(cols, ["LocCode", "Loc", "Location", "Outlet"]);
    const date = pickCol(cols, ["Txndate", "TrnDate", "SalesDate", "BillDate"]);
    const bill = pickCol(cols, ["BillNo", "BillNO", "Bill"]);
    const payDes = pickCol(cols, ["PayDes", "PaymentDes", "PaymentDescription", "PayMode", "ModeDes", "PaymentMode", "Description"]);
    const amount = pickCol(cols, ["ActAmt", "Amount", "PayAmount", "PayValue", "TenderedAmt", "SaleTotal", "Total", "Value"]);
    const req: string[] = [];
    if (!loc) req.push("loc (LocCode)");
    if (!date) req.push("date (Txndate)");
    if (!bill) req.push("bill (BillNo)");
    if (!payDes) req.push("payDes (PayDes/PaymentDescription)");
    if (!amount) req.push("amount (Amount/PayAmount)");
    if (req.length > 0) {
      return {
        success: false,
        error: `Unable to map payment view columns — missing: ${req.join(", ")}. Actual view columns: ${Array.from(cols).join(", ")}`,
      };
    }
    const locDes = pickCol(cols, ["LocDes", "LocName", "LocationName"]);
    const payCode = pickCol(cols, ["PayCode", "PayModeCode", "ModeID", "PaymentCode"]);
    const donot = pickCol(cols, ["DoNotShowInSales"]);

    const r = pool.request();
    r.input("startDate", sql.DateTime2, new Date(startDate));
    r.input("endDate", sql.DateTime2, new Date(`${endDate} 23:59:59`));
    if (outletId) r.input("outletId", sql.VarChar(20), String(outletId));

    const result = await r.query(`
      SELECT
        LTRIM(RTRIM(v.[${loc}])) AS LocCode,
        ${locDes ? `ISNULL(NULLIF(LTRIM(RTRIM(v.[${locDes}])), ''), LTRIM(RTRIM(v.[${loc}])))` : `LTRIM(RTRIM(v.[${loc}]))`} AS LocDes,
        CONVERT(varchar(10), v.[${date}], 103) AS BillDate,
        LTRIM(RTRIM(v.[${bill}])) AS BillNo,
        ${payCode ? `LTRIM(RTRIM(v.[${payCode}]))` : `LTRIM(RTRIM(v.[${payDes}]))`} AS PayCode,
        LTRIM(RTRIM(v.[${payDes}])) AS PayDes,
        ISNULL(v.[${amount}], 0) AS Amount
      FROM dbo.${view} v WITH (NOLOCK)
      WHERE v.[${date}] >= @startDate
        AND v.[${date}] < DATEADD(day, 1, @endDate)
        ${donot ? `AND ISNULL(v.[${donot}], 0) <> 1` : ""}
        ${outletId ? `AND LTRIM(RTRIM(v.[${loc}])) = @outletId` : ""}
      ORDER BY v.[${loc}], v.[${bill}], ${payCode ? `v.[${payCode}]` : `v.[${payDes}]`}
    `);

    const r2 = (n: number) => Math.round(n * 100) / 100;
    type GB = { billNo: string; date: string; cells: Map<string, number>; total: number };
    const locMap = new Map<
      string,
      { locCode: string; locName: string; modes: Map<string, { code: string; total: number }>; bills: GB[]; locTotal: number }
    >();

    for (const row of result.recordset as Array<{ [k: string]: unknown }>) {
      const str = (k: string) => String(row[k] ?? "");
      const lc = str("LocCode");
      let L = locMap.get(lc);
      if (!L) {
        L = { locCode: lc, locName: str("LocDes"), modes: new Map(), bills: [], locTotal: 0 };
        locMap.set(lc, L);
      }
      const modeKey = str("PayDes") || str("PayCode");
      let B = L.bills.find((b) => b.billNo === str("BillNo"));
      if (!B) {
        B = { billNo: str("BillNo"), date: str("BillDate"), cells: new Map(), total: 0 };
        L.bills.push(B);
      }
      const amt = r2(Number(row.Amount ?? 0));
      B.cells.set(modeKey, r2((B.cells.get(modeKey) ?? 0) + amt));
      B.total = r2(B.total + amt);
      let M = L.modes.get(modeKey);
      if (!M) {
        M = { code: str("PayCode"), total: 0 };
        L.modes.set(modeKey, M);
      }
      M.total = r2(M.total + amt);
      L.locTotal = r2(L.locTotal + amt);
    }

    const locationGroups = Array.from(locMap.values())
      .sort((a, b) => a.locCode.localeCompare(b.locCode))
      .map((L) => {
        const payModes = Array.from(L.modes.entries())
          .sort((a, b) =>
            a[1].code === b[1].code ? a[0].localeCompare(b[0]) : a[1].code.localeCompare(b[1].code)
          )
          .map(([name]) => name);
        const modeTotals: Record<string, number> = {};
        for (const [name, m] of L.modes) modeTotals[name] = m.total;
        return {
          locCode: L.locCode,
          locName: L.locName,
          payModes,
          bills: L.bills.map((b) => ({
            billNo: b.billNo,
            date: b.date,
            cells: Object.fromEntries(b.cells),
            total: b.total,
          })),
          modeTotals,
          locTotal: L.locTotal,
        };
      });

    return {
      success: true,
      data: {
        locationGroups,
        grandTotal: r2(locationGroups.reduce((s, l) => s + l.locTotal, 0)),
      },
    };
  } catch (error) {
    console.error("Bill Pay Mode Grid Action Error:", error);
    return actionError(error);
  }
}

// ============================================================
// 6.1 Steward Wise + 8.1 Service Charge Report
// POS 8.1: Select * From VW_SalesSummery Where DoNotShowInSales
//   <> '1' And BillType <> 'CM' And ORDERMODE <> 'DI' And Txndate
//   Between ... And LocCode = ... Order By TenDate
//   (+ And StewID = '...' when a cashier is selected)
// Steward Wise = same steward grouping, sales filters only.
// ============================================================
async function stewardAggregate(filters: ReportFilter, serCharge: boolean) {
  const { startDate, endDate, outletId } = filters;
  const pool = await getPool();
  const cols = await viewColumnsGeneric(pool, SUMMARY_VIEW);
  if (cols.size === 0) {
    return { success: false, error: `View 'dbo.${SUMMARY_VIEW}' not found in database` };
  }
  const loc = pickCol(cols, ["LocCode", "Loc", "Location", "Outlet"]);
  const date = pickCol(cols, ["TenDate", "Txndate", "TrnDate", "SalesDate", "BillDate"]);
  const stewId = pickCol(cols, ["StewID", "StewardID", "Steward", "CasherID"]);
  if (!loc || !date || !stewId) {
    return {
      success: false,
      error: `Unable to map steward view columns — missing: ${[!loc ? "loc (LocCode)" : "", !date ? "date (TenDate/Txndate)" : "", !stewId ? "steward (StewID)" : ""].filter(Boolean).join(", ")}. Actual view columns: ${Array.from(cols).join(", ")}`,
    };
  }
  const stewName = pickCol(cols, ["StewardName", "Steward", "UserName", "CasherName", "StewName"]) || stewId;
  const locDes = pickCol(cols, ["LocDes", "LocName", "LocationName"]);
  const localC = pickCol(cols, ["LocalPax", "NOPax"]);
  const foreignC = pickCol(cols, ["ForiegnPax", "ForeignPax"]);
  const grandC = pickCol(cols, ["NetTotal", "TotalSales", "SaleTotal", "Total"]);
  const serC = pickCol(cols, ["SerChg", "ServiceCharge", "SerCharge"]);
  const omC = pickCol(cols, ["ORDERMODE", "OrderMode", "Mode"]);
  const btC = pickCol(cols, ["BILLTYPE", "BillType"]);
  const donot = pickCol(cols, ["DoNotShowInSales"]);

  const r = pool.request();
  r.input("startDate", sql.DateTime2, new Date(startDate));
  r.input("endDate", sql.DateTime2, new Date(`${endDate} 23:59:59`));
  if (outletId) r.input("outletId", sql.VarChar(20), String(outletId));

  const result = await r.query(`
    SELECT
      LTRIM(RTRIM(v.[${loc}])) AS LocCode,
      ${locDes ? `ISNULL(NULLIF(LTRIM(RTRIM(v.[${locDes}])), ''), LTRIM(RTRIM(v.[${loc}])))` : `LTRIM(RTRIM(v.[${loc}]))`} AS LocDes,
      LTRIM(RTRIM(v.[${stewId}])) AS StewId,
      LTRIM(RTRIM(v.[${stewName}])) AS StewName,
      CONVERT(varchar(10), v.[${date}], 103) AS TxnDate,
      COUNT(*) AS Bills,
      ${localC ? `SUM(ISNULL(v.[${localC}], 0))` : "0"} AS LocalPax,
      ${foreignC ? `SUM(ISNULL(v.[${foreignC}], 0))` : "0"} AS ForeignPax,
      ${grandC ? `SUM(ISNULL(v.[${grandC}], 0))` : "0"} AS Grand,
      ${serCharge && serC ? `SUM(ISNULL(v.[${serC}], 0))` : "0"} AS SerChg
    FROM dbo.${SUMMARY_VIEW} v WITH (NOLOCK)
    WHERE v.[${date}] >= @startDate
      AND v.[${date}] < DATEADD(day, 1, @endDate)
      ${donot ? `AND ISNULL(v.[${donot}], 0) <> 1` : ""}
      ${serCharge && btC ? `AND ISNULL(LTRIM(RTRIM(v.[${btC}])), '') <> 'CM'` : ""}
      ${serCharge && omC ? `AND ISNULL(LTRIM(RTRIM(v.[${omC}])), '') <> 'DI'` : ""}
      ${outletId ? `AND LTRIM(RTRIM(v.[${loc}])) = @outletId` : ""}
    GROUP BY LTRIM(RTRIM(v.[${loc}])), ${locDes ? `ISNULL(NULLIF(LTRIM(RTRIM(v.[${locDes}])), ''), LTRIM(RTRIM(v.[${loc}]))), ` : ""}LTRIM(RTRIM(v.[${stewId}])), LTRIM(RTRIM(v.[${stewName}])), CONVERT(varchar(10), v.[${date}], 103)
    ORDER BY StewId, LocCode, TxnDate
  `);

  const r2 = (n: number) => Math.round(n * 100) / 100;
  type Agg = { bills: number; pax: number; grand: number; serChg: number };
  const zero = (): Agg => ({ bills: 0, pax: 0, grand: 0, serChg: 0 });
  const stewMap = new Map<string, { stewId: string; stewName: string; locs: Map<string, { locCode: string; locName: string; rows: Array<{ date: string; bills: number; pax: number; grand: number; serChg: number }>; agg: Agg }>; agg: Agg }>();
  const grand = zero();
  for (const row of result.recordset as Array<{ [k: string]: unknown }>) {
    const sid = String(row.StewId ?? "");
    let S = stewMap.get(sid);
    if (!S) {
      S = { stewId: sid, stewName: String(row.StewName ?? ""), locs: new Map(), agg: zero() };
      stewMap.set(sid, S);
    }
    const lc = String(row.LocCode ?? "");
    let L = S.locs.get(lc);
    if (!L) {
      L = { locCode: lc, locName: String(row.LocDes ?? ""), rows: [], agg: zero() };
      S.locs.set(lc, L);
    }
    const bills = Number(row.Bills ?? 0);
    const pax = Number(row.LocalPax ?? 0) + Number(row.ForeignPax ?? 0);
    const g = r2(Number(row.Grand ?? 0));
    const sc = r2(Number(row.SerChg ?? 0));
    L.rows.push({ date: String(row.TxnDate ?? ""), bills, pax, grand: g, serChg: sc });
    L.agg.bills += bills; L.agg.pax += pax; L.agg.grand = r2(L.agg.grand + g); L.agg.serChg = r2(L.agg.serChg + sc);
    S.agg.bills += bills; S.agg.pax += pax; S.agg.grand = r2(S.agg.grand + g); S.agg.serChg = r2(S.agg.serChg + sc);
    grand.bills += bills; grand.pax += pax; grand.grand = r2(grand.grand + g); grand.serChg = r2(grand.serChg + sc);
  }
  const stewards = Array.from(stewMap.values())
    .sort((a, b) => a.stewId.localeCompare(b.stewId))
    .map((S) => ({
      stewId: S.stewId,
      stewName: S.stewName,
      locs: Array.from(S.locs.values()).sort((a, b) => a.locCode.localeCompare(b.locCode))
        .map((L) => ({ locCode: L.locCode, locName: L.locName, rows: L.rows, totals: L.agg })),
      stewTotals: S.agg,
    }));
  return {
    success: true,
    data: { includeSerChg: serCharge, stewards, grand },
  };
}

export async function getStewardWiseAction(filters: ReportFilter) {
  try {
    await requireSession();
    if (!isDbConfigured()) {
      return { success: false, error: "Database not configured (DB_* env vars missing)" };
    }
    return await stewardAggregate(filters, false);
  } catch (error) {
    console.error("Steward Wise Action Error:", error);
    return actionError(error);
  }
}

export async function getServiceChargeAction(filters: ReportFilter) {
  try {
    await requireSession();
    if (!isDbConfigured()) {
      return { success: false, error: "Database not configured (DB_* env vars missing)" };
    }
    return await stewardAggregate(filters, true);
  } catch (error) {
    console.error("Service Charge Action Error:", error);
    return actionError(error);
  }
}

// ============================================================
// 8.2 Taxes And Service Charge - Tax & VAT Report
// POS: Select * From VW_SalesSummery Where DoNotShowInSales <> '1'
//   and BillType <> 'CM' And Txndate Between ... And LocCode = ...
//   Order By TenDate, BILLNO
// ============================================================
export async function getTaxVatAction(filters: ReportFilter) {
  try {
    await requireSession();
    if (!isDbConfigured()) {
      return { success: false, error: "Database not configured (DB_* env vars missing)" };
    }
    const { startDate, endDate, outletId } = filters;
    const pool = await getPool();
    const cols = await viewColumnsGeneric(pool, SUMMARY_VIEW);
    if (cols.size === 0) {
      return { success: false, error: `View 'dbo.${SUMMARY_VIEW}' not found in database` };
    }
    const loc = pickCol(cols, ["LocCode", "Loc", "Location", "Outlet"]);
    const date = pickCol(cols, ["TenDate", "Txndate", "TrnDate", "SalesDate", "BillDate"]);
    const bill = pickCol(cols, ["BillNo", "BILLNO", "BillNO", "Bill"]);
    if (!loc || !date || !bill) {
      return {
        success: false,
        error: `Unable to map tax view columns — missing: ${[!loc ? "loc (LocCode)" : "", !date ? "date (TenDate/Txndate)" : "", !bill ? "bill (BillNo)" : ""].filter(Boolean).join(", ")}. Actual view columns: ${Array.from(cols).join(", ")}`,
      };
    }
    const locDes = pickCol(cols, ["LocDes", "LocName", "LocationName"]);
    const wotC = pickCol(cols, ["SalesWOTAX", "SalesWOT", "TaxableAmt"]);
    const vatC = pickCol(cols, ["VAT"]);
    const tdlC = pickCol(cols, ["TDL"]);
    const othC = pickCol(cols, ["OtherVAT"]);
    const pakC = pickCol(cols, ["PackChg", "Packing"]);
    const btC = pickCol(cols, ["BILLTYPE", "BillType"]);
    const donot = pickCol(cols, ["DoNotShowInSales"]);

    const sum = (c: string | null) => (c ? `SUM(ISNULL(v.[${c}], 0))` : "0");

    const r = pool.request();
    r.input("startDate", sql.DateTime2, new Date(startDate));
    r.input("endDate", sql.DateTime2, new Date(`${endDate} 23:59:59`));
    if (outletId) r.input("outletId", sql.VarChar(20), String(outletId));

    const result = await r.query(`
      SELECT
        LTRIM(RTRIM(v.[${loc}])) AS LocCode,
        ${locDes ? `ISNULL(NULLIF(LTRIM(RTRIM(v.[${locDes}])), ''), LTRIM(RTRIM(v.[${loc}])))` : `LTRIM(RTRIM(v.[${loc}]))`} AS LocDes,
        LTRIM(RTRIM(v.[${bill}])) AS BillNo,
        CONVERT(varchar(10), v.[${date}], 103) AS TxnDate,
        ${sum(wotC)} AS SalesWOT,
        ${sum(vatC)} AS VAT,
        ${sum(tdlC)} AS TDL,
        ${sum(othC)} AS OtherVAT,
        ${sum(pakC)} AS Packing
      FROM dbo.${SUMMARY_VIEW} v WITH (NOLOCK)
      WHERE v.[${date}] >= @startDate
        AND v.[${date}] < DATEADD(day, 1, @endDate)
        ${donot ? `AND ISNULL(v.[${donot}], 0) <> 1` : ""}
        ${btC ? `AND ISNULL(LTRIM(RTRIM(v.[${btC}])), '') <> 'CM'` : ""}
        ${outletId ? `AND LTRIM(RTRIM(v.[${loc}])) = @outletId` : ""}
      GROUP BY LTRIM(RTRIM(v.[${loc}])), ${locDes ? `ISNULL(NULLIF(LTRIM(RTRIM(v.[${locDes}])), ''), LTRIM(RTRIM(v.[${loc}]))), ` : ""}LTRIM(RTRIM(v.[${bill}])), CONVERT(varchar(10), v.[${date}], 103)
      ORDER BY LocCode, TxnDate, BillNo
    `);

    const r2 = (n: number) => Math.round(n * 100) / 100;
    type TAgg = { salesWOT: number; vat: number; tdl: number; otherVat: number; packing: number; vatTdl: number };
    const zero = (): TAgg => ({ salesWOT: 0, vat: 0, tdl: 0, otherVat: 0, packing: 0, vatTdl: 0 });
    const add = (a: TAgg, wot: number, vat: number, tdl: number, oth: number, pak: number) => {
      a.salesWOT = r2(a.salesWOT + wot);
      a.vat = r2(a.vat + vat);
      a.tdl = r2(a.tdl + tdl);
      a.otherVat = r2(a.otherVat + oth);
      a.packing = r2(a.packing + pak);
      a.vatTdl = r2(a.vatTdl + vat + tdl);
    };
    const locMap = new Map<string, { locCode: string; locName: string; rows: Array<{ billNo: string; date: string } & TAgg>; agg: TAgg }>();
    const grand = zero();
    for (const row of result.recordset as Array<{ [k: string]: unknown }>) {
      const lc = String(row.LocCode ?? "");
      let L = locMap.get(lc);
      if (!L) {
        L = { locCode: lc, locName: String(row.LocDes ?? ""), rows: [], agg: zero() };
        locMap.set(lc, L);
      }
      const wot = r2(Number(row.SalesWOT ?? 0));
      const vat = r2(Number(row.VAT ?? 0));
      const tdl = r2(Number(row.TDL ?? 0));
      const oth = r2(Number(row.OtherVAT ?? 0));
      const pak = r2(Number(row.Packing ?? 0));
      L.rows.push({ billNo: String(row.BillNo ?? ""), date: String(row.TxnDate ?? ""), salesWOT: wot, vat, tdl, otherVat: oth, packing: pak, vatTdl: r2(vat + tdl) });
      add(L.agg, wot, vat, tdl, oth, pak);
      add(grand, wot, vat, tdl, oth, pak);
    }
    const locationGroups = Array.from(locMap.values())
      .sort((a, b) => a.locCode.localeCompare(b.locCode))
      .map((L) => ({ locCode: L.locCode, locName: L.locName, rows: L.rows, totals: L.agg }));
    return { success: true, data: { locationGroups, grand } };
  } catch (error) {
    console.error("Tax VAT Action Error:", error);
    return actionError(error);
  }
}

// ============================================================
// 10 Void Summery and Detail (POS: Vw_VoidItemSettlement)
// POS: Select * from Vw_VoidItemSettlement Where LOCCODE = '...'
//   And Txndate Between ... ORDER BY TMACINEID, SafeTransactionID
// Web: location -> cashier -> voided item rows + sub/void totals.
// ============================================================
export async function getVoidReportAction(filters: ReportFilter) {
  try {
    await requireSession();
    if (!isDbConfigured()) {
      return { success: false, error: "Database not configured (DB_* env vars missing)" };
    }
    const { startDate, endDate, outletId } = filters;
    const pool = await getPool();
    const VOID_VIEW = process.env.VOID_ITEMS_VIEW || "Vw_VoidItemSettlement";
    const cols = await viewColumnsGeneric(pool, VOID_VIEW);
    if (cols.size === 0) {
      return { success: false, error: `View 'dbo.${VOID_VIEW}' not found in database` };
    }
    const loc = pickCol(cols, ["LOCCODE", "LocCode", "Loc", "Location", "Outlet"]);
    const date = pickCol(cols, ["Txndate", "TXNDATE", "TrnDate", "SalesDate"]);
    const item = pickCol(cols, ["MenuItmDes", "Menuitemnm", "MenuItemNm", "ItemName", "MenuItem"]);
    const value = pickCol(cols, ["Value", "SaleTotal", "Total", "Amount"]);
    if (!loc || !date || !item || !value) {
      return {
        success: false,
        error: `Unable to map void view columns — missing: ${[!loc ? "loc (LOCCODE)" : "", !date ? "date (Txndate)" : "", !item ? "item (MenuItmDes)" : "", !value ? "value (Value)" : ""].filter(Boolean).join(", ")}. Actual view columns: ${Array.from(cols).join(", ")}`,
      };
    }
    const locDes = pickCol(cols, ["LocDes", "LocName", "LocationName"]);
    const qty = pickCol(cols, ["Qty", "Quantity"]);
    const rate = pickCol(cols, ["Rate", "Price", "SalesPrice"]);
    const bill = pickCol(cols, ["BillNo", "BILLNO", "BillNO", "Bill"]);
    const casherId = pickCol(cols, ["CasherID", "CashierID", "Casher"]);
    const casherName = pickCol(cols, ["CasherName", "CashierName", "UserName"]);
    const time = pickCol(cols, ["TxnTime", "TrnTime"]);

    const r = pool.request();
    r.input("startDate", sql.DateTime2, new Date(startDate));
    r.input("endDate", sql.DateTime2, new Date(`${endDate} 23:59:59`));
    if (outletId) r.input("outletId", sql.VarChar(20), String(outletId));

    const result = await r.query(`
      SELECT
        LTRIM(RTRIM(v.[${loc}])) AS LocCode,
        ${locDes ? `ISNULL(NULLIF(LTRIM(RTRIM(v.[${locDes}])), ''), LTRIM(RTRIM(v.[${loc}])))` : `LTRIM(RTRIM(v.[${loc}]))`} AS LocDes,
        CONVERT(varchar(10), v.[${date}], 103) AS VDate,
        ${bill ? `LTRIM(RTRIM(v.[${bill}]))` : `''`} AS BillNo,
        LTRIM(RTRIM(v.[${item}])) AS Item,
        ${qty ? `ISNULL(v.[${qty}], 0)` : "0"} AS Qty,
        ${rate ? `ISNULL(v.[${rate}], 0)` : "0"} AS Rate,
        ISNULL(v.[${value}], 0) AS Value,
        ${casherId ? `LTRIM(RTRIM(v.[${casherId}]))` : `''`} AS CasherId,
        ${casherName ? `LTRIM(RTRIM(v.[${casherName}]))` : `''`} AS CasherName,
        ${time ? `LTRIM(RTRIM(v.[${time}]))` : `''`} AS VTime
      FROM dbo.${VOID_VIEW} v WITH (NOLOCK)
      WHERE v.[${date}] >= @startDate
        AND v.[${date}] < DATEADD(day, 1, @endDate)
        ${outletId ? `AND LTRIM(RTRIM(v.[${loc}])) = @outletId` : ""}
      ORDER BY LocCode, CasherId, VDate
    `);

    const r2 = (n: number) => Math.round(n * 100) / 100;
    const locMap = new Map<string, { locCode: string; locName: string; cashiers: Map<string, { casherId: string; casherName: string; rows: Array<{ billNo: string; date: string; time: string; item: string; qty: number; rate: number; value: number }>; sub: number }>; total: number }>();
    let grand = 0;
    for (const row of result.recordset as Array<{ [k: string]: unknown }>) {
      const str = (k: string) => String(row[k] ?? "");
      const lc = str("LocCode");
      let L = locMap.get(lc);
      if (!L) {
        L = { locCode: lc, locName: str("LocDes"), cashiers: new Map(), total: 0 };
        locMap.set(lc, L);
      }
      const cid = str("CasherId") || "—";
      let C = L.cashiers.get(cid);
      if (!C) {
        C = { casherId: cid, casherName: str("CasherName"), rows: [], sub: 0 };
        L.cashiers.set(cid, C);
      }
      const val = r2(Number(row.Value ?? 0));
      C.rows.push({ billNo: str("BillNo"), date: str("VDate"), time: str("VTime"), item: str("Item"), qty: Number(row.Qty ?? 0), rate: r2(Number(row.Rate ?? 0)), value: val });
      C.sub = r2(C.sub + val);
      L.total = r2(L.total + val);
      grand = r2(grand + val);
    }
    const locationGroups = Array.from(locMap.values())
      .sort((a, b) => a.locCode.localeCompare(b.locCode))
      .map((L) => ({
        locCode: L.locCode,
        locName: L.locName,
        cashiers: Array.from(L.cashiers.values()).sort((a, b) => a.casherId.localeCompare(b.casherId))
          .map((C) => ({ casherId: C.casherId, casherName: C.casherName, rows: C.rows, subTotal: C.sub })),
        voidTotal: L.total,
      }));
    return { success: true, data: { locationGroups, grandTotal: grand } };
  } catch (error) {
    console.error("Void Report Action Error:", error);
    return actionError(error);
  }
}

// ============================================================
// 11 Pax Count (POS: Vw_PaxCount)
// POS: Select * from Vw_PaxCount Where Txndate Between ... And
//   LocCode = ... ORDER BY LocCode, TXNDATE, TMACINEID
// Web: per location — date summary (pax/bills/avg) + bill-wise
// spending-per-pax table.
// ============================================================
export async function getPaxCountAction(filters: ReportFilter) {
  try {
    await requireSession();
    if (!isDbConfigured()) {
      return { success: false, error: "Database not configured (DB_* env vars missing)" };
    }
    const { startDate, endDate, outletId } = filters;
    const pool = await getPool();
    const PAX_VIEW = process.env.PAX_COUNT_VIEW || "Vw_PaxCount";
    const cols = await viewColumnsGeneric(pool, PAX_VIEW);
    if (cols.size === 0) {
      return { success: false, error: `View 'dbo.${PAX_VIEW}' not found in database` };
    }
    const loc = pickCol(cols, ["LOCCODE", "LocCode", "Loc", "Location", "Outlet"]);
    const date = pickCol(cols, ["TXNDATE", "Txndate", "TrnDate"]);
    const pax = pickCol(cols, ["TotalPax", "NoPax", "Pax", "NOPax", "LocalPax"]);
    const spending = pickCol(cols, ["TotalSpending", "Spending", "NetTotal", "SaleTotal", "Value"]);
    if (!loc || !date || !pax || !spending) {
      return {
        success: false,
        error: `Unable to map pax view columns — missing: ${[!loc ? "loc (LOCCODE)" : "", !date ? "date (TXNDATE)" : "", !pax ? "pax (TotalPax)" : "", !spending ? "spending (TotalSpending)" : ""].filter(Boolean).join(", ")}. Actual view columns: ${Array.from(cols).join(", ")}`,
      };
    }
    const locDes = pickCol(cols, ["LocDes", "LocName", "LocationName"]);
    const txn = pickCol(cols, ["SafeTransactionID", "TransactionID", "TxnID"]);
    const bill = pickCol(cols, ["BillNo", "BILLNO", "BillNO", "Bill"]);

    const r = pool.request();
    r.input("startDate", sql.DateTime2, new Date(startDate));
    r.input("endDate", sql.DateTime2, new Date(`${endDate} 23:59:59`));
    if (outletId) r.input("outletId", sql.VarChar(20), String(outletId));

    const result = await r.query(`
      SELECT
        LTRIM(RTRIM(v.[${loc}])) AS LocCode,
        ${locDes ? `ISNULL(NULLIF(LTRIM(RTRIM(v.[${locDes}])), ''), LTRIM(RTRIM(v.[${loc}])))` : `LTRIM(RTRIM(v.[${loc}]))`} AS LocDes,
        CONVERT(varchar(10), v.[${date}], 103) AS PDate,
        ${bill ? `LTRIM(RTRIM(v.[${bill}]))` : txn ? `LTRIM(RTRIM(v.[${txn}]))` : `''`} AS BillNo,
        ISNULL(v.[${pax}], 0) AS Pax,
        ISNULL(v.[${spending}], 0) AS Spending
      FROM dbo.${PAX_VIEW} v WITH (NOLOCK)
      WHERE v.[${date}] >= @startDate
        AND v.[${date}] < DATEADD(day, 1, @endDate)
        ${outletId ? `AND LTRIM(RTRIM(v.[${loc}])) = @outletId` : ""}
      ORDER BY LocCode, PDate, BillNo
    `);

    const r2 = (n: number) => Math.round(n * 100) / 100;
    const locMap = new Map<string, { locCode: string; locName: string; dates: Map<string, { pax: number; bills: number }>; bills: Array<{ date: string; billNo: string; pax: number; spending: number }>; tp: number; tb: number; ts: number }>();
    const g = { tp: 0, tb: 0, ts: 0 };
    for (const row of result.recordset as Array<{ [k: string]: unknown }>) {
      const str = (k: string) => String(row[k] ?? "");
      const lc = str("LocCode");
      let L = locMap.get(lc);
      if (!L) {
        L = { locCode: lc, locName: str("LocDes"), dates: new Map(), bills: [], tp: 0, tb: 0, ts: 0 };
        locMap.set(lc, L);
      }
      const d = str("PDate");
      let D = L.dates.get(d);
      if (!D) {
        D = { pax: 0, bills: 0 };
        L.dates.set(d, D);
      }
      const p = Number(row.Pax ?? 0);
      const s = r2(Number(row.Spending ?? 0));
      D.pax += p;
      D.bills += 1;
      L.bills.push({ date: d, billNo: str("BillNo"), pax: p, spending: s });
      L.tp += p; L.tb += 1; L.ts = r2(L.ts + s);
      g.tp += p; g.tb += 1; g.ts = r2(g.ts + s);
    }
    const locationGroups = Array.from(locMap.values())
      .sort((a, b) => a.locCode.localeCompare(b.locCode))
      .map((L) => ({
        locCode: L.locCode,
        locName: L.locName,
        summary: Array.from(L.dates.entries())
          .map(([d, v]) => ({ date: d, totalPax: v.pax, totalBills: v.bills, avgPax: v.bills > 0 ? r2(v.pax / v.bills) : 0 })),
        bills: L.bills.map((b) => ({ date: b.date, billNo: b.billNo, totalPax: b.pax, totalSpending: b.spending, avgSpending: b.pax > 0 ? r2(b.spending / b.pax) : 0 })),
        totals: {
          totalPax: L.tp,
          totalBills: L.tb,
          avgPax: L.tb > 0 ? r2(L.tp / L.tb) : 0,
          totalSpending: L.ts,
          avgSpending: L.tp > 0 ? r2(L.ts / L.tp) : 0,
        },
      }));
    return {
      success: true,
      data: {
        locationGroups,
        grand: {
          totalPax: g.tp,
          totalBills: g.tb,
          avgPax: g.tb > 0 ? r2(g.tp / g.tb) : 0,
          totalSpending: g.ts,
          avgSpending: g.tp > 0 ? r2(g.ts / g.tp) : 0,
        },
      },
    };
  } catch (error) {
    console.error("Pax Count Action Error:", error);
    return actionError(error);
  }
}

// ============================================================
// 14 Open (On-Going) Tables (POS: Tbl_Holdups map -> Vw_HoldUps)
// Currently held tables: section/table code -> held item rows.
// No date filter (live open state).
// ============================================================
export async function getOpenTablesAction(filters: ReportFilter) {
  try {
    await requireSession();
    if (!isDbConfigured()) {
      return { success: false, error: "Database not configured (DB_* env vars missing)" };
    }
    const { outletId } = filters;
    const pool = await getPool();
    const OPEN_VIEW = process.env.OPEN_TABLES_VIEW || "Vw_HoldUps";
    const cols = await viewColumnsGeneric(pool, OPEN_VIEW);
    if (cols.size === 0) {
      return { success: false, error: `View 'dbo.${OPEN_VIEW}' not found in database` };
    }
    const code = pickCol(cols, ["TransCode", "TableCode", "TabCode", "Section", "TableNo"]);
    const desc = pickCol(cols, ["TransDescription", "Description", "MenuItmDes", "ItemName"]);
    const value = pickCol(cols, ["ItemPrice", "Value", "Amount", "Total"]);
    if (!code || !desc || !value) {
      return {
        success: false,
        error: `Unable to map open tables view columns — missing: ${[!code ? "table (TransCode)" : "", !desc ? "desc (TransDescription)" : "", !value ? "value (ItemPrice)" : ""].filter(Boolean).join(", ")}. Actual view columns: ${Array.from(cols).join(", ")}`,
      };
    }
    const qty = pickCol(cols, ["Qty", "Quantity"]);
    const price = pickCol(cols, ["SalesPrice", "Price", "Rate"]);
    const mode = pickCol(cols, ["OrderMode", "Mode"]);
    const cancel = pickCol(cols, ["CANCEL", "Cancel", "Cancelled"]);
    const cashier = pickCol(cols, ["CASHIER", "Casher", "CasherName", "UserName"]);
    const loc = pickCol(cols, ["LocCode", "LOCCODE", "Loc"]);

    const r = pool.request();
    if (outletId && loc) r.input("outletId", sql.VarChar(20), String(outletId));
    const result = await r.query(`
      SELECT
        LTRIM(RTRIM(v.[${code}])) AS Code,
        LTRIM(RTRIM(v.[${desc}])) AS Des,
        ${qty ? `ISNULL(v.[${qty}], 0)` : "0"} AS Qty,
        ${price ? `ISNULL(v.[${price}], 0)` : "0"} AS Price,
        ISNULL(v.[${value}], 0) AS Value,
        ${mode ? `LTRIM(RTRIM(v.[${mode}]))` : `''`} AS Mode,
        ${cancel ? `LTRIM(RTRIM(v.[${cancel}]))` : `''`} AS Cancel,
        ${cashier ? `LTRIM(RTRIM(v.[${cashier}]))` : `''`} AS Cashier
      FROM dbo.${OPEN_VIEW} v WITH (NOLOCK)
      ${loc && outletId ? `WHERE LTRIM(RTRIM(v.[${loc}])) = @outletId` : ""}
      ORDER BY Code
    `);

    const r2 = (n: number) => Math.round(n * 100) / 100;
    const secMap = new Map<string, { code: string; rows: Array<{ desc: string; qty: number; price: number; value: number; mode: string; cancel: string; cashier: string }>; amount: number }>();
    let grand = 0;
    for (const row of result.recordset as Array<{ [k: string]: unknown }>) {
      const str = (k: string) => String(row[k] ?? "");
      const c = str("Code");
      let S = secMap.get(c);
      if (!S) {
        S = { code: c, rows: [], amount: 0 };
        secMap.set(c, S);
      }
      const val = r2(Number(row.Value ?? 0));
      S.rows.push({ desc: str("Des"), qty: Number(row.Qty ?? 0), price: r2(Number(row.Price ?? 0)), value: val, mode: str("Mode"), cancel: str("Cancel"), cashier: str("Cashier") });
      S.amount = r2(S.amount + val);
      grand = r2(grand + val);
    }
    const sections = Array.from(secMap.values()).sort((a, b) => a.code.localeCompare(b.code));
    return { success: true, data: { sections, grandTotal: grand } };
  } catch (error) {
    console.error("Open Tables Action Error:", error);
    return actionError(error);
  }
}

// ============================================================
// 15.1 Slip Trace / 15.2 Invoice Trace (POS: Vw_SlipPrintDetails)
// POS: Select * from Vw_SlipPrintDetails Where locCode = '...'
//   And Txndate Between ... ORDER BY BIRTHNO, RefNo
//   (invoice trace adds: Where BillNo = '...')
// Web: location -> bill trace sections; invoice trace = type the
// invoice number into the search box.
// ============================================================
export async function getSlipTraceAction(filters: ReportFilter) {
  try {
    await requireSession();
    if (!isDbConfigured()) {
      return { success: false, error: "Database not configured (DB_* env vars missing)" };
    }
    const { startDate, endDate, outletId } = filters;
    const pool = await getPool();
    const TRACE_VIEW = process.env.SLIP_TRACE_VIEW || "Vw_SlipPrintDetails";
    const cols = await viewColumnsGeneric(pool, TRACE_VIEW);
    if (cols.size === 0) {
      return { success: false, error: `View 'dbo.${TRACE_VIEW}' not found in database` };
    }
    const loc = pickCol(cols, ["locCode", "LOCCODE", "LocCode", "Loc"]);
    const bill = pickCol(cols, ["BillNo", "BILLNO", "BillNO", "Bill"]);
    if (!loc || !bill) {
      return {
        success: false,
        error: `Unable to map trace view columns — missing: ${[!loc ? "loc (locCode)" : "", !bill ? "bill (BillNo)" : ""].filter(Boolean).join(", ")}. Actual view columns: ${Array.from(cols).join(", ")}`,
      };
    }
    const date = pickCol(cols, ["Txndate", "TXNDATE", "TrnDate"]);
    const birth = pickCol(cols, ["BIRTHNO", "BirthNo"]);
    const ref = pickCol(cols, ["RefNo", "Ref"]);
    const action = pickCol(cols, ["TransAction", "Transaction", "Action", "Trans"]);
    const qty = pickCol(cols, ["Qty", "Quantity"]);
    const price = pickCol(cols, ["ItemPrice", "Price", "Rate"]);
    const amount = pickCol(cols, ["Amount", "Value"]);
    const user = pickCol(cols, ["UserName", "CASHIER", "Casher"]);
    const billtype = pickCol(cols, ["BillType"]);
    const status = pickCol(cols, ["Update", "Status"]);
    const refdate = pickCol(cols, ["RefDate"]);
    const locDes = pickCol(cols, ["LocDes", "LocName", "LocationName"]);

    const r = pool.request();
    r.input("startDate", sql.DateTime2, new Date(startDate));
    r.input("endDate", sql.DateTime2, new Date(`${endDate} 23:59:59`));
    if (outletId) r.input("outletId", sql.VarChar(20), String(outletId));

    const result = await r.query(`
      SELECT
        LTRIM(RTRIM(v.[${loc}])) AS LocCode,
        ${locDes ? `ISNULL(NULLIF(LTRIM(RTRIM(v.[${locDes}])), ''), LTRIM(RTRIM(v.[${loc}])))` : `LTRIM(RTRIM(v.[${loc}]))`} AS LocDes,
        LTRIM(RTRIM(v.[${bill}])) AS BillNo,
        ${birth ? `LTRIM(RTRIM(v.[${birth}]))` : `''`} AS Birth,
        ${ref ? `LTRIM(RTRIM(v.[${ref}]))` : `''`} AS Ref,
        ${action ? `LTRIM(RTRIM(v.[${action}]))` : `''`} AS Action,
        ${date ? `CONVERT(varchar(10), v.[${date}], 103)` : `''`} AS TDate,
        ${refdate ? `CONVERT(varchar(10), v.[${refdate}], 103)` : `''`} AS RDate,
        ${qty ? `ISNULL(v.[${qty}], 0)` : "0"} AS Qty,
        ${price ? `ISNULL(v.[${price}], 0)` : "0"} AS Price,
        ${amount ? `ISNULL(v.[${amount}], 0)` : "0"} AS Amount,
        ${user ? `LTRIM(RTRIM(v.[${user}]))` : `''`} AS UserName,
        ${billtype ? `LTRIM(RTRIM(v.[${billtype}]))` : `''`} AS BillType,
        ${status ? `LTRIM(RTRIM(v.[${status}]))` : `''`} AS Status
      FROM dbo.${TRACE_VIEW} v WITH (NOLOCK)
      WHERE ${date ? `v.[${date}] >= @startDate AND v.[${date}] < DATEADD(day, 1, @endDate)` : "1 = 1"}
        ${outletId ? `AND LTRIM(RTRIM(v.[${loc}])) = @outletId` : ""}
      ORDER BY LocCode, BillNo, Birth, Ref
    `);

    const r2 = (n: number) => Math.round(n * 100) / 100;
    const locMap = new Map<string, { locCode: string; locName: string; bills: Map<string, { billNo: string; birth: string; billType: string; user: string; date: string; rows: Array<{ ref: string; action: string; date: string; qty: number; price: number; amount: number; status: string }>; net: number }>; total: number }>();
    let grand = 0;
    for (const row of result.recordset as Array<{ [k: string]: unknown }>) {
      const str = (k: string) => String(row[k] ?? "");
      const lc = str("LocCode");
      let L = locMap.get(lc);
      if (!L) {
        L = { locCode: lc, locName: str("LocDes"), bills: new Map(), total: 0 };
        locMap.set(lc, L);
      }
      const bk = `${str("BillNo")}::${str("Birth")}`;
      let B = L.bills.get(bk);
      if (!B) {
        B = { billNo: str("BillNo"), birth: str("Birth"), billType: str("BillType"), user: str("UserName"), date: str("TDate"), rows: [], net: 0 };
        L.bills.set(bk, B);
      }
      const amt = r2(Number(row.Amount ?? 0));
      B.rows.push({ ref: str("Ref"), action: str("Action"), date: str("RDate") || str("TDate"), qty: Number(row.Qty ?? 0), price: r2(Number(row.Price ?? 0)), amount: amt, status: str("Status") });
      B.net = r2(B.net + amt);
      L.total = r2(L.total + amt);
      grand = r2(grand + amt);
    }
    const locationGroups = Array.from(locMap.values())
      .sort((a, b) => a.locCode.localeCompare(b.locCode))
      .map((L) => ({
        locCode: L.locCode,
        locName: L.locName,
        bills: Array.from(L.bills.values()),
        locTotal: L.total,
      }));
    return { success: true, data: { locationGroups, grandTotal: grand } };
  } catch (error) {
    console.error("Slip Trace Action Error:", error);
    return actionError(error);
  }
}

// ============================================================
// 21.1 Credit Settlement — Current Credit Summary
// POS: Select * from Vw_CreditCustomer Where custcodedti <> '0'
//   and creditcustomer = '1'
// ============================================================
export async function getCreditSummaryAction(filters: ReportFilter) {
  try {
    await requireSession();
    if (!isDbConfigured()) {
      return { success: false, error: "Database not configured (DB_* env vars missing)" };
    }
    const { outletId } = filters;
    const pool = await getPool();
    const CRED_VIEW = process.env.CREDIT_SUMMARY_VIEW || "Vw_CreditCustomer";
    const cols = await viewColumnsGeneric(pool, CRED_VIEW);
    if (cols.size === 0) {
      return { success: false, error: `View 'dbo.${CRED_VIEW}' not found in database` };
    }
    const code = pickCol(cols, ["CustCode", "Custcode", "CUSTCODE", "CustCI", "Code"]);
    const name = pickCol(cols, ["CustName", "CustNameDTI", "Name"]);
    const total = pickCol(cols, ["TotalCredit", "CreditTotal", "OutStanding", "Balance"]);
    if (!code || !name || !total) {
      return {
        success: false,
        error: `Unable to map credit summary view columns — missing: ${[!code ? "cust code (CustCode)" : "", !name ? "name (CustName)" : "", !total ? "total (TotalCredit)" : ""].filter(Boolean).join(", ")}. Actual view columns: ${Array.from(cols).join(", ")}`,
      };
    }
    const period = pickCol(cols, ["ThisCreditPeriod", "CurentCredit", "CreditPeriod", "CurCredit"]);
    const dCode = pickCol(cols, ["custcodedti", "CustCodeDTI"]);
    const isCredit = pickCol(cols, ["creditcustomer", "CreditCustomer"]);
    const loc = pickCol(cols, ["LocCode", "LOCCODE", "locCode", "Loc"]);
    const locDes = pickCol(cols, ["LocDes", "LocName", "LocationName"]);

    const r = pool.request();
    if (outletId && loc) r.input("outletId", sql.VarChar(20), String(outletId));
    const result = await r.query(`
      SELECT
        ${loc ? `LTRIM(RTRIM(v.[${loc}])) AS LocCode,` : `'ALL' AS LocCode,`}
        ${loc && locDes ? `ISNULL(NULLIF(LTRIM(RTRIM(v.[${locDes}])), ''), LTRIM(RTRIM(v.[${loc}])))` : `'All Locations'`} AS LocDes,
        LTRIM(RTRIM(v.[${code}])) AS Code,
        LTRIM(RTRIM(v.[${name}])) AS Name,
        ${period ? `ISNULL(v.[${period}], 0)` : "0"} AS Period,
        ISNULL(v.[${total}], 0) AS Total
      FROM dbo.${CRED_VIEW} v WITH (NOLOCK)
      WHERE ${dCode ? `LTRIM(RTRIM(v.[${dCode}])) <> '0'` : "1 = 1"}
        ${isCredit ? `AND LTRIM(RTRIM(v.[${isCredit}])) = '1'` : ""}
        ${loc && outletId ? `AND LTRIM(RTRIM(v.[${loc}])) = @outletId` : ""}
      ORDER BY LocCode, Code
    `);

    const r2 = (n: number) => Math.round(n * 100) / 100;
    const locMap = new Map<string, { locCode: string; locName: string; customers: Array<{ code: string; name: string; period: number; total: number }>; locPeriod: number; locTotal: number }>();
    let gP = 0;
    let gT = 0;
    for (const row of result.recordset as Array<{ [k: string]: unknown }>) {
      const str = (k: string) => String(row[k] ?? "");
      const lc = str("LocCode");
      let L = locMap.get(lc);
      if (!L) {
        L = { locCode: lc, locName: str("LocDes"), customers: [], locPeriod: 0, locTotal: 0 };
        locMap.set(lc, L);
      }
      const p = r2(Number(row.Period ?? 0));
      const t = r2(Number(row.Total ?? 0));
      L.customers.push({ code: str("Code"), name: str("Name"), period: p, total: t });
      L.locPeriod = r2(L.locPeriod + p);
      L.locTotal = r2(L.locTotal + t);
      gP = r2(gP + p);
      gT = r2(gT + t);
    }
    const locationGroups = Array.from(locMap.values()).sort((a, b) => a.locCode.localeCompare(b.locCode));
    return { success: true, data: { locationGroups, grandPeriod: gP, grandTotal: gT } };
  } catch (error) {
    console.error("Credit Summary Action Error:", error);
    return actionError(error);
  }
}

// ============================================================
// 21.2 / 21.3 Credit History + Payment History shared runner
// POS: Select * from Vw_CreditHistory Where Txndate Between ...
//   Order By LocCode, CustCI, TrnSdpt   (all or one customer)
//      Select * from Vw_creditPaymemtHistory Where Txndate
//   Between ... Order By LocCode, CustCI, TrnDate, sysusername
// Web: customer choice = the search box (type code / name).
// ============================================================
async function runCreditHistory(viewName: string, filters: ReportFilter) {
  await requireSession();
  if (!isDbConfigured()) {
    return { success: false, error: "Database not configured (DB_* env vars missing)" };
  }
  const { startDate, endDate, outletId } = filters;
  const pool = await getPool();
  const cols = await viewColumnsGeneric(pool, viewName);
  if (cols.size === 0) {
    return { success: false, error: `View 'dbo.${viewName}' not found in database` };
  }
  const loc = pickCol(cols, ["LocCode", "LOCCODE", "locCode", "Loc"]);
  const code = pickCol(cols, ["CustCode", "Custcode", "CUSTCODE", "CustCI", "Code"]);
  const amt = pickCol(cols, ["TranAmt", "TrsAmt", "Amount", "PayAmt"]);
  if (!code || !amt) {
    return {
      success: false,
      error: `Unable to map ${viewName} columns — missing: ${[!code ? "cust code (CustCode)" : "", !amt ? "amount (TranAmt)" : ""].filter(Boolean).join(", ")}. Actual view columns: ${Array.from(cols).join(", ")}`,
    };
  }
  const locDes = pickCol(cols, ["LocDes", "LocName", "LocationName"]);
  const name = pickCol(cols, ["CustName", "CustNameDTI", "Name"]);
  const date = pickCol(cols, ["Txndate", "TrnDate", "TXNDATE"]);
  const bill = pickCol(cols, ["BillNo", "BillNO", "Bill"]);
  const ref = pickCol(cols, ["BillRefNo", "RefNo", "Ref"]);
  const totalBill = pickCol(cols, ["TotalBill", "BillTotal", "BillAmt"]);
  const balance = pickCol(cols, ["TxnBalnce", "TxBalance", "Balance"]);
  const remark = pickCol(cols, ["TxnRemark", "Remark"]);
  const user = pickCol(cols, ["UserName", "sysusername", "SysUserName"]);

  const r = pool.request();
  r.input("startDate", sql.DateTime2, new Date(startDate));
  r.input("endDate", sql.DateTime2, new Date(`${endDate} 23:59:59`));
  if (outletId && loc) r.input("outletId", sql.VarChar(20), String(outletId));

  const result = await r.query(`
    SELECT
      ${loc ? `LTRIM(RTRIM(v.[${loc}]))` : `'ALL'`} AS LocCode,
      ${loc && locDes ? `ISNULL(NULLIF(LTRIM(RTRIM(v.[${locDes}])), ''), LTRIM(RTRIM(v.[${loc}])))` : `'All Locations'`} AS LocDes,
      LTRIM(RTRIM(v.[${code}])) AS Code,
      ${name ? `LTRIM(RTRIM(v.[${name}]))` : `LTRIM(RTRIM(v.[${code}]))`} AS Name,
      ${date ? `CONVERT(varchar(10), v.[${date}], 103)` : `''`} AS TDate,
      ${bill ? `LTRIM(RTRIM(v.[${bill}]))` : `''`} AS TBill,
      ${ref ? `LTRIM(RTRIM(v.[${ref}]))` : `''`} AS TRef,
      ${totalBill ? `ISNULL(v.[${totalBill}], 0)` : "0"} AS TTotalBill,
      ISNULL(v.[${amt}], 0) AS TAmt,
      ${balance ? `ISNULL(v.[${balance}], 0)` : "0"} AS TBalance,
      ${remark ? `LTRIM(RTRIM(v.[${remark}]))` : `''`} AS TRemark,
      ${user ? `LTRIM(RTRIM(v.[${user}]))` : `''`} AS TUser
    FROM dbo.${viewName} v WITH (NOLOCK)
    WHERE ${date ? `v.[${date}] >= @startDate AND v.[${date}] < DATEADD(day, 1, @endDate)` : "1 = 1"}
      ${loc && outletId ? `AND LTRIM(RTRIM(v.[${loc}])) = @outletId` : ""}
    ORDER BY LocCode, Code, TDate
  `);

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const locMap = new Map<string, { locCode: string; locName: string; custs: Map<string, { code: string; name: string; rows: Array<{ date: string; bill: string; ref: string; totalBill: number; tranAmt: number; balance: number; remark: string; user: string }>; total: number }>; total: number }>();
  let grand = 0;
  for (const row of result.recordset as Array<{ [k: string]: unknown }>) {
    const str = (k: string) => String(row[k] ?? "");
    const lc = str("LocCode");
    let L = locMap.get(lc);
    if (!L) {
      L = { locCode: lc, locName: str("LocDes"), custs: new Map(), total: 0 };
      locMap.set(lc, L);
    }
    const cc = str("Code");
    let C = L.custs.get(cc);
    if (!C) {
      C = { code: cc, name: str("Name"), rows: [], total: 0 };
      L.custs.set(cc, C);
    }
    const a = r2(Number(row.TAmt ?? 0));
    C.rows.push({ date: str("TDate"), bill: str("TBill"), ref: str("TRef"), totalBill: r2(Number(row.TTotalBill ?? 0)), tranAmt: a, balance: r2(Number(row.TBalance ?? 0)), remark: str("TRemark"), user: str("TUser") });
    C.total = r2(C.total + a);
    L.total = r2(L.total + a);
    grand = r2(grand + a);
  }
  const locationGroups = Array.from(locMap.values())
    .sort((a, b) => a.locCode.localeCompare(b.locCode))
    .map((L) => ({
      locCode: L.locCode,
      locName: L.locName,
      customers: Array.from(L.custs.values()),
      locTotal: L.total,
    }));
  return { success: true, data: { locationGroups, grandTotal: grand } };
}

export async function getCreditHistoryAction(filters: ReportFilter) {
  try {
    return await runCreditHistory(process.env.CREDIT_HISTORY_VIEW || "Vw_CreditHistory", filters);
  } catch (error) {
    console.error("Credit History Action Error:", error);
    return actionError(error);
  }
}

export async function getCreditPayHistoryAction(filters: ReportFilter) {
  try {
    await requireSession();
    if (!isDbConfigured()) {
      return { success: false, error: "Database not configured (DB_* env vars missing)" };
    }
    const { startDate, endDate, outletId } = filters;
    const pool = await getPool();
    const candidates = [
      process.env.CREDIT_PAY_HISTORY_VIEW || "Vw_creditPaymentHistory",
      "Vw_creditPaymentHistory",
      "Vw_creditPaymemtHistory",
    ];
    let view = "";
    let cols = new Set<string>();
    for (const v of candidates) {
      const c = await viewColumnsGeneric(pool, v);
      if (c.size > 0) { view = v; cols = c; break; }
    }
    if (!view) {
      return { success: false, error: "View 'dbo.Vw_creditPaymentHistory' not found in database" };
    }
    const loc = pickCol(cols, ["LocCode", "LOCCODE", "locCode"]);
    const locDes = pickCol(cols, ["LocDes", "LocName", "LocationName"]);
    const cus = pickCol(cols, ["CusID", "CustID", "CustCode", "Custcode", "CUSTCODE"]);
    const cusName = pickCol(cols, ["CusName", "CustName", "Name"]);
    const bill = pickCol(cols, ["BillNo", "BillNO", "Bill"]);
    const paidDate = pickCol(cols, ["TxnDate", "Txndate", "PaidDate"]);
    const inv = pickCol(cols, ["InvoiceNo", "InvNo"]);
    const invDate = pickCol(cols, ["InvoiceDate", "InvDate"]);
    const paidAmt = pickCol(cols, ["PaidAmt", "PayAmt", "Amt"]);
    const balBefore = pickCol(cols, ["BalanceBeforePay", "BalanceBeforPay", "BalBefore"]);
    const balAfter = pickCol(cols, ["BalanceAfterPay", "BalAfter", "Balance"]);
    const settle = pickCol(cols, ["Settlement", "SettleMode", "SettleType"]);
    const soldDate = pickCol(cols, ["SoldDate", "SLOODATE", "SaleDate"]);
    if (!cus || !bill || !paidAmt) {
      return {
        success: false,
        error: `Unable to map ${view} — missing: ${[!cus ? "customer (CusID)" : "", !bill ? "bill (BillNo)" : "", !paidAmt ? "amount (PaidAmt)" : ""].filter(Boolean).join(", ")}. Actual view columns: ${Array.from(cols).join(", ")}`,
      };
    }
    let customers: Array<{ id: string; des: string }> = [];
    const cr = await pool.request().query(
      `SELECT DISTINCT LTRIM(RTRIM(v.[${cus}])) AS CID, ${cusName ? `LTRIM(RTRIM(v.[${cusName}]))` : `LTRIM(RTRIM(v.[${cus}]))`} AS CDes FROM dbo.${view} v WITH (NOLOCK) WHERE LTRIM(RTRIM(v.[${cus}])) <> '' ORDER BY CID`
    );
    customers = (cr.recordset as Array<{ [k: string]: unknown }>).map((r) => ({ id: String(r.CID ?? ""), des: String(r.CDes ?? "") }));

    const req = pool.request();
    req.input("startDate", sql.DateTime2, new Date(startDate));
    req.input("endDate", sql.DateTime2, new Date(`${endDate} 23:59:59`));
    if (outletId && loc) req.input("outletId", sql.VarChar(20), String(outletId));
    if (filters.cusId) req.input("cusId", sql.VarChar(20), String(filters.cusId));
    const result = await req.query(`
      SELECT
        ${loc ? `LTRIM(RTRIM(v.[${loc}]))` : `'ALL'`} AS LocCode,
        ${loc && locDes ? `ISNULL(NULLIF(LTRIM(RTRIM(v.[${locDes}])), ''), LTRIM(RTRIM(v.[${loc}])))` : `'All Locations'`} AS LocDes,
        LTRIM(RTRIM(v.[${cus}])) AS Code,
        ${cusName ? `LTRIM(RTRIM(v.[${cusName}]))` : `LTRIM(RTRIM(v.[${cus}]))`} AS Name,
        LTRIM(RTRIM(v.[${bill}])) AS TBill,
        ${paidDate ? `CONVERT(varchar(10), v.[${paidDate}], 103)` : `''`} AS TPaidDate,
        ${inv ? `LTRIM(RTRIM(v.[${inv}]))` : `''`} AS TInv,
        ${invDate ? `CONVERT(varchar(10), v.[${invDate}], 103)` : `''`} AS TInvDate,
        ISNULL(v.[${paidAmt}], 0) AS TAmt,
        ${balBefore ? `ISNULL(v.[${balBefore}], 0)` : "0"} AS TBefore,
        ${balAfter ? `ISNULL(v.[${balAfter}], 0)` : "0"} AS TAfter,
        ${settle ? `LTRIM(RTRIM(v.[${settle}]))` : `''`} AS TSettle,
        ${soldDate ? `CONVERT(varchar(10), v.[${soldDate}], 103)` : `''`} AS TSold
      FROM dbo.${view} v WITH (NOLOCK)
      WHERE ${paidDate ? `v.[${paidDate}] >= @startDate AND v.[${paidDate}] < DATEADD(day, 1, @endDate)` : "1 = 1"}
        ${loc && outletId ? `AND LTRIM(RTRIM(v.[${loc}])) = @outletId` : ""}
        ${filters.cusId ? `AND LTRIM(RTRIM(v.[${cus}])) = @cusId` : ""}
      ORDER BY LocCode, Code, TPaidDate
    `);
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const locMap = new Map<string, { locCode: string; locName: string; custs: Map<string, { code: string; name: string; rows: Array<{ bill: string; paidDate: string; invoiceNo: string; invoiceDate: string; paidAmt: number; balBefore: number; balAfter: number; settlement: string; soldDate: string }>; totalPaid: number }> }>();
    let grand = 0;
    for (const row of result.recordset as Array<{ [k: string]: unknown }>) {
      const str = (k: string) => String(row[k] ?? "");
      const lc = str("LocCode");
      let L = locMap.get(lc);
      if (!L) { L = { locCode: lc, locName: str("LocDes"), custs: new Map() }; locMap.set(lc, L); }
      const cc = str("Code");
      let C = L.custs.get(cc);
      if (!C) { C = { code: cc, name: str("Name"), rows: [], totalPaid: 0 }; L.custs.set(cc, C); }
      const a = r2(Number(row.TAmt ?? 0));
      C.rows.push({ bill: str("TBill"), paidDate: str("TPaidDate"), invoiceNo: str("TInv"), invoiceDate: str("TInvDate"), paidAmt: a, balBefore: r2(Number(row.TBefore ?? 0)), balAfter: r2(Number(row.TAfter ?? 0)), settlement: str("TSettle"), soldDate: str("TSold") });
      C.totalPaid = r2(C.totalPaid + a);
      grand = r2(grand + a);
    }
    const locationGroups = Array.from(locMap.values())
      .sort((a, b) => a.locCode.localeCompare(b.locCode))
      .map((L) => ({ locCode: L.locCode, locName: L.locName, customers: Array.from(L.custs.values()) }));
    const cusSel = customers.find((c) => c.id === filters.cusId);
    return {
      success: true,
      data: {
        customerFilter: cusSel ? `${cusSel.id} ${cusSel.des}` : filters.cusId || null,
        customers,
        cols: { invoiceNo: !!inv, invoiceDate: !!invDate, balBefore: !!balBefore, balAfter: !!balAfter, settlement: !!settle, soldDate: !!soldDate },
        locationGroups,
        grandPaid: grand,
      },
    };
  } catch (error) {
    console.error("Credit Payment History Action Error:", error);
    return actionError(error);
  }
}

// ============================================================
// 1.5 Hourly Sales — POS parity (Tbl_TimeRange slots):
//   Select * from Tbl_TimeRange Where Enable = '1'
//     order by Listingorder
//   per slot: Select sum(NetTotal) As TotSales, Count(LocCode) As
//     NOfSales from VW_SalesSummery Where LocCode = '...' And
//     BillType <> 'CM' And DoNotShowInSales <> '1' And Txndate
//     Between ... And DATEPART(hh, txntime) >= FromTime AND
//     DATEPART(hh, txntime) < ToTime
// Web: single query + JS slot grouping; location-wise groups;
// slots with zero sales omitted (POS inserts only NOfSales <> 0).
// ============================================================
interface TimeSlot {
  order: number;
  label: string;
  from: number;
  to: number;
}

function defaultTimeSlots(): TimeSlot[] {
  const out: TimeSlot[] = [];
  for (let h = 0; h < 24; h++)
    out.push({
      order: h,
      label: `${String(h).padStart(2, "0")}:00 - ${String((h + 1) % 24).padStart(2, "0")}:00`,
      from: h,
      to: h + 1,
    });
  return out;
}

async function loadTimeSlots(pool: Awaited<ReturnType<typeof getPool>>): Promise<{ slots: TimeSlot[]; defined: boolean }> {
  const TR_TABLE = process.env.TIME_RANGE_TABLE || "Tbl_TimeRange";
  try {
    const cols = await viewColumnsGeneric(pool, TR_TABLE);
    if (cols.size === 0) return { slots: defaultTimeSlots(), defined: false };
    const list = pickCol(cols, ["ListingOrder", "ListOrder", "OrdNo", "OrderNo"]);
    const range = pickCol(cols, ["Range", "RangeDes", "TimeRange", "Des"]);
    const from = pickCol(cols, ["FromTime", "FromTm", "StartHour"]);
    const to = pickCol(cols, ["ToTime", "ToTm", "EndHour"]);
    const enable = pickCol(cols, ["Enable", "Enabled", "Active"]);
    if (!range || !from || !to) return { slots: defaultTimeSlots(), defined: false };
    const res = await pool.request().query(`
      SELECT ${list ? `v.[${list}]` : "0"} AS Ord,
        LTRIM(RTRIM(v.[${range}])) AS Rng,
        v.[${from}] AS F,
        v.[${to}] AS T
      FROM dbo.${TR_TABLE} v
      ${enable ? `WHERE LTRIM(RTRIM(v.[${enable}])) = '1'` : ""}
      ORDER BY Ord
    `);
    const slots: TimeSlot[] = [];
    (res.recordset as Array<{ [k: string]: unknown }>).forEach((row, i) => {
      const f = parseInt(String(row.F ?? ""), 10);
      const t = parseInt(String(row.T ?? ""), 10);
      if (!isNaN(f) && !isNaN(t)) slots.push({ order: i, label: String(row.Rng ?? ""), from: f, to: t });
    });
    return slots.length ? { slots, defined: true } : { slots: defaultTimeSlots(), defined: false };
  } catch {
    return { slots: defaultTimeSlots(), defined: false };
  }
}

function inSlot(h: number, s: TimeSlot): boolean {
  return s.to > s.from ? h >= s.from && h < s.to : h >= s.from || h < s.to;
}

function hourOf(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date) return raw.getHours();
  if (typeof raw === "number") {
    const n = Math.floor(raw);
    return n >= 0 && n <= 23 ? n : null;
  }
  const m = String(raw).trim().match(/^(\d{1,2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  return h >= 0 && h <= 23 ? h : null;
}

export async function getHourlySalesAction(filters: ReportFilter) {
  try {
    await requireSession();
    if (!isDbConfigured()) {
      return { success: false, error: "Database not configured (DB_* env vars missing)" };
    }
    const { startDate, endDate, outletId } = filters;
    const pool = await getPool();
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const { slots, defined } = await loadTimeSlots(pool);

    type SlotAgg = { bills: number; value: number };
    const locMap = new Map<string, { locCode: string; locName: string; agg: Map<number, SlotAgg> }>();
    const bump = (lc: string, ln: string, h: number | null, val: number, cnt: number) => {
      if (h == null) return;
      for (let si = 0; si < slots.length; si++) {
        if (inSlot(h, slots[si])) {
          let L = locMap.get(lc);
          if (!L) {
            L = { locCode: lc, locName: ln, agg: new Map() };
            locMap.set(lc, L);
          }
          const A = L.agg.get(si) || { bills: 0, value: 0 };
          A.bills += cnt;
          A.value = r2(A.value + val);
          L.agg.set(si, A);
          return;
        }
      }
    };

    // ── path 1: dedicated hourly view (optional) ──
    const HOURLY_VIEW = process.env.HOURLY_SALES_VIEW || "Vw_HourlySales";
    const hCols = await viewColumnsGeneric(pool, HOURLY_VIEW);
    let usedView = false;
    if (hCols.size > 0) {
      const loc = pickCol(hCols, ["LocCode", "LOCCODE", "locCode", "Loc"]);
      const hour = pickCol(hCols, ["Hour", "Hr", "SaleHour", "TimeHour", "HH"]);
      const val = pickCol(hCols, ["Sales", "SaleTotal", "TotalSales", "SalesValue", "Value", "Amount"]);
      if (hour && val) {
        const locDes = pickCol(hCols, ["LocDes", "LocName", "LocationName"]);
        const date = pickCol(hCols, ["Txndate", "TrnDate"]);
        const bills = pickCol(hCols, ["Bills", "NoOfBills", "BillCount", "TxnCount"]);
        const req = pool.request();
        req.input("startDate", sql.DateTime2, new Date(startDate));
        req.input("endDate", sql.DateTime2, new Date(`${endDate} 23:59:59`));
        if (outletId && loc) req.input("outletId", sql.VarChar(20), String(outletId));
        const result = await req.query(`
          SELECT
            ${loc ? `LTRIM(RTRIM(v.[${loc}]))` : `'ALL'`} AS LocCode,
            ${loc && locDes ? `ISNULL(NULLIF(LTRIM(RTRIM(v.[${locDes}])), ''), LTRIM(RTRIM(v.[${loc}])))` : `'All Locations'`} AS LocDes,
            v.[${hour}] AS Hr,
            ISNULL(v.[${val}], 0) AS Val,
            ${bills ? `ISNULL(v.[${bills}], 0)` : "1"} AS Bills
          FROM dbo.${HOURLY_VIEW} v WITH (NOLOCK)
          WHERE ${date ? `v.[${date}] >= @startDate AND v.[${date}] < DATEADD(day, 1, @endDate)` : "1 = 1"}
            ${loc && outletId ? `AND LTRIM(RTRIM(v.[${loc}])) = @outletId` : ""}
        `);
        for (const row of result.recordset as Array<{ [k: string]: unknown }>) {
          bump(String(row.LocCode ?? ""), String(row.LocDes ?? ""), hourOf(row.Hr), Number(row.Val ?? 0), Number(row.Bills ?? 1));
        }
        usedView = true;
      }
    }

    // ── path 2: POS semantics from VW_SalesSummery ──
    if (!usedView) {
      const cols = await viewColumnsGeneric(pool, SUMMARY_VIEW);
      if (cols.size === 0) {
        return { success: false, error: `Views 'dbo.${HOURLY_VIEW}' and 'dbo.${SUMMARY_VIEW}' not found in database` };
      }
      const date = pickCol(cols, ["Txndate", "TrnDate", "SalesDate"]);
      const time = pickCol(cols, ["TxnTime", "TrnTime"]);
      const val = pickCol(cols, ["NetTotal", "SaleTotal", "TotalSales", "GrandTotal", "Amount", "Total"]);
      if (!date || !time || !val) {
        return {
          success: false,
          error: `Unable to build hourly sales — summary view missing: ${[!date ? "date (Txndate)" : "", !time ? "time (TxnTime)" : "", !val ? "value (NetTotal)" : ""].filter(Boolean).join(", ")}. Actual columns: ${Array.from(cols).join(", ")}`,
        };
      }
      const pf = buildPosFilters({ cols, alias: "v." });
      const req = pool.request();
      req.input("startDate", sql.DateTime2, new Date(startDate));
      req.input("endDate", sql.DateTime2, new Date(`${endDate} 23:59:59`));
      if (outletId) req.input("outletId", sql.VarChar(20), String(outletId));
      pf.bind(req);
      const result = await req.query(`
        SELECT
          LTRIM(RTRIM(v.LocCode)) AS LocCode,
          ISNULL(NULLIF(LTRIM(RTRIM(v.LocDes)), ''), LTRIM(RTRIM(v.LocCode))) AS LocDes,
          DATEPART(hh, v.[${time}]) AS Hr,
          ISNULL(v.[${val}], 0) AS Val
        FROM dbo.${SUMMARY_VIEW} v WITH (NOLOCK)
        WHERE v.[${date}] >= @startDate AND v.[${date}] < DATEADD(day, 1, @endDate)
          ${pf.sql}
          ${outletId ? `AND LTRIM(RTRIM(v.LocCode)) = @outletId` : ""}
      `);
      for (const row of result.recordset as Array<{ [k: string]: unknown }>) {
        bump(String(row.LocCode ?? ""), String(row.LocDes ?? ""), hourOf(row.Hr), Number(row.Val ?? 0), 1);
      }
    }

    let grandBills = 0;
    let grandTotal = 0;
    const locationGroups = Array.from(locMap.values())
      .sort((a, b) => a.locCode.localeCompare(b.locCode))
      .map((L) => {
        const rows = slots
          .map((s, si) => ({ s, si, A: L.agg.get(si) }))
          .filter((x) => x.A && (x.A.bills > 0 || x.A.value !== 0))
          .map((x) => ({
            order: x.s.order,
            label: x.s.label,
            from: x.s.from,
            to: x.s.to,
            bills: x.A!.bills,
            value: x.A!.value,
          }));
        const locBills = rows.reduce((s, r) => s + r.bills, 0);
        const locTotal = r2(rows.reduce((s, r) => s + r.value, 0));
        const peak = rows.length
          ? rows.reduce((m, r) => (r.value > m.value ? r : m), rows[0]).label
          : null;
        grandBills += locBills;
        grandTotal = r2(grandTotal + locTotal);
        return { locCode: L.locCode, locName: L.locName, rows, locBills, locTotal, peakLabel: peak };
      });
    return { success: true, data: { slotsDefined: defined, locationGroups, grandBills, grandTotal } };
  } catch (error) {
    console.error("Hourly Sales Action Error:", error);
    return actionError(error);
  }
}

// ============================================================
// 2.4 Payment – Bill Type Wise (POS Sp_SalesPayment output:
// collections grouped by BILLTYPE from VW_SalesSummery)
// ============================================================
export async function getBillTypePaymentAction(filters: ReportFilter) {
  try {
    await requireSession();
    if (!isDbConfigured()) {
      return { success: false, error: "Database not configured (DB_* env vars missing)" };
    }
    const { startDate, endDate, outletId } = filters;
    const pool = await getPool();
    const cols = await viewColumnsGeneric(pool, SUMMARY_VIEW);
    if (cols.size === 0) {
      return { success: false, error: `View 'dbo.${SUMMARY_VIEW}' not found in database` };
    }
    const bt = pickCol(cols, ["BILLTYPE", "BillType"]);
    const val = pickCol(cols, ["NetTotal", "SaleTotal", "TotalSales", "GrandTotal", "Total"]);
    if (!bt || !val) {
      return {
        success: false,
        error: `Unable to build bill type report — missing: ${[!bt ? "bill type (BillType)" : "", !val ? "value (NetTotal)" : ""].filter(Boolean).join(", ")}. Actual columns: ${Array.from(cols).join(", ")}`,
      };
    }
    const pf = buildPosFilters({ cols, alias: "v.", billType: "" });
    const req = pool.request();
    req.input("startDate", sql.DateTime2, new Date(startDate));
    req.input("endDate", sql.DateTime2, new Date(`${endDate} 23:59:59`));
    if (outletId) req.input("outletId", sql.VarChar(20), String(outletId));
    pf.bind(req);
    const result = await req.query(`
      SELECT
        LTRIM(RTRIM(v.LocCode)) AS LocCode,
        ISNULL(NULLIF(LTRIM(RTRIM(v.LocDes)), ''), LTRIM(RTRIM(v.LocCode))) AS LocDes,
        ISNULL(NULLIF(LTRIM(RTRIM(v.[${bt}])), ''), 'UNKNOWN') AS BType,
        COUNT(*) AS Bills,
        SUM(ISNULL(v.[${val}], 0)) AS Val
      FROM dbo.${SUMMARY_VIEW} v WITH (NOLOCK)
      WHERE v.[${pickCol(cols, ["Txndate", "TrnDate", "SalesDate"])}] >= @startDate
        AND v.[${pickCol(cols, ["Txndate", "TrnDate", "SalesDate"])}] < DATEADD(day, 1, @endDate)
        ${pf.sql}
        ${outletId ? `AND LTRIM(RTRIM(v.LocCode)) = @outletId` : ""}
      GROUP BY LTRIM(RTRIM(v.LocCode)), ISNULL(NULLIF(LTRIM(RTRIM(v.LocDes)), ''), LTRIM(RTRIM(v.LocCode))), ISNULL(NULLIF(LTRIM(RTRIM(v.[${bt}])), ''), 'UNKNOWN')
      ORDER BY LocCode, BType
    `);
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const locMap = new Map<string, { locCode: string; locName: string; rows: Array<{ type: string; bills: number; total: number }>; locBills: number; locTotal: number }>();
    let gB = 0;
    let gT = 0;
    for (const row of result.recordset as Array<{ [k: string]: unknown }>) {
      const lc = String(row.LocCode ?? "");
      let L = locMap.get(lc);
      if (!L) {
        L = { locCode: lc, locName: String(row.LocDes ?? ""), rows: [], locBills: 0, locTotal: 0 };
        locMap.set(lc, L);
      }
      const b = Number(row.Bills ?? 0);
      const t = r2(Number(row.Val ?? 0));
      L.rows.push({ type: String(row.BType ?? ""), bills: b, total: t });
      L.locBills += b;
      L.locTotal = r2(L.locTotal + t);
      gB += b;
      gT = r2(gT + t);
    }
    const locationGroups = Array.from(locMap.values()).sort((a, b) => a.locCode.localeCompare(b.locCode));
    return { success: true, data: { locationGroups, grandBills: gB, grandTotal: gT } };
  } catch (error) {
    console.error("Bill Type Payment Action Error:", error);
    return actionError(error);
  }
}

// ============================================================
// 3.1 Cashier Collection – Cashier Wise Sales
// POS: select * from VW_SalesSummery Where Txndate Between ...
//   And LocCode = ... AND BILLTYPE <> 'CM' And
//   DoNotShowInSales <> '1' [And CashierID = ...] Order By TxnDate
// ============================================================
export async function getCashierCollectionAction(filters: ReportFilter) {
  try {
    await requireSession();
    if (!isDbConfigured()) {
      return { success: false, error: "Database not configured (DB_* env vars missing)" };
    }
    const { startDate, endDate, outletId } = filters;
    const pool = await getPool();
    const cols = await viewColumnsGeneric(pool, SUMMARY_VIEW);
    if (cols.size === 0) {
      return { success: false, error: `View 'dbo.${SUMMARY_VIEW}' not found in database` };
    }
    const cash = pickCol(cols, ["CashierID", "CasherID", "CASHIER", "Cashier"]);
    const bill = pickCol(cols, ["BillNo", "BillNO"]);
    const val = pickCol(cols, ["NetTotal", "SaleTotal", "TotalSales", "GrandTotal", "Total"]);
    const date = pickCol(cols, ["Txndate", "TrnDate", "SalesDate"]);
    if (!cash || !bill || !val || !date) {
      return {
        success: false,
        error: `Unable to build cashier collection — missing: ${[!cash ? "cashier (CashierID)" : "", !bill ? "bill (BillNo)" : "", !val ? "value (NetTotal)" : "", !date ? "date (Txndate)" : ""].filter(Boolean).join(", ")}. Actual columns: ${Array.from(cols).join(", ")}`,
      };
    }
    const time = pickCol(cols, ["TxnTime", "TrnTime"]);
    const pf = buildPosFilters({ cols, alias: "v." });
    const req = pool.request();
    req.input("startDate", sql.DateTime2, new Date(startDate));
    req.input("endDate", sql.DateTime2, new Date(`${endDate} 23:59:59`));
    if (outletId) req.input("outletId", sql.VarChar(20), String(outletId));
    pf.bind(req);
    const result = await req.query(`
      SELECT
        LTRIM(RTRIM(v.LocCode)) AS LocCode,
        ISNULL(NULLIF(LTRIM(RTRIM(v.LocDes)), ''), LTRIM(RTRIM(v.LocCode))) AS LocDes,
        LTRIM(RTRIM(v.[${cash}])) AS CCash,
        LTRIM(RTRIM(v.[${bill}])) AS BillNo,
        ISNULL(v.[${val}], 0) AS Val,
        CONVERT(varchar(10), v.[${date}], 103) AS TDate,
        ${time ? `CONVERT(varchar(8), v.[${time}], 108)` : `''`} AS TTime
      FROM dbo.${SUMMARY_VIEW} v WITH (NOLOCK)
      WHERE v.[${date}] >= @startDate AND v.[${date}] < DATEADD(day, 1, @endDate)
        ${pf.sql}
        ${outletId ? `AND LTRIM(RTRIM(v.LocCode)) = @outletId` : ""}
      ORDER BY LocCode, CCash, v.[${date}]
    `);
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const locMap = new Map<string, { locCode: string; locName: string; cash: Map<string, { code: string; bills: Array<{ billNo: string; value: number; dateTime: string }>; total: number }>; total: number }>();
    let gT = 0;
    for (const row of result.recordset as Array<{ [k: string]: unknown }>) {
      const lc = String(row.LocCode ?? "");
      let L = locMap.get(lc);
      if (!L) {
        L = { locCode: lc, locName: String(row.LocDes ?? ""), cash: new Map(), total: 0 };
        locMap.set(lc, L);
      }
      const cc = String(row.CCash ?? "") || "UNKNOWN";
      let C = L.cash.get(cc);
      if (!C) {
        C = { code: cc, bills: [], total: 0 };
        L.cash.set(cc, C);
      }
      const t = r2(Number(row.Val ?? 0));
      const dt = `${String(row.TDate ?? "")}${String(row.TTime ?? "") ? " " + String(row.TTime) : ""}`;
      C.bills.push({ billNo: String(row.BillNo ?? ""), value: t, dateTime: dt });
      C.total = r2(C.total + t);
      L.total = r2(L.total + t);
      gT = r2(gT + t);
    }
    const locationGroups = Array.from(locMap.values())
      .sort((a, b) => a.locCode.localeCompare(b.locCode))
      .map((L) => ({ locCode: L.locCode, locName: L.locName, cashiers: Array.from(L.cash.values()), locTotal: L.total }));
    return { success: true, data: { locationGroups, grandTotal: gT } };
  } catch (error) {
    console.error("Cashier Collection Action Error:", error);
    return actionError(error);
  }
}

// ============================================================
// 3.2 Cashier Collection – Payment Break Down
// POS: Sp_CashierPayment_Cashier -> per cashier, per payment
// mode collections. Source: Vw_SalesPayModes (payment rows).
// ============================================================
export async function getCashierBreakdownAction(filters: ReportFilter) {
  try {
    await requireSession();
    if (!isDbConfigured()) {
      return { success: false, error: "Database not configured (DB_* env vars missing)" };
    }
    const { startDate, endDate, outletId } = filters;
    const pool = await getPool();
    const cols = await viewColumnsGeneric(pool, PAY_VIEW);
    if (cols.size === 0) {
      return { success: false, error: `View 'dbo.${PAY_VIEW}' not found in database` };
    }
    const cash = pickCol(cols, ["CashierID", "CasherID", "CASHIER", "Cashier", "UserName"]);
    const mode = pickCol(cols, ["PayMode", "PaymentMode", "PayModeDes", "Mode"]);
    const amt = pickCol(cols, ["Amount", "Value", "PayAmt", "NetTotal"]);
    const date = pickCol(cols, ["Txndate", "TrnDate", "PayDate"]);
    if (!cash || !mode || !amt || !date) {
      return {
        success: false,
        error: `Unable to build payment break down — missing: ${[!cash ? "cashier (CashierID)" : "", !mode ? "mode (PayMode)" : "", !amt ? "amount (Amount)" : "", !date ? "date (Txndate)" : ""].filter(Boolean).join(", ")}. Actual columns: ${Array.from(cols).join(", ")}`,
      };
    }
    const time = pickCol(cols, ["TxnTime", "TrnTime", "PayTime"]);
    const req = pool.request();
    req.input("startDate", sql.DateTime2, new Date(startDate));
    req.input("endDate", sql.DateTime2, new Date(`${endDate} 23:59:59`));
    if (outletId) req.input("outletId", sql.VarChar(20), String(outletId));
    const result = await req.query(`
      SELECT
        LTRIM(RTRIM(v.LocCode)) AS LocCode,
        ISNULL(NULLIF(LTRIM(RTRIM(v.LocDes)), ''), LTRIM(RTRIM(v.LocCode))) AS LocDes,
        LTRIM(RTRIM(v.[${cash}])) AS CCash,
        LTRIM(RTRIM(v.[${mode}])) AS PMode,
        ISNULL(v.[${amt}], 0) AS Amt,
        CONVERT(varchar(10), v.[${date}], 103) AS TDate,
        ${time ? `CONVERT(varchar(8), v.[${time}], 108)` : `''`} AS TTime
      FROM dbo.${PAY_VIEW} v WITH (NOLOCK)
      WHERE v.[${date}] >= @startDate AND v.[${date}] < DATEADD(day, 1, @endDate)
        ${outletId ? `AND LTRIM(RTRIM(v.LocCode)) = @outletId` : ""}
      ORDER BY LocCode, CCash, PMode, v.[${date}]
    `);
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const locMap = new Map<string, { locCode: string; locName: string; cash: Map<string, { code: string; modes: Map<string, { mode: string; rows: Array<{ dateTime: string; amount: number }>; total: number }>; total: number }>; total: number }>();
    let gT = 0;
    for (const row of result.recordset as Array<{ [k: string]: unknown }>) {
      const lc = String(row.LocCode ?? "");
      let L = locMap.get(lc);
      if (!L) {
        L = { locCode: lc, locName: String(row.LocDes ?? ""), cash: new Map(), total: 0 };
        locMap.set(lc, L);
      }
      const cc = String(row.CCash ?? "") || "UNKNOWN";
      let C = L.cash.get(cc);
      if (!C) {
        C = { code: cc, modes: new Map(), total: 0 };
        L.cash.set(cc, C);
      }
      const mm = String(row.PMode ?? "") || "OTHER";
      let M = C.modes.get(mm);
      if (!M) {
        M = { mode: mm, rows: [], total: 0 };
        C.modes.set(mm, M);
      }
      const a = r2(Number(row.Amt ?? 0));
      const dt = `${String(row.TDate ?? "")}${String(row.TTime ?? "") ? " " + String(row.TTime) : ""}`;
      M.rows.push({ dateTime: dt, amount: a });
      M.total = r2(M.total + a);
      C.total = r2(C.total + a);
      L.total = r2(L.total + a);
      gT = r2(gT + a);
    }
    const locationGroups = Array.from(locMap.values())
      .sort((a, b) => a.locCode.localeCompare(b.locCode))
      .map((L) => ({
        locCode: L.locCode,
        locName: L.locName,
        cashiers: Array.from(L.cash.values()).map((C) => ({ code: C.code, modes: Array.from(C.modes.values()), total: C.total })),
        locTotal: L.total,
      }));
    return { success: true, data: { locationGroups, grandTotal: gT } };
  } catch (error) {
    console.error("Cashier Breakdown Action Error:", error);
    return actionError(error);
  }
}


// ── 4.x fallback: run POS stored procedures + read temp table ──
const MII_TEMP_CANDIDATES = [
  "Tbl_Temp_MenuIssue",
  "Tbl_Temp_ItemIssue",
  "Tbl_Temp_MenuItemIssue",
  "Tbl_Temp_SalesItemIssue",
];
function dmyOf(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
async function runMenuIssueSpFallback(
  pool: Awaited<ReturnType<typeof getPool>>,
  filters: ReportFilter,
  viewName: string
): Promise<null | { locationGroups: unknown[]; grandTotal: number }> {
  const { startDate, endDate, outletId } = filters;
  const diag: string[] = [];
  // locations to run the SP for (SP is per-location like POS dialog)
  let locs: Array<{ code: string; name: string }> = [];
  if (outletId) {
    locs = [{ code: String(outletId), name: String(outletId) }];
  } else {
    try {
      const lr = await pool.request().query(
        `SELECT DISTINCT LTRIM(RTRIM(LocCode)) AS LC, ISNULL(NULLIF(LTRIM(RTRIM(LocDes)), ''), LTRIM(RTRIM(LocCode))) AS LN FROM dbo.${SUMMARY_VIEW} WITH (NOLOCK)`
      );
      locs = (lr.recordset as Array<{ [k: string]: unknown }>).map((r) => ({ code: String(r.LC ?? ""), name: String(r.LN ?? "") }));
    } catch (e) {
      diag.push(`loc-list: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (locs.length === 0) return null;

  const spName = filters.withCost ? "Sp_SalesItemIssueWSC" : "Sp_SalesItemIssue";
  const spChk = await pool.request().query(`SELECT OBJECT_ID('dbo.${spName}') AS I`);
  const spExists = Number((spChk.recordset[0] as { I: unknown })?.I ?? 0) !== 0;
  diag.push(`${spName} exists: ${spExists}`);

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const r4 = (n: number) => Math.round(n * 10000) / 10000;
  type Row5 = { code: string; desc: string; qty: number; weight: number; unitValue: number; lastPrice: number; total: number };
  const locGroups: Array<{ locCode: string; locName: string; dates: Map<string, { date: string; depts: Map<string, { dept: string; rows: Row5[]; total: number }>; total: number }>; total: number }> = [];
  let gT = 0;

  const mapRows = (rows: Array<{ [k: string]: unknown }>, lc: { code: string; name: string }) => {
    // discover columns on the fly (view/temp/result-set all differ)
    const colNames = new Set<string>();
    for (const r of rows) for (const k of Object.keys(r)) colNames.add(k);
    const code = pickCol(colNames, ["MenuItemCode", "MenuItmCode", "ItemCode", "MenuItmId", "Code"]);
    const desc = pickCol(colNames, ["Description", "MenuItmDes", "ItemName", "Des"]);
    const qty = pickCol(colNames, ["Qty", "Quantity", "IssuedQty"]);
    const total = pickCol(colNames, ["TotalValue", "Total", "Value", "Amount"]);
    if (!code || !desc || !qty || !total) {
      diag.push(`rows for ${lc.code} unmappable — columns: ${Array.from(colNames).join(", ")}`);
      return;
    }
    const dept = pickCol(colNames, ["SalesDept", "SalesDepartment", "Dept", "Department"]);
    const weight = pickCol(colNames, ["WeightPer1MenuItem", "WeightPer1MenuIt", "Weight", "UnitWeight"]);
    const unit = pickCol(colNames, ["ValuePerUnitBasedQty", "ValuePerUnit", "UnitValue"]);
    const last = pickCol(colNames, ["LastPrice", "LastRate"]);
    const date = pickCol(colNames, ["Txndate", "TrnDate", "IssueDate", "TDate"]);
    let L = locGroups.find((x) => x.locCode === lc.code);
    if (!L) {
      L = { locCode: lc.code, locName: lc.name, dates: new Map(), total: 0 };
      locGroups.push(L);
    }
    for (const row of rows) {
      const rawD = date ? row[date] : undefined;
      const dk =
        rawD instanceof Date
          ? `${String(rawD.getDate()).padStart(2, "0")}/${String(rawD.getMonth() + 1).padStart(2, "0")}/${rawD.getFullYear()}`
          : rawD != null
            ? String(rawD)
            : "";
      let D = L.dates.get(dk);
      if (!D) {
        D = { date: dk, depts: new Map(), total: 0 };
        L.dates.set(dk, D);
      }
      const depk = dept ? String(row[dept] ?? "") || "Other" : "All";
      let Dep = D.depts.get(depk);
      if (!Dep) {
        Dep = { dept: depk, rows: [], total: 0 };
        D.depts.set(depk, Dep);
      }
      const t = r2(Number(row[total] ?? 0));
      Dep.rows.push({
        code: String(row[code] ?? ""),
        desc: String(row[desc] ?? ""),
        qty: r2(Number(row[qty] ?? 0)),
        weight: r4(Number(weight ? row[weight] ?? 0 : 0)),
        unitValue: r2(Number(unit ? row[unit] ?? 0 : 0)),
        lastPrice: r2(Number(last ? row[last] ?? 0 : 0)),
        total: t,
      });
      Dep.total = r2(Dep.total + t);
      D.total = r2(D.total + t);
      L.total = r2(L.total + t);
      gT = r2(gT + t);
    }
  };

  for (const lc of locs) {
    const safeLoc = lc.code.replace(/'/g, "''");
    // 1) SP may return the result set directly
    try {
      const er = await pool
        .request()
        .query(
          `SET DATEFORMAT dmy; EXEC dbo.${spName} '${dmyOf(startDate)}','${dmyOf(endDate)}','${safeLoc}'`
        );
      if (er.recordset && er.recordset.length > 0) {
        mapRows(er.recordset as Array<{ [k: string]: unknown }>, lc);
        continue;
      }
    } catch (e) {
      diag.push(`exec ${spName}(${lc.code}): ${e instanceof Error ? e.message : e}`);
    }
    // 2) otherwise read the physical temp table the SP filled —
    //    known names first, then any recently-modified %temp% table
    const cand = process.env.MENU_ISSUE_TEMP_TABLE
      ? [process.env.MENU_ISSUE_TEMP_TABLE, ...MII_TEMP_CANDIDATES]
      : MII_TEMP_CANDIDATES;
    let tables: string[] = [];
    for (const t of cand) {
      const chk = await pool.request().query(`SELECT OBJECT_ID('dbo.${t}') AS I`);
      if (Number((chk.recordset[0] as { I: unknown })?.I ?? 0)) tables.push(t);
    }
    if (tables.length === 0) {
      try {
        const dr = await pool.request().query(
          `SELECT name FROM sys.tables WHERE modify_date >= DATEADD(minute, -10, GETDATE()) ORDER BY modify_date DESC`
        );
        tables = (dr.recordset as Array<{ name: string }>)
          .map((r) => r.name)
          .filter((n) => /temp/i.test(n));
        if (tables.length > 0) diag.push(`discovered temp tables: ${tables.join(", ")}`);
      } catch {
        /* ignore */
      }
    }
    for (const t of tables) {
      const rr = await pool.request().query(`SELECT * FROM dbo.${t} WITH (NOLOCK)`);
      const rows = rr.recordset as Array<{ [k: string]: unknown }>;
      if (rows.length > 0) {
        mapRows(rows, lc);
        break;
      }
    }
  }

  if (locGroups.length === 0) {
    // surface everything we learned so the exact name can be configured
    console.error("[mii] fallback diagnostics:", diag.join(" | "));
    throw new Error(`menu-issue diagnostics — ${diag.join(" | ") || "no locations found"}`);
  }
  void viewName;
  return {
    locationGroups: locGroups
      .sort((a, b) => a.locCode.localeCompare(b.locCode))
      .map((L) => ({
        locCode: L.locCode,
        locName: L.locName,
        dates: Array.from(L.dates.values()).map((D) => ({
          date: D.date,
          depts: Array.from(D.depts.values()),
          total: D.total,
        })),
        locTotal: L.total,
      })),
    grandTotal: gT,
  };
}

// ============================================================
// 4.1 / 4.2 Menu Item Issue (POS Sp_SalesItemIssue /
// Sp_SalesItemIssueDept / Sp_SalesItemIssueWSC output):
// sales-department wise issued menu items with qty / weight /
// value columns. Source view configurable (Vw_MenuIssue).
// ============================================================
export async function getMenuIssueAction(filters: ReportFilter) {
  try {
    await requireSession();
    if (!isDbConfigured()) {
      return { success: false, error: "Database not configured (DB_* env vars missing)" };
    }
    const { startDate, endDate, outletId } = filters;
    const pool = await getPool();
    const MII_VIEW = process.env.MENU_ISSUE_VIEW || "Vw_MenuIssue";
    const cols = await viewColumnsGeneric(pool, MII_VIEW);
    if (cols.size === 0) {
      // POS has no view for 4.x — it runs stored procedures
      // (Sp_SalesItemIssue / ...Dept / ...WSC) that fill a temp
      // table. Mirror that exactly as a fallback.
      try {
        const sp = await runMenuIssueSpFallback(pool, filters, MII_VIEW);
        if (sp) return { success: true, data: sp };
      } catch (e) {
        return {
          success: false,
          error: `View 'dbo.${MII_VIEW}' not found and POS stored-procedure fallback failed: ${e instanceof Error ? e.message : e}`,
        };
      }
      return {
        success: false,
        error: `View 'dbo.${MII_VIEW}' not found and POS stored-procedure fallback (Sp_SalesItemIssue) produced no data. Set MENU_ISSUE_VIEW env to your view name if different.`,
      };
    }
    const loc = pickCol(cols, ["LocCode", "LOCCODE", "locCode", "Loc"]);
    const date = pickCol(cols, ["Txndate", "TrnDate", "IssueDate"]);
    const code = pickCol(cols, ["MenuItemCode", "MenuItmCode", "ItemCode", "MenuItmId"]);
    const desc = pickCol(cols, ["Description", "MenuItmDes", "ItemName", "Des"]);
    const qty = pickCol(cols, ["Qty", "Quantity", "IssuedQty"]);
    const total = pickCol(cols, ["TotalValue", "Total", "Value", "Amount"]);
    if (!code || !desc || !qty || !total) {
      return {
        success: false,
        error: `Unable to map menu issue view columns — missing: ${[!code ? "code (MenuItemCode)" : "", !desc ? "desc (Description)" : "", !qty ? "qty (Qty)" : "", !total ? "total (TotalValue)" : ""].filter(Boolean).join(", ")}. Actual view columns: ${Array.from(cols).join(", ")}`,
      };
    }
    const locDes = pickCol(cols, ["LocDes", "LocName", "LocationName"]);
    const dept = pickCol(cols, ["SalesDept", "SalesDepartment", "Dept", "Department"]);
    const weight = pickCol(cols, ["WeightPer1MenuItem", "WeightPer1MenuIt", "Weight", "UnitWeight"]);
    const unit = pickCol(cols, ["ValuePerUnitBasedQty", "ValuePerUnit", "UnitValue"]);
    const last = pickCol(cols, ["LastPrice", "LastRate"]);

    const req = pool.request();
    req.input("startDate", sql.DateTime2, new Date(startDate));
    req.input("endDate", sql.DateTime2, new Date(`${endDate} 23:59:59`));
    if (outletId && loc) req.input("outletId", sql.VarChar(20), String(outletId));
    const result = await req.query(`
      SELECT
        ${loc ? `LTRIM(RTRIM(v.[${loc}]))` : `'ALL'`} AS LocCode,
        ${loc && locDes ? `ISNULL(NULLIF(LTRIM(RTRIM(v.[${locDes}])), ''), LTRIM(RTRIM(v.[${loc}])))` : `'All Locations'`} AS LocDes,
        ${date ? `CONVERT(varchar(10), v.[${date}], 103)` : `''`} AS TDate,
        ${dept ? `ISNULL(NULLIF(LTRIM(RTRIM(v.[${dept}])), ''), 'Other')` : `'All'`} AS Dept,
        LTRIM(RTRIM(v.[${code}])) AS Code,
        LTRIM(RTRIM(v.[${desc}])) AS Des,
        SUM(ISNULL(v.[${qty}], 0)) AS Qty,
        ${weight ? `AVG(ISNULL(v.[${weight}], 0))` : "0"} AS Weight,
        ${unit ? `AVG(ISNULL(v.[${unit}], 0))` : "0"} AS Unit,
        ${last ? `MAX(ISNULL(v.[${last}], 0))` : "0"} AS LastP,
        SUM(ISNULL(v.[${total}], 0)) AS Total
      FROM dbo.${MII_VIEW} v WITH (NOLOCK)
      WHERE ${date ? `v.[${date}] >= @startDate AND v.[${date}] < DATEADD(day, 1, @endDate)` : "1 = 1"}
        ${loc && outletId ? `AND LTRIM(RTRIM(v.[${loc}])) = @outletId` : ""}
      GROUP BY
        ${loc ? `LTRIM(RTRIM(v.[${loc}]))` : `'ALL'`},
        ${loc && locDes ? `ISNULL(NULLIF(LTRIM(RTRIM(v.[${locDes}])), ''), LTRIM(RTRIM(v.[${loc}])))` : `'All Locations'`},
        ${date ? `CONVERT(varchar(10), v.[${date}], 103)` : `''`},
        ${dept ? `ISNULL(NULLIF(LTRIM(RTRIM(v.[${dept}])), ''), 'Other')` : `'All'`},
        LTRIM(RTRIM(v.[${code}])),
        LTRIM(RTRIM(v.[${desc}]))
      ORDER BY LocCode, TDate, Dept, Code
    `);
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const r4 = (n: number) => Math.round(n * 10000) / 10000;
    const locMap = new Map<string, { locCode: string; locName: string; dates: Map<string, { date: string; depts: Map<string, { dept: string; rows: Array<{ code: string; desc: string; qty: number; weight: number; unitValue: number; lastPrice: number; total: number }>; total: number }>; total: number }>; total: number }>();
    let gT = 0;
    for (const row of result.recordset as Array<{ [k: string]: unknown }>) {
      const lc = String(row.LocCode ?? "");
      let L = locMap.get(lc);
      if (!L) {
        L = { locCode: lc, locName: String(row.LocDes ?? ""), dates: new Map(), total: 0 };
        locMap.set(lc, L);
      }
      const dk = String(row.TDate ?? "");
      let D = L.dates.get(dk);
      if (!D) {
        D = { date: dk, depts: new Map(), total: 0 };
        L.dates.set(dk, D);
      }
      const depk = String(row.Dept ?? "");
      let Dep = D.depts.get(depk);
      if (!Dep) {
        Dep = { dept: depk, rows: [], total: 0 };
        D.depts.set(depk, Dep);
      }
      const t = r2(Number(row.Total ?? 0));
      Dep.rows.push({
        code: String(row.Code ?? ""),
        desc: String(row.Des ?? ""),
        qty: r2(Number(row.Qty ?? 0)),
        weight: r4(Number(row.Weight ?? 0)),
        unitValue: r2(Number(row.Unit ?? 0)),
        lastPrice: r2(Number(row.LastP ?? 0)),
        total: t,
      });
      Dep.total = r2(Dep.total + t);
      D.total = r2(D.total + t);
      L.total = r2(L.total + t);
      gT = r2(gT + t);
    }
    const locationGroups = Array.from(locMap.values())
      .sort((a, b) => a.locCode.localeCompare(b.locCode))
      .map((L) => ({
        locCode: L.locCode,
        locName: L.locName,
        dates: Array.from(L.dates.values()).map((D) => ({
          date: D.date,
          depts: Array.from(D.depts.values()),
          total: D.total,
        })),
        locTotal: L.total,
      }));
    return { success: true, data: { locationGroups, grandTotal: gT } };
  } catch (error) {
    console.error("Menu Issue Action Error:", error);
    return actionError(error);
  }
}

// ============================================================
// 5.1 Item Movement — Fast / Slow / Non Moving Items
// POS: set dateformat dmy Select Top N LocCode, SubItmID,
//   sum(Qty) As TotQty from Vw_SalesDetail where LocCode = ...
//   And Txndate Between ... Group by SubItmID, LocCode
//   order by TotQty DESC (fast) / ASC (slow)
// Non: execute Sp_ItemMovementNon then read
//   Vw_FastSlowItemMovement order by menuitmdes
// ============================================================
export async function getItemMovementAction(filters: ReportFilter) {
  try {
    await requireSession();
    if (!isDbConfigured()) {
      return { success: false, error: "Database not configured (DB_* env vars missing)" };
    }
    const { startDate, endDate, outletId } = filters;
    const mode: "fast" | "slow" | "non" =
      filters.movement === "slow" ? "slow" : filters.movement === "non" ? "non" : "fast";
    const N = Math.max(1, Math.floor(Number(filters.threshold) || 10));
    const pool = await getPool();
    const r2 = (n: number) => Math.round(n * 100) / 100;

    if (mode !== "non") {
      const IMV_VIEW = process.env.ITEM_MOVEMENT_VIEW || "Vw_SalesDetail";
      const cols = await viewColumnsGeneric(pool, IMV_VIEW);
      if (cols.size === 0) {
        return { success: false, error: `View 'dbo.${IMV_VIEW}' not found in database` };
      }
      const item = pickCol(cols, ["SubItmID", "SubItmId", "ItemCode", "ItmCode"]);
      const qty = pickCol(cols, ["Qty", "Quantity"]);
      const date = pickCol(cols, ["Txndate", "TrnDate"]);
      const desc = pickCol(cols, ["MenuItmDes", "MenuItemDes", "Description", "ItemName"]);
      if (!item || !qty || !date) {
        return {
          success: false,
          error: `Unable to map item movement view — missing: ${[!item ? "item (SubItmID)" : "", !qty ? "qty (Qty)" : "", !date ? "date (Txndate)" : ""].filter(Boolean).join(", ")}. Actual columns: ${Array.from(cols).join(", ")}`,
        };
      }
      const loc = pickCol(cols, ["LocCode", "LOCCODE", "locCode"]);
      const locDes = pickCol(cols, ["LocDes", "LocName", "LocationName"]);
      const req = pool.request();
      req.input("startDate", sql.DateTime2, new Date(startDate));
      req.input("endDate", sql.DateTime2, new Date(`${endDate} 23:59:59`));
      if (outletId && loc) req.input("outletId", sql.VarChar(20), String(outletId));
      const result = await req.query(`
        SELECT
          ${loc ? `LTRIM(RTRIM(v.[${loc}]))` : `'ALL'`} AS LocCode,
          ${loc && locDes ? `ISNULL(NULLIF(LTRIM(RTRIM(v.[${locDes}])), ''), LTRIM(RTRIM(v.[${loc}])))` : `'All Locations'`} AS LocDes,
          LTRIM(RTRIM(v.[${item}])) AS Code,
          ${desc ? `MAX(LTRIM(RTRIM(v.[${desc}])))` : `LTRIM(RTRIM(v.[${item}]))`} AS Des,
          SUM(ISNULL(v.[${qty}], 0)) AS IMQty
        FROM dbo.${IMV_VIEW} v WITH (NOLOCK)
        WHERE v.[${date}] >= @startDate AND v.[${date}] < DATEADD(day, 1, @endDate)
          ${outletId && loc ? `AND LTRIM(RTRIM(v.[${loc}])) = @outletId` : ""}
        GROUP BY
          ${loc ? `LTRIM(RTRIM(v.[${loc}]))` : `'ALL'`},
          ${loc && locDes ? `ISNULL(NULLIF(LTRIM(RTRIM(v.[${locDes}])), ''), LTRIM(RTRIM(v.[${loc}])))` : `'All Locations'`},
          LTRIM(RTRIM(v.[${item}]))
      `);
      const locMap = new Map<string, { locCode: string; locName: string; rows: Array<{ code: string; desc: string; qty: number }> }>();
      for (const row of result.recordset as Array<{ [k: string]: unknown }>) {
        const lc = String(row.LocCode ?? "");
        let L = locMap.get(lc);
        if (!L) {
          L = { locCode: lc, locName: String(row.LocDes ?? ""), rows: [] };
          locMap.set(lc, L);
        }
        L.rows.push({ code: String(row.Code ?? ""), desc: String(row.Des ?? ""), qty: r2(Number(row.IMQty ?? 0)) });
      }
      const locationGroups = Array.from(locMap.values())
        .sort((a, b) => a.locCode.localeCompare(b.locCode))
        .map((L) => {
          L.rows.sort((a, b) => (mode === "fast" ? b.qty - a.qty : a.qty - b.qty));
          return { locCode: L.locCode, locName: L.locName, rows: L.rows.slice(0, N) };
        });
      return { success: true, data: { mode, threshold: N, locationGroups } };
    }

    // ── non moving: POS SP + Vw_FastSlowItemMovement ──
    const NON_VIEW = process.env.NON_MOVING_VIEW || "Vw_FastSlowItemMovement";
    let locs: Array<{ code: string; name: string }> = [];
    if (outletId) locs = [{ code: String(outletId), name: String(outletId) }];
    else {
      const lr = await pool.request().query(
        `SELECT DISTINCT LTRIM(RTRIM(LocCode)) AS LC, ISNULL(NULLIF(LTRIM(RTRIM(LocDes)), ''), LTRIM(RTRIM(LocCode))) AS LN FROM dbo.${SUMMARY_VIEW} WITH (NOLOCK)`
      );
      locs = (lr.recordset as Array<{ [k: string]: unknown }>).map((r) => ({ code: String(r.LC ?? ""), name: String(r.LN ?? "") }));
    }
    const locGroups: Array<{ locCode: string; locName: string; rows: Array<{ code: string; desc: string; qty: number }> }> = [];
    for (const lc of locs) {
      const safeLoc = lc.code.replace(/'/g, "''");
      let rows: Array<{ [k: string]: unknown }> = [];
      try {
        const er = await pool
          .request()
          .query(
            `SET DATEFORMAT dmy; EXEC dbo.Sp_ItemMovementNon '${dmyOf(startDate)}','${dmyOf(endDate)}','${safeLoc}'`
          );
        rows = (er.recordset ?? []) as Array<{ [k: string]: unknown }>;
      } catch (e) {
        console.warn("[imv] Sp_ItemMovementNon exec failed:", e);
      }
      if (rows.length === 0) {
        const vc = await viewColumnsGeneric(pool, NON_VIEW);
        if (vc.size > 0) {
          const rr = await pool
            .request()
            .query(
              `SELECT * FROM dbo.${NON_VIEW} WITH (NOLOCK) WHERE LTRIM(RTRIM(LocCode)) = '${safeLoc}' ORDER BY MenuItmDes`
            );
          rows = rr.recordset as Array<{ [k: string]: unknown }>;
        }
      }
      if (rows.length === 0) continue;
      const colNames = new Set<string>();
      for (const r of rows) for (const k of Object.keys(r)) colNames.add(k);
      const code = pickCol(colNames, ["ItemCode", "SubItmID", "ItmCode", "Code"]);
      const desc = pickCol(colNames, ["MenuItmDes", "MenuItemDes", "Description", "ItemName"]);
      if (!code || !desc) continue;
      locGroups.push({
        locCode: lc.code,
        locName: lc.name,
        rows: rows.map((r) => ({ code: String(r[code] ?? ""), desc: String(r[desc] ?? ""), qty: 0 })),
      });
    }
    if (locGroups.length === 0) {
      return {
        success: false,
        error: `Non-moving items: Sp_ItemMovementNon / view 'dbo.${NON_VIEW}' produced no data for this range.`,
      };
    }
    return { success: true, data: { mode, threshold: N, locationGroups: locGroups } };
  } catch (error) {
    console.error("Item Movement Action Error:", error);
    return actionError(error);
  }
}

// ============================================================
// 12 Cash In/Out Report
// POS: set dateformat dmy Select * from VW_CASHINOUTREPORT
//   Where TxnDate Between ... And LocCode = '...'
//   [and PAYCatID = '...']   (Include Category checkbox)
// ============================================================
export async function getCashInOutAction(filters: ReportFilter) {
  try {
    await requireSession();
    if (!isDbConfigured()) {
      return { success: false, error: "Database not configured (DB_* env vars missing)" };
    }
    const { startDate, endDate, outletId } = filters;
    const pool = await getPool();
    const CIO_VIEW = process.env.CASH_INOUT_VIEW || "VW_CASHINOUTREPORT";
    const cols = await viewColumnsGeneric(pool, CIO_VIEW);
    if (cols.size === 0) {
      return { success: false, error: `View 'dbo.${CIO_VIEW}' not found in database` };
    }
    const date = pickCol(cols, ["TxnDate", "TrnDate", "Txndate"]);
    const payin = pickCol(cols, ["PayIN", "PayIn", "InAmt", "CashIn"]);
    const payout = pickCol(cols, ["PayOut", "OutAmt", "CashOut"]);
    if (!date || (!payin && !payout)) {
      return {
        success: false,
        error: `Unable to map cash in/out view — missing: ${[!date ? "date (TxnDate)" : "", !payin && !payout ? "amounts (PayIN/PayOut)" : ""].filter(Boolean).join(", ")}. Actual view columns: ${Array.from(cols).join(", ")}`,
      };
    }
    const loc = pickCol(cols, ["LocCode", "LOCCODE", "locCode"]);
    const locDes = pickCol(cols, ["LocDes", "LocName", "LocationName"]);
    const txnid = pickCol(cols, ["TxnID", "TxnId", "ID", "TxnNo"]);
    const time = pickCol(cols, ["TxnTime", "Time", "Tm"]);
    const cat = pickCol(cols, ["Category", "CategoryDes", "PayCatDes"]);
    const catid = pickCol(cols, ["PAYCatID", "PayCatID", "CatID"]);
    const remarks = pickCol(cols, ["Remarks", "Remark"]);
    const user = pickCol(cols, ["UserName", "User", "UserId"]);

    // full category list for the filter dropdown (POS combo)
    let categories: Array<{ id: string; des: string }> = [];
    if (catid) {
      const cr = await pool.request().query(
        `SELECT DISTINCT LTRIM(RTRIM(v.[${catid}])) AS CID, ${cat ? `LTRIM(RTRIM(v.[${cat}]))` : `LTRIM(RTRIM(v.[${catid}]))`} AS CDes FROM dbo.${CIO_VIEW} v WITH (NOLOCK) WHERE LTRIM(RTRIM(v.[${catid}])) <> '' ORDER BY CID`
      );
      categories = (cr.recordset as Array<{ [k: string]: unknown }>).map((r) => ({ id: String(r.CID ?? ""), des: String(r.CDes ?? "") }));
    }

    const req = pool.request();
    req.input("startDate", sql.DateTime2, new Date(startDate));
    req.input("endDate", sql.DateTime2, new Date(`${endDate} 23:59:59`));
    if (outletId && loc) req.input("outletId", sql.VarChar(20), String(outletId));
    if (filters.payCat && catid) req.input("payCat", sql.VarChar(20), String(filters.payCat));
    const result = await req.query(`
      SELECT
        ${loc ? `LTRIM(RTRIM(v.[${loc}]))` : `'ALL'`} AS LocCode,
        ${loc && locDes ? `ISNULL(NULLIF(LTRIM(RTRIM(v.[${locDes}])), ''), LTRIM(RTRIM(v.[${loc}])))` : `'All Locations'`} AS LocDes,
        CONVERT(varchar(10), v.[${date}], 103) AS TDate,
        ${time ? `LTRIM(RTRIM(CONVERT(varchar(8), v.[${time}], 108)))` : `''`} AS TTime,
        ${txnid ? `LTRIM(RTRIM(v.[${txnid}]))` : `''`} AS TxnId,
        ${payin ? `ISNULL(v.[${payin}], 0)` : "0"} AS InAmt,
        ${payout ? `ISNULL(v.[${payout}], 0)` : "0"} AS OutAmt,
        ${cat ? `LTRIM(RTRIM(v.[${cat}]))` : `''`} AS Cat,
        ${remarks ? `LTRIM(RTRIM(v.[${remarks}]))` : `''`} AS Rem,
        ${user ? `LTRIM(RTRIM(v.[${user}]))` : `''`} AS Usr
      FROM dbo.${CIO_VIEW} v WITH (NOLOCK)
      WHERE v.[${date}] >= @startDate AND v.[${date}] < DATEADD(day, 1, @endDate)
        ${loc && outletId ? `AND LTRIM(RTRIM(v.[${loc}])) = @outletId` : ""}
        ${filters.payCat && catid ? `AND LTRIM(RTRIM(v.[${catid}])) = @payCat` : ""}
      ORDER BY LocCode, v.[${date}], TTime
    `);
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const locMap = new Map<string, { locCode: string; locName: string; dates: Map<string, { date: string; rows: Array<{ txnId: string; time: string; payIn: number; payOut: number; category: string; remarks: string; user: string }>; inTotal: number; outTotal: number }>; locIn: number; locOut: number }>();
    let gIn = 0;
    let gOut = 0;
    for (const row of result.recordset as Array<{ [k: string]: unknown }>) {
      const lc = String(row.LocCode ?? "");
      let L = locMap.get(lc);
      if (!L) {
        L = { locCode: lc, locName: String(row.LocDes ?? ""), dates: new Map(), locIn: 0, locOut: 0 };
        locMap.set(lc, L);
      }
      const dk = String(row.TDate ?? "");
      let D = L.dates.get(dk);
      if (!D) {
        D = { date: dk, rows: [], inTotal: 0, outTotal: 0 };
        L.dates.set(dk, D);
      }
      const i = r2(Number(row.InAmt ?? 0));
      const o = r2(Number(row.OutAmt ?? 0));
      D.rows.push({ txnId: String(row.TxnId ?? ""), time: String(row.TTime ?? ""), payIn: i, payOut: o, category: String(row.Cat ?? ""), remarks: String(row.Rem ?? ""), user: String(row.Usr ?? "") });
      D.inTotal = r2(D.inTotal + i);
      D.outTotal = r2(D.outTotal + o);
      L.locIn = r2(L.locIn + i);
      L.locOut = r2(L.locOut + o);
      gIn = r2(gIn + i);
      gOut = r2(gOut + o);
    }
    const catSel = categories.find((c) => c.id === filters.payCat);
    const locationGroups = Array.from(locMap.values())
      .sort((a, b) => a.locCode.localeCompare(b.locCode))
      .map((L) => ({
        locCode: L.locCode,
        locName: L.locName,
        dates: Array.from(L.dates.values()),
        locIn: L.locIn,
        locOut: L.locOut,
      }));
    return {
      success: true,
      data: {
        categoryFilter: catSel ? catSel.des : filters.payCat || null,
        categories,
        locationGroups,
        grandIn: gIn,
        grandOut: gOut,
      },
    };
  } catch (error) {
    console.error("Cash In/Out Action Error:", error);
    return actionError(error);
  }
}

// ============================================================
// 16 KOT/BOT Tracing
// POS: set dateformat dmy Select * from Vw_ItemSalesDetails
//   Where [type = 'K'|'B'|'O'|'B1'..'B7'|'H' AND]
//   LOCCODE = '...' AND TxnDate Between 'dd/MMM/yyyy' And 'dd/MMM/yyyy'
//   ORDER BY kbdate, orderno
// Trc Type combo: All / Kitchen / Bar / Other / Bay 1..7 / Head
// ============================================================
export async function getKotBotAction(filters: ReportFilter) {
  try {
    await requireSession();
    if (!isDbConfigured()) {
      return { success: false, error: "Database not configured (DB_* env vars missing)" };
    }
    const { startDate, endDate, outletId } = filters;
    const pool = await getPool();
    const KOT_VIEW = process.env.KOTBOT_VIEW || "Vw_ItemSalesDetails";
    const cols = await viewColumnsGeneric(pool, KOT_VIEW);
    if (cols.size === 0) {
      return { success: false, error: `View 'dbo.${KOT_VIEW}' not found in database` };
    }
    const loc = pickCol(cols, ["LOCCODE", "LocCode", "locCode"]);
    const locDes = pickCol(cols, ["LocDes", "LocName", "LocationName", "Venue"]);
    const txnDate = pickCol(cols, ["TxnDate", "TrnDate", "Txndate"]);
    const kbdate = pickCol(cols, ["kbdate", "KOTDate", "KbotDate", "KBDate", "KDate"]);
    const orderno = pickCol(cols, ["orderno", "OrdNo", "KOTNo", "OrderNo"]);
    const typ = pickCol(cols, ["type", "Type", "TrcType", "KBType"]);
    const billdate = pickCol(cols, ["billdate", "BillDate"]);
    const billordno = pickCol(cols, ["billordno", "BillOrdNo", "BillNo"]);
    const billtype = pickCol(cols, ["billtype", "BillType"]);
    const time = pickCol(cols, ["kbtime", "KBTime", "KOTTime", "IssueTime", "Time"]);
    const user = pickCol(cols, ["UserName", "User", "Usr", "Server", "Steward", "Waiter"]);
    const item = pickCol(cols, ["ItemDesc", "ItemName", "Description", "MenuItemDes", "ItemOf", "Item"]);
    const qty = pickCol(cols, ["Qty", "qty", "Quantity"]);
    const remark = pickCol(cols, ["Remark", "Remarks"]);
    if (!orderno || (!kbdate && !txnDate)) {
      return {
        success: false,
        error: `Unable to map KOT/BOT view — missing: ${[!orderno ? "orderno" : "", !kbdate && !txnDate ? "date (kbdate/TxnDate)" : ""].filter(Boolean).join(", ")}. Actual view columns: ${Array.from(cols).join(", ")}`,
      };
    }
    const dateCol = kbdate || (txnDate as string);
    const filterDate = txnDate || (kbdate as string);
    const TRC: Record<string, { code: string | null; label: string }> = {
      all: { code: null, label: "All" },
      kitchen: { code: "K", label: "Kitchen" },
      bar: { code: "B", label: "Bar" },
      other: { code: "O", label: "Other" },
      bay1: { code: "B1", label: "Bay 1" },
      bay2: { code: "B2", label: "Bay 2" },
      bay3: { code: "B3", label: "Bay 3" },
      bay4: { code: "B4", label: "Bay 4" },
      bay5: { code: "B5", label: "Bay 5" },
      bay6: { code: "B6", label: "Bay 6" },
      bay7: { code: "B7", label: "Bay 7" },
      head: { code: "H", label: "Head" },
    };
    const trc = TRC[filters.trcType || "all"] || TRC.all;

    const req = pool.request();
    req.input("startDate", sql.DateTime2, new Date(startDate));
    req.input("endDate", sql.DateTime2, new Date(`${endDate} 23:59:59`));
    if (outletId && loc) req.input("outletId", sql.VarChar(20), String(outletId));
    if (trc.code && typ) req.input("trcType", sql.VarChar(10), trc.code);
    const result = await req.query(`
      SELECT
        ${loc ? `LTRIM(RTRIM(v.[${loc}]))` : `'ALL'`} AS LocCode,
        ${loc && locDes ? `ISNULL(NULLIF(LTRIM(RTRIM(v.[${locDes}])), ''), LTRIM(RTRIM(v.[${loc}])))` : `'All Locations'`} AS LocDes,
        LTRIM(RTRIM(v.[${orderno}])) AS OrdNo,
        CONVERT(varchar(10), v.[${dateCol}], 103) AS KBDate,
        ${typ ? `LTRIM(RTRIM(v.[${typ}]))` : `''`} AS Typ,
        ${billdate ? `CONVERT(varchar(10), v.[${billdate}], 103)` : `''`} AS BillDate,
        ${billordno ? `LTRIM(RTRIM(v.[${billordno}]))` : `''`} AS BillOrdNo,
        ${billtype ? `LTRIM(RTRIM(v.[${billtype}]))` : `''`} AS BillType,
        ${time ? `LTRIM(RTRIM(CONVERT(varchar(8), v.[${time}], 108)))` : `''`} AS IssTime,
        ${user ? `LTRIM(RTRIM(v.[${user}]))` : `''`} AS Usr,
        ${item ? `LTRIM(RTRIM(v.[${item}]))` : `''`} AS Itm,
        ${qty ? `ISNULL(v.[${qty}], 0)` : "0"} AS Qty,
        ${remark ? `LTRIM(RTRIM(v.[${remark}]))` : `''`} AS Rem
      FROM dbo.${KOT_VIEW} v WITH (NOLOCK)
      WHERE v.[${filterDate}] >= @startDate AND v.[${filterDate}] < DATEADD(day, 1, @endDate)
        ${loc && outletId ? `AND LTRIM(RTRIM(v.[${loc}])) = @outletId` : ""}
        ${trc.code && typ ? `AND LTRIM(RTRIM(v.[${typ}])) = @trcType` : ""}
      ORDER BY v.[${dateCol}], v.[${orderno}]
    `);

    const r2 = (n: number) => Math.round(n * 100) / 100;
    type TGroup = { orderTyp: "KOT" | "BOT"; rows: Array<Record<string, string | number>>; qty: number };
    const locMap = new Map<string, { locCode: string; locName: string; servers: Map<string, Map<"KOT" | "BOT", TGroup>>; total: number; totalQty: number }>();
    let gTotal = 0;
    let gQty = 0;
    for (const row of result.recordset as Array<{ [k: string]: unknown }>) {
      const lc = String(row.LocCode ?? "");
      let L = locMap.get(lc);
      if (!L) {
        L = { locCode: lc, locName: String(row.LocDes ?? ""), servers: new Map(), total: 0, totalQty: 0 };
        locMap.set(lc, L);
      }
      const sv = String(row.Usr ?? "") || "—";
      let S = L.servers.get(sv);
      if (!S) {
        S = new Map();
        L.servers.set(sv, S);
      }
      const orderTyp: "KOT" | "BOT" = String(row.BillOrdNo ?? "") !== "" ? "BOT" : "KOT";
      let T = S.get(orderTyp);
      if (!T) {
        T = { orderTyp, rows: [], qty: 0 };
        S.set(orderTyp, T);
      }
      const q = r2(Number(row.Qty ?? 0));
      T.rows.push({
        ordNo: String(row.OrdNo ?? ""),
        kbDate: String(row.KBDate ?? ""),
        type: String(row.Typ ?? ""),
        billDate: String(row.BillDate ?? ""),
        billOrdNo: String(row.BillOrdNo ?? ""),
        billType: String(row.BillType ?? ""),
        issueTime: String(row.IssTime ?? ""),
        user: sv,
        item: String(row.Itm ?? ""),
        qty: q,
        remark: String(row.Rem ?? ""),
      });
      T.qty = r2(T.qty + q);
      L.total += 1;
      L.totalQty = r2(L.totalQty + q);
      gTotal += 1;
      gQty = r2(gQty + q);
    }
    const locations = Array.from(locMap.values())
      .sort((a, b) => a.locCode.localeCompare(b.locCode))
      .map((L) => ({
        locCode: L.locCode,
        locName: L.locName,
        total: L.total,
        totalQty: L.totalQty,
        servers: Array.from(L.servers.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([server, tm]) => ({
            server,
            types: (["KOT", "BOT"] as const)
              .filter((k) => tm.has(k))
              .map((k) => {
                const t = tm.get(k) as TGroup;
                return { orderTyp: t.orderTyp, count: t.rows.length, qty: t.qty, rows: t.rows };
              }),
          })),
      }));
    return {
      success: true,
      data: {
        typeFilter: trc.code ? trc.label : null,
        locations,
        grandTotal: gTotal,
        grandQty: gQty,
      },
    };
  } catch (error) {
    console.error("KOT/BOT Action Error:", error);
    return actionError(error);
  }
}


// ============================================================
// 21.4 Credit Settlement – Account Detail
// POS: set dateformat dmy Select * from
//   Vw_Credit_SettelementHistory_Details Where Txndate Between ...
//   And LocCode = ... [And CusID = ...] Order By LocCode,CusID,sysserialno
// ============================================================
export async function getCreditAccountDetailAction(filters: ReportFilter) {
  try {
    await requireSession();
    if (!isDbConfigured()) {
      return { success: false, error: "Database not configured (DB_* env vars missing)" };
    }
    const { startDate, endDate, outletId } = filters;
    const pool = await getPool();
    const candidates = [
      process.env.CREDIT_ACCOUNT_DETAIL_VIEW || "Vw_Credit_SettelementHistory_Details",
      "Vw_Credit_SettelementHistory_Details",
      "Vw_Credit_SettlementHistory_Details",
    ];
    let view = "";
    let cols = new Set<string>();
    for (const v of candidates) {
      const c = await viewColumnsGeneric(pool, v);
      if (c.size > 0) { view = v; cols = c; break; }
    }
    if (!view) {
      return { success: false, error: "View 'dbo.Vw_Credit_SettelementHistory_Details' not found in database" };
    }
    const loc = pickCol(cols, ["LocCode", "LOCCODE", "locCode"]);
    const locDes = pickCol(cols, ["LocDes", "LocName", "LocationName"]);
    const cus = pickCol(cols, ["CusID", "CustID", "CustCode", "Custcode", "CUSTCODE"]);
    const cusName = pickCol(cols, ["CusName", "CustName", "Name"]);
    const bill = pickCol(cols, ["BillNo", "BillNO", "Bill"]);
    const trnType = pickCol(cols, ["TrnType", "TRNTYPE", "TrnTyp", "Type"]);
    const trnDate = pickCol(cols, ["TrnDate", "TRNDATE", "TxnDate", "Txndate"]);
    const prevAmt = pickCol(cols, ["PrevAmt", "PresAmt", "PrevBal", "BeforeAmt"]);
    const trnAmt = pickCol(cols, ["TrnAmt", "TranAmt", "Amt"]);
    const balAmt = pickCol(cols, ["BalAmt", "PenBalAmt", "PenDlAmt", "Balance"]);
    if (!cus || !bill) {
      return {
        success: false,
        error: `Unable to map ${view} — missing: ${[!cus ? "customer (CusID)" : "", !bill ? "bill (BillNo)" : ""].filter(Boolean).join(", ")}. Actual view columns: ${Array.from(cols).join(", ")}`,
      };
    }
    let customers: Array<{ id: string; des: string }> = [];
    const cr = await pool.request().query(
      `SELECT DISTINCT LTRIM(RTRIM(v.[${cus}])) AS CID, ${cusName ? `LTRIM(RTRIM(v.[${cusName}]))` : `LTRIM(RTRIM(v.[${cus}]))`} AS CDes FROM dbo.${view} v WITH (NOLOCK) WHERE LTRIM(RTRIM(v.[${cus}])) <> '' ORDER BY CID`
    );
    customers = (cr.recordset as Array<{ [k: string]: unknown }>).map((r) => ({ id: String(r.CID ?? ""), des: String(r.CDes ?? "") }));

    const req = pool.request();
    req.input("startDate", sql.DateTime2, new Date(startDate));
    req.input("endDate", sql.DateTime2, new Date(`${endDate} 23:59:59`));
    if (outletId && loc) req.input("outletId", sql.VarChar(20), String(outletId));
    if (filters.cusId) req.input("cusId", sql.VarChar(20), String(filters.cusId));
    const result = await req.query(`
      SELECT
        ${loc ? `LTRIM(RTRIM(v.[${loc}]))` : `'ALL'`} AS LocCode,
        ${loc && locDes ? `ISNULL(NULLIF(LTRIM(RTRIM(v.[${locDes}])), ''), LTRIM(RTRIM(v.[${loc}])))` : `'All Locations'`} AS LocDes,
        LTRIM(RTRIM(v.[${cus}])) AS Code,
        ${cusName ? `LTRIM(RTRIM(v.[${cusName}]))` : `LTRIM(RTRIM(v.[${cus}]))`} AS Name,
        LTRIM(RTRIM(v.[${bill}])) AS TBill,
        ${trnType ? `LTRIM(RTRIM(v.[${trnType}]))` : `''`} AS TType,
        ${trnDate ? `CONVERT(varchar(10), v.[${trnDate}], 103)` : `''`} AS TDate,
        ${prevAmt ? `ISNULL(v.[${prevAmt}], 0)` : "0"} AS TPrev,
        ${trnAmt ? `ISNULL(v.[${trnAmt}], 0)` : "0"} AS TAmt,
        ${balAmt ? `ISNULL(v.[${balAmt}], 0)` : "0"} AS TBal
      FROM dbo.${view} v WITH (NOLOCK)
      WHERE ${trnDate ? `v.[${trnDate}] >= @startDate AND v.[${trnDate}] < DATEADD(day, 1, @endDate)` : "1 = 1"}
        ${loc && outletId ? `AND LTRIM(RTRIM(v.[${loc}])) = @outletId` : ""}
        ${filters.cusId ? `AND LTRIM(RTRIM(v.[${cus}])) = @cusId` : ""}
      ORDER BY LocCode, Code, TDate
    `);
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const locMap = new Map<string, { locCode: string; locName: string; custs: Map<string, { code: string; name: string; rows: Array<{ bill: string; trnType: string; trnDate: string; prevAmt: number; trnAmt: number; balAmt: number }>; lastBal: number }> }>();
    for (const row of result.recordset as Array<{ [k: string]: unknown }>) {
      const str = (k: string) => String(row[k] ?? "");
      const lc = str("LocCode");
      let L = locMap.get(lc);
      if (!L) { L = { locCode: lc, locName: str("LocDes"), custs: new Map() }; locMap.set(lc, L); }
      const cc = str("Code");
      let C = L.custs.get(cc);
      if (!C) { C = { code: cc, name: str("Name"), rows: [], lastBal: 0 }; L.custs.set(cc, C); }
      const bal = r2(Number(row.TBal ?? 0));
      C.rows.push({ bill: str("TBill"), trnType: str("TType"), trnDate: str("TDate"), prevAmt: r2(Number(row.TPrev ?? 0)), trnAmt: r2(Number(row.TAmt ?? 0)), balAmt: bal });
      C.lastBal = bal;
    }
    const locationGroups = Array.from(locMap.values())
      .sort((a, b) => a.locCode.localeCompare(b.locCode))
      .map((L) => ({ locCode: L.locCode, locName: L.locName, customers: Array.from(L.custs.values()) }));
    const cusSel = customers.find((c) => c.id === filters.cusId);
    return {
      success: true,
      data: {
        customerFilter: cusSel ? `${cusSel.id} ${cusSel.des}` : filters.cusId || null,
        customers,
        cols: { prevAmt: !!prevAmt, trnAmt: !!trnAmt, balAmt: !!balAmt },
        locationGroups,
      },
    };
  } catch (error) {
    console.error("Credit Account Detail Action Error:", error);
    return actionError(error);
  }
}

// ============================================================
// 3.3 Cashier Collection – Payment Break Down – Grid
// POS: execute Sp_SalesPayment_casher 'from','to','loc','cashier'
//   -> Tbl_Temp_SalesPaymentCasher (bill × pay-mode grid per cashier)
// Web: pay-mode grid grouped per cashier with a cashier selector.
// ============================================================
export async function getCashierBreakdownGridAction(filters: ReportFilter) {
  try {
    await requireSession();
    if (!isDbConfigured()) {
      return { success: false, error: "Database not configured (DB_* env vars missing)" };
    }
    const { startDate, endDate, outletId } = filters;
    const pool = await getPool();
    const candidates = [
      process.env.CASHIER_GRID_VIEW || "Vw_SalesPayModes",
      "Vw_SalesPayModes",
      "Vw_PayModes",
    ];
    let view = "";
    let cols = new Set<string>();
    let mapErr = "";
    for (const cand of candidates) {
      const c = await viewColumnsGeneric(pool, cand);
      if (c.size === 0) continue;
      const mapped =
        pickCol(c, ["LocCode", "Loc", "Location", "Outlet"]) &&
        pickCol(c, ["Txndate", "TrnDate", "SalesDate", "BillDate"]) &&
        pickCol(c, ["BillNo", "BillNO", "Bill"]) &&
        pickCol(c, ["PayDes", "PaymentDes", "PaymentDescription", "PayMode", "ModeDes", "PaymentMode", "Description"]) &&
        pickCol(c, ["ActAmt", "Amount", "PayAmount", "PayValue", "TenderedAmt", "SaleTotal", "Total", "Value"]);
      if (mapped) { view = cand; cols = c; break; }
      if (!mapErr) mapErr = `View 'dbo.${cand}' actual columns: ${Array.from(c).join(", ")}`;
    }
    if (!view) {
      return { success: false, error: `Unable to map cashier grid view (Vw_SalesPayModes/Vw_PayModes). ${mapErr}` };
    }
    const loc = pickCol(cols, ["LocCode", "Loc", "Location", "Outlet"]) as string;
    const date = pickCol(cols, ["Txndate", "TrnDate", "SalesDate", "BillDate"]) as string;
    const bill = pickCol(cols, ["BillNo", "BillNO", "Bill"]) as string;
    const payDes = pickCol(cols, ["PayDes", "PaymentDes", "PaymentDescription", "PayMode", "ModeDes", "PaymentMode", "Description"]) as string;
    const amount = pickCol(cols, ["ActAmt", "Amount", "PayAmount", "PayValue", "TenderedAmt", "SaleTotal", "Total", "Value"]) as string;
    const locDes = pickCol(cols, ["LocDes", "LocName", "LocationName"]);
    const payCode = pickCol(cols, ["PayCode", "PayModeCode", "ModeID", "PaymentCode"]);
    const donot = pickCol(cols, ["DoNotShowInSales"]);
    const cash = pickCol(cols, ["CashierID", "CasherID", "CASHIER", "Cashier", "CashierCode"]);
    const cashName = pickCol(cols, ["CashierName", "CasherName", "UserName"]);

    let cashiers: Array<{ id: string; des: string }> = [];
    if (cash) {
      const cr = await pool.request().query(
        `SELECT DISTINCT LTRIM(RTRIM(v.[${cash}])) AS CID, ${cashName ? `LTRIM(RTRIM(v.[${cashName}]))` : `LTRIM(RTRIM(v.[${cash}]))`} AS CDes FROM dbo.${view} v WITH (NOLOCK) WHERE LTRIM(RTRIM(v.[${cash}])) <> '' ORDER BY CID`
      );
      cashiers = (cr.recordset as Array<{ [k: string]: unknown }>).map((r) => ({ id: String(r.CID ?? ""), des: String(r.CDes ?? "") }));
    }

    const r0 = pool.request();
    r0.input("startDate", sql.DateTime2, new Date(startDate));
    r0.input("endDate", sql.DateTime2, new Date(`${endDate} 23:59:59`));
    if (outletId) r0.input("outletId", sql.VarChar(20), String(outletId));
    if (filters.cashier && cash) r0.input("cashier", sql.VarChar(20), String(filters.cashier));
    const result = await r0.query(`
      SELECT
        LTRIM(RTRIM(v.[${loc}])) AS LocCode,
        ${locDes ? `ISNULL(NULLIF(LTRIM(RTRIM(v.[${locDes}])), ''), LTRIM(RTRIM(v.[${loc}])))` : `LTRIM(RTRIM(v.[${loc}]))`} AS LocDes,
        CONVERT(varchar(10), v.[${date}], 103) AS BillDate,
        LTRIM(RTRIM(v.[${bill}])) AS BillNo,
        ${payCode ? `LTRIM(RTRIM(v.[${payCode}]))` : `LTRIM(RTRIM(v.[${payDes}]))`} AS PayCode,
        LTRIM(RTRIM(v.[${payDes}])) AS PayDes,
        ISNULL(v.[${amount}], 0) AS Amount,
        ${cash ? `LTRIM(RTRIM(v.[${cash}]))` : `''`} AS Cashier,
        ${cashName ? `LTRIM(RTRIM(v.[${cashName}]))` : `''`} AS CashierName
      FROM dbo.${view} v WITH (NOLOCK)
      WHERE v.[${date}] >= @startDate AND v.[${date}] < DATEADD(day, 1, @endDate)
        ${donot ? `AND ISNULL(v.[${donot}], 0) <> 1` : ""}
        ${outletId ? `AND LTRIM(RTRIM(v.[${loc}])) = @outletId` : ""}
        ${filters.cashier && cash ? `AND LTRIM(RTRIM(v.[${cash}])) = @cashier` : ""}
      ORDER BY v.[${loc}], Cashier, v.[${bill}]
    `);

    const r2 = (n: number) => Math.round(n * 100) / 100;
    type GB = { billNo: string; date: string; cells: Map<string, number>; total: number };
    const grpMap = new Map<string, { key: string; locCode: string; locName: string; modes: Map<string, { code: string; total: number }>; bills: GB[]; locTotal: number }>();
    for (const row of result.recordset as Array<{ [k: string]: unknown }>) {
      const str = (k: string) => String(row[k] ?? "");
      const lc = str("LocCode");
      const cs = str("Cashier");
      const key = cs ? `${lc}·${cs}` : lc;
      let G = grpMap.get(key);
      if (!G) {
        G = {
          key,
          locCode: key,
          locName: cs ? `${str("LocDes")} · ${cs}${str("CashierName") && str("CashierName") !== cs ? ` ${str("CashierName")}` : ""}` : str("LocDes"),
          modes: new Map(),
          bills: [],
          locTotal: 0,
        };
        grpMap.set(key, G);
      }
      const modeKey = str("PayDes") || str("PayCode");
      let B = G.bills.find((b) => b.billNo === str("BillNo"));
      if (!B) {
        B = { billNo: str("BillNo"), date: str("BillDate"), cells: new Map(), total: 0 };
        G.bills.push(B);
      }
      const amt = r2(Number(row.Amount ?? 0));
      B.cells.set(modeKey, r2((B.cells.get(modeKey) ?? 0) + amt));
      B.total = r2(B.total + amt);
      let M = G.modes.get(modeKey);
      if (!M) { M = { code: str("PayCode"), total: 0 }; G.modes.set(modeKey, M); }
      M.total = r2(M.total + amt);
      G.locTotal = r2(G.locTotal + amt);
    }
    const locationGroups = Array.from(grpMap.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((G) => {
        const payModes = Array.from(G.modes.entries())
          .sort((a, b) => (a[1].code === b[1].code ? a[0].localeCompare(b[0]) : a[1].code.localeCompare(b[1].code)))
          .map(([name]) => name);
        const modeTotals: Record<string, number> = {};
        for (const [name, m] of G.modes) modeTotals[name] = m.total;
        return {
          locCode: G.locCode,
          locName: G.locName,
          payModes,
          bills: G.bills.map((b) => ({ billNo: b.billNo, date: b.date, cells: Object.fromEntries(b.cells), total: b.total })),
          modeTotals,
          locTotal: G.locTotal,
        };
      });
    const cashSel = cashiers.find((c) => c.id === filters.cashier);
    return {
      success: true,
      data: {
        locationGroups,
        grandTotal: r2(locationGroups.reduce((s, l) => s + l.locTotal, 0)),
        cashiers,
        cashierFilter: cashSel ? `${cashSel.id} ${cashSel.des}` : filters.cashier || null,
      },
    };
  } catch (error) {
    console.error("Cashier Breakdown Grid Action Error:", error);
    return actionError(error);
  }
}
