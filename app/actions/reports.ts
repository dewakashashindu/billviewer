"use server";

// ============================================================
// Reports data — VW_SalesSummery view eken (mssql pool, lib/db.ts)
// View eka: Tbl_BillHeader + Tbl_LocationMaster + Tbl_UserDetails
// View name eka .env eken override: SALES_SUMMARY_VIEW
// ============================================================
import sql from "mssql";
import { getPool, isDbConfigured } from "@/lib/db";

export interface ReportFilter {
  startDate: string;
  endDate: string;
  outletId?: number | string;
}

const SUMMARY_VIEW = process.env.SALES_SUMMARY_VIEW || "VW_SalesSummery";

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
    if (!isDbConfigured()) {
      return {
        success: false,
        error: "Database not configured (DB_* env vars missing)",
      };
    }

    const { startDate, endDate, outletId } = filters;

    const pool = await getPool();
    const cols = await getViewColumns(pool);
    if (cols.size === 0) {
      return {
        success: false,
        error: `View 'dbo.${SUMMARY_VIEW}' not found in database`,
      };
    }

    // ── Column availability based expressions ──
    const has = (c: string) => cols.has(c);

    const localPaxExpr = has("LocalPax")
      ? "SUM(ISNULL(LocalPax, 0))"
      : has("NOPax")
        ? "SUM(ISNULL(NOPax, 0))"
        : "0";
    const foreignPaxExpr = has("ForiegnPax")
      ? "SUM(ISNULL(ForiegnPax, 0))"
      : "0";
    const taxParts = [
      has("VAT") ? "ISNULL(VAT, 0)" : null,
      has("TDL") ? "ISNULL(TDL, 0)" : null,
      has("OtherVAT") ? "ISNULL(OtherVAT, 0)" : null,
    ].filter(Boolean);
    const taxExpr = taxParts.length ? `SUM(${taxParts.join(" + ")})` : "0";

    const query = `
      SELECT
        CONVERT(varchar(10), Txndate, 23)     AS txnDate,
        COUNT(*)                              AS bills,
        ${localPaxExpr}                       AS localPax,
        ${foreignPaxExpr}                     AS foreignPax,
        SUM(ISNULL(NetTotal, 0))              AS totalSales,
        ${has("SalesWOTAX") ? "SUM(ISNULL(SalesWOTAX, 0))" : "0"} AS salesWOT,
        ${taxExpr}                            AS taxAmount,
        SUM(ISNULL(GrossAfterDis, 0))         AS grossAfterDis,
        SUM(ISNULL(DisVal, 0))                AS discount,
        SUM(ISNULL(SerChg, 0))                AS serviceCharge,
        SUM(ISNULL(PackChg, 0))               AS packing,
        SUM(ISNULL(DelChg, 0))                AS delivery
      FROM dbo.${SUMMARY_VIEW} WITH (NOLOCK)
      WHERE Txndate >= @startDate
        AND Txndate < DATEADD(day, 1, @endDate)
        ${outletId ? "AND LTRIM(RTRIM(LocCode)) = @outletId" : ""}
      GROUP BY CONVERT(varchar(10), Txndate, 23)
      ORDER BY txnDate ASC
    `;

    const req = pool.request();
    req.input("startDate", sql.DateTime2, new Date(startDate));
    req.input("endDate", sql.DateTime2, new Date(endDate));
    if (outletId) req.input("outletId", sql.VarChar(20), String(outletId));

    const result = await req.query(query);

    const rows = result.recordset.map((row: any) => {
      const bills = row.bills || 1;
      const localPax = row.localPax || 0;
      const foreignPax = row.foreignPax || 0;
      const totalPax = localPax + foreignPax;
      const totalSales = row.totalSales || 0;

      return {
        txnDate: row.txnDate,
        bills,
        localPax,
        foreignPax,
        totalPax,
        spendingPerBill: totalSales / bills,
        spendingPerPax: totalPax > 0 ? totalSales / totalPax : 0,
        avgPaxPerBill: totalPax / bills,
        avgTimePerBill: "0:00:00",
        foodSales: 0, // TODO: SalesDept breakdown one nam kiyanna
        beverageSales: 0,
        sigarSales: 0,
        otherSales: 0,
        salesSupp: 0,
        salesWOT: row.salesWOT || 0,
        taxVolume: row.taxAmount || 0,
        salesVolume: totalSales,
        grossAfterDis: row.grossAfterDis || 0,
        discount: row.discount || 0,
        serviceCharge: row.serviceCharge || 0,
        packing: row.packing || 0,
        delivery: row.delivery || 0,
      };
    });

    return { success: true, data: rows };
  } catch (error) {
    console.error("Report Action Error:", error);
    return { success: false, error: "Database Data Fetching Failed." };
  }
}

// ============================================================
// Sales Summary (bill-wise) — POS "Sales Summery" PDF eka wage
// Bill-level rows VW_SalesSummery eken → date eken group wenawa
// ============================================================
export async function getSalesSummaryAction(filters: ReportFilter) {
  try {
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
    const cols = new Set(colsRes.recordset.map((r: any) => String(r.name)));
    if (cols.size === 0) {
      return {
        success: false,
        error: `View 'dbo.${SUMMARY_VIEW}' not found in database`,
      };
    }

    const req = pool.request();
    req.input("startDate", sql.DateTime2, new Date(startDate));
    req.input("endDate", sql.DateTime2, new Date(`${endDate} 23:59:59`));
    if (outletId) req.input("outletId", sql.VarChar(20), String(outletId));

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
        ${outletId ? "AND LTRIM(RTRIM(v.LocCode)) = @outletId" : ""}
      ORDER BY v.Txndate, v.BillNo
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

    let location = "";
    const groupMap = new Map<string, { rows: any[]; dayTotal: number }>();

    for (const row of result.recordset as any[]) {
      if (!location) {
        // code eka pennanne neha — name eka witharai (fallback: code eka)
        location =
          String(row.LocDes ?? "").trim() ||
          String(row.LocCode ?? "").trim();
      }

      const txnd: Date =
        row.Txndate instanceof Date ? row.Txndate : new Date(row.Txndate);
      const key = dayStr(txnd);
      if (!groupMap.has(key)) groupMap.set(key, { rows: [], dayTotal: 0 });
      const g = groupMap.get(key)!;

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
    }

    const dateGroups = Array.from(groupMap.entries()).map(([date, g]) => ({
      date,
      ...g,
    }));
    const grandTotal = r2(dateGroups.reduce((s, g) => s + g.dayTotal, 0));

    return { success: true, data: { location, dateGroups, grandTotal } };
  } catch (error) {
    console.error("Sales Summary Action Error:", error);
    return { success: false, error: "Database Data Fetching Failed." };
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
    if (!isDbConfigured()) {
      return {
        success: false,
        error: "Database not configured (DB_* env vars missing)",
      };
    }

    const { startDate, endDate, outletId } = filters;
    const pool = await getPool();
    const req = pool.request();
    req.input("startDate", sql.VarChar(10), startDate);
    req.input("endDate", sql.VarChar(10), endDate);
    if (outletId)
      req.input("outletId", sql.VarChar(20), String(outletId));

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
        AND ISNULL(h.DoNotShowInSales, 0) = 0
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
    return { success: false, error: "Database Data Fetching Failed." };
  }
}

// ============================================================
// Locations — Tbl_LocationMaster (date-range popup eke dropdown eka)
// ============================================================
export async function getLocationsAction() {
  try {
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
    return { success: false, error: "Database Data Fetching Failed." };
  }
}
