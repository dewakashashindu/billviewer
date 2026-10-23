// ============================================================
// LOCATION: lib/orderService.ts
// Table lookups + live QR/web orders for the customer QR flow.
//
// Tables:
//   Tbl_Tables      (TableNo, TableGroup, Vaccant, Enable)
//   Tbl_TableGroup  (GroupID, GroupName)
//
// QR orders (written by lib/menuService.confirmOrder):
//   Tbl_HoldUpsCloudTempQR — staging queue (UserID = 'QR')
//   Tbl_HoldUpsCloud       — open orders already synced by POS
// ============================================================
import sql from "mssql";
import { getPool, isDbConfigured } from "@/lib/db";

const s = (v: unknown): string => (v == null ? "" : String(v).trim());

/* ─────────────────────────── table info ─────────────────────────── */

export interface OrderTableInfo {
  tableNo: string;
  tableGroup: string;
  groupId: string;
  vacant: boolean;
  area: string;
  source: "database" | "mock";
}

function mockTableInfo(tableNo: string): OrderTableInfo {
  const known: Record<string, string> = {
    "T-01": "Main Dining Area",
    "T-02": "Main Dining Area",
    "VIP-01": "VIP Room",
    "R-01": "Rooftop",
    "O-01": "Outdoor",
  };
  const group = known[tableNo.trim()] ?? "Main Dining Area";
  return {
    tableNo: tableNo.trim(),
    tableGroup: group,
    groupId: `G-${group.replace(/\s+/g, "-").toLowerCase()}`,
    vacant: true,
    area: group,
    source: "mock",
  };
}

/**
 * Read one table from the DB. Returns null when the table does
 * not exist or is disabled — the caller turns that into a
 * "scan the QR again" message.
 */
export async function getOrderTableInfo(
  tableNo: string
): Promise<OrderTableInfo | null> {
  const table = s(tableNo);
  if (!table) return null;
  if (!isDbConfigured()) return mockTableInfo(table);

  const pool = await getPool();
  const req = pool.request();
  req.input("table", sql.VarChar(10), table);
  const res = await req.query(`
    SELECT
      LTRIM(RTRIM(t.TableNo))                      AS TableNo,
      LTRIM(RTRIM(ISNULL(t.TableGroup, '')))        AS TableGroup,
      LTRIM(RTRIM(ISNULL(t.Vaccant, 'Y')))          AS Vaccant,
      LTRIM(RTRIM(ISNULL(g.GroupID, '')))           AS GroupID,
      LTRIM(RTRIM(ISNULL(g.GroupName, '')))         AS GroupName
    FROM dbo.Tbl_Tables t WITH (NOLOCK)
    LEFT JOIN dbo.Tbl_TableGroup g WITH (NOLOCK)
      ON LTRIM(RTRIM(g.GroupID))   = LTRIM(RTRIM(t.TableGroup))
      OR LTRIM(RTRIM(g.GroupName)) = LTRIM(RTRIM(t.TableGroup))
    WHERE LTRIM(RTRIM(t.TableNo)) = @table AND t.Enable = 1;
  `);

  if (!res.recordset.length) return null;
  const r = res.recordset[0];
  const vacantRaw = s(r.Vaccant).toUpperCase();
  const rawGroup = s(r.TableGroup);
  const groupName = s(r.GroupName);
  return {
    tableNo: s(r.TableNo),
    tableGroup: groupName || rawGroup || "Main Dining",
    groupId: s(r.GroupID) || rawGroup,
    vacant: vacantRaw === "Y" || vacantRaw === "1" || vacantRaw === "",
    area: groupName || rawGroup || "Main Dining",
    source: "database",
  };
}

/* ───────────────────────── live web orders ───────────────────────── */

export interface LiveOrderLine {
  itemCode: string;
  name: string;
  qty: number;
  unitPrice: number;
  remark: string;
}

export interface LiveOrder {
  invoiceNo: string;
  orderNo?: string;
  locCode?: string;
  tableNo: string;
  tableGroup: string;
  orderType?: "DI" | "TA";
  customerName: string;
  customerPhone: string;
  pax: number;
  placedAt: string;
  lines: LiveOrderLine[];
  total: number;
}

export interface LiveOrdersResult {
  orders: LiveOrder[];
  source: "database" | "mock";
}

