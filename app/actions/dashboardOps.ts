"use server";

// ============================================================
// LOCATION: app/actions/dashboardOps.ts     (ALUTH FILE)
//
// Dashboard → "Live" tab ekata data:
//   getDashboardOpsAction({ from, to, loc })
//     → Tbl_BillHeader + Tbl_BillDetails + Tbl_BillPayTxn
//     → hourly / pay modes / order modes / bill types / top items /
//       cashiers / heatmap / totals
//
// Rules:
//   • dan thiyena dashboard action ekata (Tbl_PerformanceValues) kisi
//     sambandhayak nathiwa wada karanawa — eka wenas karala naha
//   • SQL Server 2008 R2 / compat level 100 safe (TRY_CONVERT / IIF nathi)
//   • DB configure wela nattam demo data (dev preview ekata)
//   • query ekak fail unoth ANITH queries okkoma wada karanawa (safe())
//   • `loc` = Tbl_BillHeader.LocCode; empty / "ALL" = all locations
// ============================================================
import sql from "mssql";
import { getPool, isDbConfigured } from "@/lib/db";
import { requireSession, actionError } from "@/lib/actionAuth";
import { demoOps } from "@/components/dashboard/demoData";

/* ───────────────────────── types ───────────────────────── */
export interface OpsRange {
  /** YYYY-MM-DD (local business date) */
  from: string;
  to: string;
  /** Tbl_BillHeader.LocCode — empty / "ALL" = all locations */
  loc?: string;
}

export interface OpsLocation {
  code: string;
  name: string;
}

export interface NameAmt {
  name: string;
  amt: number;
}

export interface HourPoint {
  hour: number;
  net: number;
  bills: number;
  pax: number;
}

export interface HeatCell {
  day: string; // YYYY-MM-DD
  hour: number;
  net: number;
}

export interface DashboardOpsData {
  from: string;
  to: string;
  loc: string;
  locations: OpsLocation[];
  totals: {
    net: number;
    gross: number;
    discount: number;
    serviceCharge: number;
    vat: number;
    tdl: number;
    bills: number;
    pax: number;
    avgBill: number;
    avgPax: number;
  };
  hourly: HourPoint[];
  payModes: NameAmt[];
  orderModes: NameAmt[];
  billTypes: NameAmt[];
  topItemsRev: NameAmt[];
  topItemsQty: NameAmt[];
  cashiers: NameAmt[];
  heat: HeatCell[];
  days: string[];
}

export interface OpsResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  /** true = DB nathiwa demo data (dev preview) */
  demo?: boolean;
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const str = (v: unknown) => (v == null ? "" : String(v).trim());
const num = (v: unknown) => Number(v) || 0;

