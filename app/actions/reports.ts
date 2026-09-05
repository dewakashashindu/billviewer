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
  outletId?: number;
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
        ${outletId ? "AND LocCode = @outletId" : ""}
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