interface RawLiveRow {
  InvoiceNo: unknown;
  OrderNo?: unknown;
  LocCode?: unknown;
  TableNo: unknown;
  OrderType?: unknown;
  LPax: unknown;
  FPax?: unknown;
  CusName: unknown;
  CusCode: unknown;
  TxnDateTime: unknown;
  ItemCode: unknown;
  ItemName: unknown;
  QTY: unknown;
  SalesPrice: unknown;
  ItemRemarks: unknown;
}

/**
 * Open (unpaid) QR/web orders for the kitchen / staff view.
 */
export async function getLiveWebOrders(
  limit = 40
): Promise<LiveOrdersResult> {
  if (!isDbConfigured()) {
    return {
      source: "mock",
      orders: [
        {
          invoiceNo: "INV-DEMO-001",
          orderNo: "1",
          locCode: "001",
          tableNo: "T-05",
          tableGroup: "Main Dining Area",
          orderType: "DI",
          customerName: "Ajana",
          customerPhone: "0773464656",
          pax: 2,
          placedAt: new Date().toISOString(),
          lines: [
            { itemCode: "CFR1", name: "Chicken Fried Rice", qty: 1, unitPrice: 1600, remark: "less spicy" },
            { itemCode: "JUI1", name: "Fresh Lime Juice", qty: 2, unitPrice: 650, remark: "" },
          ],
          total: 2900,
        },
      ],
    };
  }

  const pool = await getPool();
  const maxRows = Math.min(200, Math.max(1, limit));
  const rawRows: RawLiveRow[] = [];

  // 1) Pending QR orders queued in dbo.Tbl_HoldUpsCloudTempQR
  try {
    const reqQr = pool.request();
    reqQr.input("limit", sql.Int, maxRows);
    const resQr = await reqQr.query(`
      SELECT TOP (@limit)
        LTRIM(RTRIM(q.InvoiceNo))  AS InvoiceNo,
        LTRIM(RTRIM(q.OrderNo))    AS OrderNo,
        LTRIM(RTRIM(q.LocCode))    AS LocCode,
        LTRIM(RTRIM(q.TabelNo))    AS TableNo,
        LTRIM(RTRIM(q.OrderType))  AS OrderType,
        ISNULL(q.LPax, 0)          AS LPax,
        ISNULL(q.FPax, 0)          AS FPax,
        ISNULL(q.CusName, '')      AS CusName,
        ISNULL(q.CusCode, '')      AS CusCode,
        q.TxnDateTime              AS TxnDateTime,
        LTRIM(RTRIM(q.ItemCode))   AS ItemCode,
        ISNULL(NULLIF(LTRIM(RTRIM(m.MenuItmDes)), ''), LTRIM(RTRIM(q.ItemCode))) AS ItemName,
        ISNULL(q.QTY, 0)           AS QTY,
        ISNULL(q.SalesPrice, 0)    AS SalesPrice,
        ISNULL(q.ItemRemarks, '')  AS ItemRemarks
      FROM dbo.Tbl_HoldUpsCloudTempQR q WITH (NOLOCK)
      LEFT JOIN dbo.Tbl_MenuItems m WITH (NOLOCK)
        ON m.MenuItmId = q.ItemCode
      WHERE ISNULL(q.IsPaid, 0) = 0
      ORDER BY q.TxnDateTime DESC, q.RowLine ASC;
    `);
    rawRows.push(...(resQr.recordset as RawLiveRow[]));
  } catch {
    /* Tbl_HoldUpsCloudTempQR optional until created */
  }

  // 2) Open QR/Web orders already imported by POS into dbo.Tbl_HoldUpsCloud
  try {
    const reqCloud = pool.request();
    reqCloud.input("limit", sql.Int, maxRows);
    const resCloud = await reqCloud.query(`
      SELECT TOP (@limit)
        LTRIM(RTRIM(h.InvoiceNo))  AS InvoiceNo,
        ''                         AS OrderNo,
        ''                         AS LocCode,
        LTRIM(RTRIM(h.TabelNo))    AS TableNo,
        LTRIM(RTRIM(ISNULL(h.OrderType, ''))) AS OrderType,
        ISNULL(h.LPax, 0)          AS LPax,
        ISNULL(h.FPax, 0)          AS FPax,
        ISNULL(h.CusName, '')      AS CusName,
        ISNULL(h.CusCode, '')      AS CusCode,
        h.TxnDateTime              AS TxnDateTime,
        LTRIM(RTRIM(h.ItemCode))   AS ItemCode,
        ISNULL(NULLIF(LTRIM(RTRIM(m.MenuItmDes)), ''), LTRIM(RTRIM(h.ItemCode))) AS ItemName,
        ISNULL(h.QTY, 0)           AS QTY,
        ISNULL(h.SalesPrice, 0)    AS SalesPrice,
        ISNULL(h.ItemRemarks, '')  AS ItemRemarks
      FROM dbo.Tbl_HoldUpsCloud h WITH (NOLOCK)
      LEFT JOIN dbo.Tbl_MenuItems m WITH (NOLOCK)
        ON m.MenuItmId = h.ItemCode
      WHERE ISNULL(h.IsPaid, 0) = 0
        AND UPPER(LTRIM(RTRIM(ISNULL(h.UserID, '')))) IN ('QR', 'WEB')
      ORDER BY h.TxnDateTime DESC, h.ItemCode;
    `);
    rawRows.push(...(resCloud.recordset as RawLiveRow[]));
  } catch {
    /* Tbl_HoldUpsCloud optional */
  }

  const groups = new Map<string, LiveOrder>();
  for (const r of rawRows) {
    const invoiceNo = s(r.InvoiceNo);
    if (!invoiceNo) continue;
    const ordNo = s(r.OrderNo);
    const loc = s(r.LocCode);
    const key = ordNo ? `${loc}|${invoiceNo}|ORD-${ordNo}` : `${loc}|${invoiceNo}`;
    let order = groups.get(key);
    if (!order) {
      const tableNo = s(r.TableNo);
      const rawType = s(r.OrderType).toUpperCase();
      const orderType: "DI" | "TA" =
        rawType === "TA" || /^TA(?:-|$)/i.test(tableNo) ? "TA" : "DI";
      const paxTotal = (Number(r.LPax ?? 0) || 0) + (Number(r.FPax ?? 0) || 0);
      order = {
        invoiceNo: ordNo ? `${invoiceNo} (#${ordNo})` : invoiceNo,
        orderNo: ordNo || undefined,
        locCode: loc || undefined,
        tableNo,
        tableGroup: orderType === "TA" ? "Takeaway" : "",
        orderType,
        customerName: s(r.CusName),
        customerPhone: s(r.CusCode),
        pax: paxTotal,
        placedAt: r.TxnDateTime ? new Date(r.TxnDateTime as string | Date).toISOString() : "",
        lines: [],
        total: 0,
      };
      groups.set(key, order);
    }
    const qty = Number(r.QTY ?? 0) || 0;
    const price = Number(r.SalesPrice ?? 0) || 0;
    order.lines.push({
      itemCode: s(r.ItemCode),
      name: s(r.ItemName) || s(r.ItemCode),
      qty,
      unitPrice: price,
      remark: s(r.ItemRemarks),
    });
    order.total += qty * price;
  }

  const tableNos = [...new Set([...groups.values()].map((o) => o.tableNo).filter(Boolean))];
  const groupOf = new Map<string, string>();
  if (tableNos.length) {
    try {
      const r2 = pool.request();
      const list = tableNos.map((t, i) => {
        r2.input(`t${i}`, sql.VarChar(20), t);
        return `@t${i}`;
      });
      const res2 = await r2.query(`
        SELECT LTRIM(RTRIM(TableNo)) AS TableNo, LTRIM(RTRIM(TableGroup)) AS TableGroup
        FROM dbo.Tbl_Tables WITH (NOLOCK)
        WHERE LTRIM(RTRIM(TableNo)) IN (${list.join(", ")});
      `);
      for (const row of res2.recordset) groupOf.set(s(row.TableNo), s(row.TableGroup));
    } catch {
      /* ignore */
    }
  }
  for (const o of groups.values()) {
    if (!o.tableGroup) o.tableGroup = groupOf.get(o.tableNo) ?? "";
  }

  const orders = [...groups.values()]
    .map((o) => ({
      ...o,
      total: Math.round(o.total * 100) / 100,
    }))
    .sort((a, b) => b.placedAt.localeCompare(a.placedAt));

  return { orders, source: "database" };
}