/** query ekak error unoth section eka kadenne nathiwa fallback ekak denawa */
async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[dashboardOps] ${label} failed:`, e);
    return fallback;
  }
}

const NOT_HIDDEN = `ISNULL(LTRIM(RTRIM(h.DoNotShowInSales)), '0') <> '1'`;

/** location filter — empty / ALL nam all locations */
const locWhere = (loc?: string) =>
  loc && loc.trim().toUpperCase() !== "ALL" ? "AND LTRIM(RTRIM(h.LocCode)) = @loc" : "";

function bindLoc(req: sql.Request, loc?: string) {
  if (loc && loc.trim().toUpperCase() !== "ALL") {
    req.input("loc", sql.NVarChar(20), loc.trim());
  }
}

/**
 * `TxnTime` column eke type eka anuwa hour eka ganna SQL expression eka.
 * POS eke thanak `datetime`, thanak `char` ('10:45') — dekama support karanawa.
 */
async function hourExpression(
  pool: sql.ConnectionPool,
  table: string,
  column: string,
  alias: string
): Promise<string> {
  const typeName = await safe<string>(
    "hourExpression",
    async () => {
      const r = await pool
        .request()
        .input("obj", sql.NVarChar(200), `dbo.${table}`)
        .input("col", sql.NVarChar(200), column)
        .query(
          `SELECT TOP 1 TYPE_NAME(c.user_type_id) AS t
             FROM sys.columns c
            WHERE c.object_id = OBJECT_ID(@obj) AND c.name = @col`
        );
      return str(r.recordset[0]?.t).toLowerCase();
    },
    ""
  );

  if (typeName.includes("date") || typeName.includes("time")) {
    return `DATEPART(hour, ${alias}.${column})`;
  }
  const txt = `LTRIM(RTRIM(${alias}.${column}))`;
  return `CASE WHEN ISNUMERIC(SUBSTRING(${txt}, 1, 2)) = 1
                THEN CAST(SUBSTRING(${txt}, 1, 2) AS int) END`;
}

/** SubLoc flag eka kiyawana widiya (bit / int / char / varchar okkoma) */
function isSubLocationFlag(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0;
  const t = String(val).trim().toLowerCase();
  if (!t || t === "0" || t === "0.0" || t === "false" || t === "n" || t === "no") return false;
  if (t === "1" || t === "1.0" || t === "true" || t === "y" || t === "yes") return true;
  return false;
}

/**
 * Live tab eke location list = MAIN LOCATIONS only:
 *   Tbl_LocationMaster WHERE SubLoc = 0 / false
 *   (e.g. MILLA MIRISSA, TUANA). Sub-locations (KITCHEN, BAR,
 *   FOOD AND BEV AREA) dropdown eke penenne NAHA.
 *
 * `SubLoc` column eka nattam (schema eken) fallback widiyata okkoma denawa.
 */
async function loadLocations(pool: sql.ConnectionPool): Promise<OpsLocation[]> {
  return safe<OpsLocation[]>(
    "locations",
    async () => {
      const r = await pool.request().query(`
        SELECT LTRIM(RTRIM(LocCode)) AS code,
               ISNULL(NULLIF(LTRIM(RTRIM(LocDes)), ''), LTRIM(RTRIM(LocCode))) AS name,
               SubLoc
          FROM Tbl_LocationMaster WITH (NOLOCK)
         ORDER BY LocCode`);

      const rows = r.recordset as Record<string, unknown>[];
      const subKey = rows.length
        ? Object.keys(rows[0]).find((k) => k.toLowerCase() === "subloc")
        : undefined;

      const all: OpsLocation[] = [];
      const mains: OpsLocation[] = [];
      const seenAll = new Set<string>();
      const seenMain = new Set<string>();

      for (const row of rows) {
        const code = str(row.code);
        if (!code) continue;
        const name = str(row.name) || code;
        const key = code.toUpperCase();

        if (!seenAll.has(key)) {
          seenAll.add(key);
          all.push({ code, name });
        }
        const isSub = subKey ? isSubLocationFlag(row[subKey]) : false;
        if (!isSub && !seenMain.has(key)) {
          seenMain.add(key);
          mains.push({ code, name });
        }
      }

      const byName = (a: OpsLocation, b: OpsLocation) => a.name.localeCompare(b.name);
      // MAIN locations (SubLoc = false) witharai; column eka nattam okkoma (fallback)
      return (mains.length > 0 ? mains : all).sort(byName);
    },
    [] as OpsLocation[]
  );
}

/* ═══════════════════════════════════════════════════════════
   LIVE — sales / payments / items
   ═══════════════════════════════════════════════════════════ */
export async function getDashboardOpsAction(
  range: OpsRange
): Promise<OpsResult<DashboardOpsData>> {
  try {
    await requireSession();
    const from = str(range?.from);
    const to = str(range?.to) || from;
    const loc = str(range?.loc);
    if (!from) return { success: false, error: "Date range required" };

    if (!isDbConfigured()) {
      return { success: true, demo: true, data: demoOps(from, to, loc) };
    }

    const pool = await getPool();
    const locations = await loadLocations(pool);
    const hr = await hourExpression(pool, "Tbl_BillHeader", "TxnTime", "h");
    const LOC = locWhere(loc);

    const newReq = () => {
      const req = pool.request();
      req.input("from", sql.NVarChar(10), from);
      req.input("to", sql.NVarChar(10), to);
      bindLoc(req, loc);
      return req;
    };

    /* ── hourly ── */
    const hourly = await safe<HourPoint[]>(
      "hourly",
      async () => {
        const r = await newReq().query(`
          SELECT ${hr} AS hr,
                 SUM(ISNULL(h.NetTotal, 0)) AS net,
                 COUNT(*) AS bills,
                 SUM(ISNULL(h.NOPax, 0)) AS pax
            FROM Tbl_BillHeader h WITH (NOLOCK)
           WHERE h.Txndate >= @from
             AND h.Txndate < DATEADD(day, 1, @to)
             AND ${NOT_HIDDEN}
             ${LOC}
           GROUP BY ${hr}
           ORDER BY hr`);
        return r.recordset.map((row) => {
          const o = row as Record<string, unknown>;
          return {
            hour: num(o.hr),
            net: round2(num(o.net)),
            bills: num(o.bills),
            pax: num(o.pax),
          };
        });
      },
      [] as HourPoint[]
    );

    /* ── totals ── */
    const totals = await safe(
      "totals",
      async () => {
        const r = await newReq().query(`
          SELECT SUM(ISNULL(h.Gross, 0)) AS gross,
                 SUM(ISNULL(h.DisVal, 0)) AS discount,
                 SUM(ISNULL(h.SerChg, 0) + ISNULL(h.OtherSerChg, 0)) AS sc,
                 SUM(ISNULL(h.VAT, 0) + ISNULL(h.OtherVAT, 0)) AS vat,
                 SUM(ISNULL(h.TDL, 0)) AS tdl,
                 SUM(ISNULL(h.NetTotal, 0)) AS net,
                 COUNT(*) AS bills,
                 SUM(ISNULL(h.NOPax, 0)) AS pax
            FROM Tbl_BillHeader h WITH (NOLOCK)
           WHERE h.Txndate >= @from
             AND h.Txndate < DATEADD(day, 1, @to)
             AND ${NOT_HIDDEN}
             ${LOC}`);
        const row = (r.recordset[0] ?? {}) as Record<string, unknown>;
        const bills = num(row.bills);
        const pax = num(row.pax);
        const net = round2(num(row.net));
        return {
          net,
          gross: round2(num(row.gross)),
          discount: round2(num(row.discount)),
          serviceCharge: round2(num(row.sc)),
          vat: round2(num(row.vat)),
          tdl: round2(num(row.tdl)),
          bills,
          pax,
          avgBill: bills ? round2(net / bills) : 0,
          avgPax: bills ? round2(pax / bills) : 0,
        };
      },
      {
        net: 0,
        gross: 0,
        discount: 0,
        serviceCharge: 0,
        vat: 0,
        tdl: 0,
        bills: 0,
        pax: 0,
        avgBill: 0,
        avgPax: 0,
      }
    );

    /* ── payment modes ── */
    const payModes = await safe<NameAmt[]>(
      "payModes",
      async () => {
        const r = await newReq().query(`
          SELECT ISNULL(NULLIF(LTRIM(RTRIM(pm.PayDes)), ''), LTRIM(RTRIM(p.PayCode))) AS name,
                 SUM(ISNULL(p.ActAmt, 0)) AS amt
            FROM Tbl_BillPayTxn p WITH (NOLOCK)
            INNER JOIN Tbl_BillHeader h WITH (NOLOCK)
              ON LTRIM(RTRIM(h.BillNo)) = LTRIM(RTRIM(p.BillNo))
            LEFT JOIN Tbl_PaymentModes pm WITH (NOLOCK)
              ON LTRIM(RTRIM(pm.PayCode)) = LTRIM(RTRIM(p.PayCode))
           WHERE h.Txndate >= @from
             AND h.Txndate < DATEADD(day, 1, @to)
             AND ${NOT_HIDDEN}
             ${LOC}
           GROUP BY ISNULL(NULLIF(LTRIM(RTRIM(pm.PayDes)), ''), LTRIM(RTRIM(p.PayCode)))
           ORDER BY amt DESC`);
        return r.recordset.map((row) => {
          const o = row as Record<string, unknown>;
          return { name: str(o.name) || "(unknown)", amt: round2(num(o.amt)) };
        });
      },
      [] as NameAmt[]
    );

    /* ── order modes ── */
    const orderModes = await safe<NameAmt[]>(
      "orderModes",
      async () => {
        const r = await newReq().query(`
          SELECT ISNULL(NULLIF(LTRIM(RTRIM(om.ModeDes)), ''), LTRIM(RTRIM(h.OrderMode))) AS name,
                 SUM(ISNULL(h.NetTotal, 0)) AS amt
            FROM Tbl_BillHeader h WITH (NOLOCK)
            LEFT JOIN Tbl_OrderModes om WITH (NOLOCK)
              ON LTRIM(RTRIM(om.ModeID)) = LTRIM(RTRIM(h.OrderMode))
           WHERE h.Txndate >= @from
             AND h.Txndate < DATEADD(day, 1, @to)
             AND ${NOT_HIDDEN}
             ${LOC}
           GROUP BY ISNULL(NULLIF(LTRIM(RTRIM(om.ModeDes)), ''), LTRIM(RTRIM(h.OrderMode)))
           ORDER BY amt DESC`);
        return r.recordset.map((row) => {
          const o = row as Record<string, unknown>;
          return { name: str(o.name) || "(unknown)", amt: round2(num(o.amt)) };
        });
      },
      [] as NameAmt[]
    );

    /* ── bill types ── */
    const billTypes = await safe<NameAmt[]>(
      "billTypes",
      async () => {
        const r = await newReq().query(`
          SELECT ISNULL(NULLIF(LTRIM(RTRIM(h.BillType)), ''), '(none)') AS name,
                 SUM(ISNULL(h.NetTotal, 0)) AS amt
            FROM Tbl_BillHeader h WITH (NOLOCK)
           WHERE h.Txndate >= @from
             AND h.Txndate < DATEADD(day, 1, @to)
             AND ${NOT_HIDDEN}
             ${LOC}
           GROUP BY ISNULL(NULLIF(LTRIM(RTRIM(h.BillType)), ''), '(none)')
           ORDER BY amt DESC`);
        return r.recordset.map((row) => {
          const o = row as Record<string, unknown>;
          return { name: str(o.name) || "(none)", amt: round2(num(o.amt)) };
        });
      },
      [] as NameAmt[]
    );

    /* ── items (revenue + qty) ── */
    const itemBase = `
        SELECT ISNULL(NULLIF(LTRIM(RTRIM(m.MenuItmDes)), ''), LTRIM(RTRIM(d.SubItmId))) AS name,
               SUM(ISNULL(d.Qty, 0)) AS qty,
               SUM(ISNULL(d.TotalItmPrice, 0)) AS amt
          FROM Tbl_BillDetails d WITH (NOLOCK)
          INNER JOIN Tbl_BillHeader h WITH (NOLOCK)
            ON LTRIM(RTRIM(h.BillNo)) = LTRIM(RTRIM(d.BillNo))
          LEFT JOIN Tbl_MenuItems m WITH (NOLOCK)
            ON LTRIM(RTRIM(m.MenuItmId)) = LTRIM(RTRIM(d.SubItmId))
         WHERE h.Txndate >= @from
           AND h.Txndate < DATEADD(day, 1, @to)
           AND ${NOT_HIDDEN}
           ${LOC}
         GROUP BY ISNULL(NULLIF(LTRIM(RTRIM(m.MenuItmDes)), ''), LTRIM(RTRIM(d.SubItmId)))`;

    const topItemsRev = await safe<NameAmt[]>(
      "topItemsRev",
      async () => {
        const r = await newReq().query(`SELECT TOP 10 name, amt FROM (${itemBase}) t ORDER BY amt DESC`);
        return r.recordset.map((row) => {
          const o = row as Record<string, unknown>;
          return { name: str(o.name) || "(item)", amt: round2(num(o.amt)) };
        });
      },
      [] as NameAmt[]
    );

    const topItemsQty = await safe<NameAmt[]>(
      "topItemsQty",
      async () => {
        const r = await newReq().query(`SELECT TOP 10 name, qty FROM (${itemBase}) t ORDER BY qty DESC`);
        return r.recordset.map((row) => {
          const o = row as Record<string, unknown>;
          return { name: str(o.name) || "(item)", amt: round2(num(o.qty)) };
        });
      },
      [] as NameAmt[]
    );

    /* ── cashiers ── */
    const cashiers = await safe<NameAmt[]>(
      "cashiers",
      async () => {
        const r = await newReq().query(`
          SELECT ISNULL(NULLIF(LTRIM(RTRIM(u.UserName)), ''), LTRIM(RTRIM(h.CasherID))) AS name,
                 SUM(ISNULL(h.NetTotal, 0)) AS amt
            FROM Tbl_BillHeader h WITH (NOLOCK)
            LEFT JOIN Tbl_UserDetails u WITH (NOLOCK)
              ON LTRIM(RTRIM(u.UserId)) = LTRIM(RTRIM(h.CasherID))
           WHERE h.Txndate >= @from
             AND h.Txndate < DATEADD(day, 1, @to)
             AND ${NOT_HIDDEN}
             ${LOC}
           GROUP BY ISNULL(NULLIF(LTRIM(RTRIM(u.UserName)), ''), LTRIM(RTRIM(h.CasherID)))
           ORDER BY amt DESC`);
        return r.recordset.map((row) => {
          const o = row as Record<string, unknown>;
          return { name: str(o.name) || "(cashier)", amt: round2(num(o.amt)) };
        });
      },
      [] as NameAmt[]
    );

    /* ── heatmap (day × hour) ── */
    const heat = await safe<HeatCell[]>(
      "heat",
      async () => {
        const r = await newReq().query(`
          SELECT CONVERT(char(10), h.Txndate, 120) AS day,
                 ${hr} AS hr,
                 SUM(ISNULL(h.NetTotal, 0)) AS net
            FROM Tbl_BillHeader h WITH (NOLOCK)
           WHERE h.Txndate >= @from
             AND h.Txndate < DATEADD(day, 1, @to)
             AND ${NOT_HIDDEN}
             ${LOC}
           GROUP BY CONVERT(char(10), h.Txndate, 120), ${hr}`);
        return r.recordset.map((row) => {
          const o = row as Record<string, unknown>;
          return { day: str(o.day), hour: num(o.hr), net: round2(num(o.net)) };
        });
      },
      [] as HeatCell[]
    );

    const days = Array.from(new Set(heat.map((h) => h.day).filter(Boolean))).sort();

    return {
      success: true,
      data: {
        from,
        to,
        loc,
        locations,
        totals,
        hourly,
        payModes,
        orderModes,
        billTypes,
        topItemsRev,
        topItemsQty,
        cashiers,
        heat,
        days,
      },
    };
  } catch (error) {
    console.error("DashboardOps Action Error:", error);
    return actionError(error) as OpsResult<DashboardOpsData>;
  }
}
