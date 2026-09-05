// ============================================================
// Bill data service — fetches a bill from MSSQL (SERVER ONLY)
//
// Tables used:
//   Tbl_BillHeader  → bill meta + totals
//   Tbl_BillDetails → line items (joined with Tbl_MenuItems for names)
//   Tbl_BillPayTxn  → payments (status + "paid via" info)
//
// NOTE: single-location setup — lookup is by BillNo only.
//       If multiple locations are added later, include LocCode
//       in the encrypted link and filter by it here.
// ============================================================
import sql from "mssql";
import { getPool } from "./db";
import { formatTime12h, ORDER_MODE_FALLBACK } from "./billFormat";
import type { Bill, BillPayment, BillItem } from "./billFormat";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const s = (v: unknown): string => (v == null ? "" : String(v).trim());

const BILL_QUERY = `
SET NOCOUNT ON;

SELECT TOP 1
  LTRIM(RTRIM(h.BillNo))              AS BillNo,
  CONVERT(varchar(20), h.Txndate, 107) AS TxnDateStr,
  CONVERT(varchar(12), h.Txndate, 114) AS TxnTime,
  CONVERT(varchar(12), h.TxnTime, 114) AS TxnTimeCol,
  h.Gross, h.DisPre, h.DisVal, h.GrossAfterDis,
  h.SerChg, h.OtherSerChg, h.VAT, h.TDL, h.PackChg, h.DelChg,
  h.OtherVAT, h.NetTotal, h.DeleveryAreaChg,
  LTRIM(RTRIM(h.CasherID)) AS CasherID,
  LTRIM(RTRIM(h.StewID))   AS StewID,
  ISNULL(NULLIF(LTRIM(RTRIM(su.UserName)), ''), LTRIM(RTRIM(h.StewID)))   AS StewName,
  ISNULL(NULLIF(LTRIM(RTRIM(cu.UserName)), ''), LTRIM(RTRIM(h.CasherID))) AS CasherName,
  LTRIM(RTRIM(h.VatCusName)) AS VatCusName,
  LTRIM(RTRIM(h.VatCusID))   AS VatCusID,
  LTRIM(RTRIM(h.OrderMode))  AS OrderMode,
  LTRIM(RTRIM(h.LocCode))    AS LocCode,
  ISNULL(NULLIF(LTRIM(RTRIM(l.LocDes)), ''), LTRIM(RTRIM(h.LocCode))) AS LocDes,
  ISNULL(NULLIF(LTRIM(RTRIM(om.ModeDes)), ''), LTRIM(RTRIM(h.OrderMode))) AS OrderModeDes,
  h.NOPax,
  LTRIM(RTRIM(h.TableNo))  AS TableNo,
  h.BillType, h.DoNotShowInSales
FROM Tbl_BillHeader h WITH (NOLOCK)
LEFT JOIN Tbl_LocationMaster l WITH (NOLOCK)
  ON LTRIM(RTRIM(l.LocCode)) = LTRIM(RTRIM(h.LocCode))
LEFT JOIN Tbl_OrderModes om WITH (NOLOCK)
  ON LTRIM(RTRIM(om.ModeID)) = LTRIM(RTRIM(h.OrderMode))
LEFT JOIN Tbl_UserDetails su WITH (NOLOCK)
  ON LTRIM(RTRIM(su.UserId)) = LTRIM(RTRIM(h.StewID))
LEFT JOIN Tbl_UserDetails cu WITH (NOLOCK)
  ON LTRIM(RTRIM(cu.UserId)) = LTRIM(RTRIM(h.CasherID))
WHERE LTRIM(RTRIM(h.BillNo)) = @billNo;

SELECT
  LTRIM(RTRIM(d.SubItmId)) AS SubItmId,
  d.Qty,
  d.SalesPrice,
  d.TotalItmPrice,
  ISNULL(
    NULLIF(LTRIM(RTRIM(m.MenuItmDes)), ''),
    ISNULL(NULLIF(LTRIM(RTRIM(m.PrintDes)), ''), LTRIM(RTRIM(d.SubItmId)))
  ) AS ItemName
FROM Tbl_BillDetails d WITH (NOLOCK)
LEFT JOIN Tbl_MenuItems m WITH (NOLOCK)
  ON LTRIM(RTRIM(m.MenuItmId)) = LTRIM(RTRIM(d.SubItmId))
WHERE LTRIM(RTRIM(d.BillNo)) = @billNo
ORDER BY d.KOTBOTNO, d.SubItmId;

SELECT
  LTRIM(RTRIM(p.PayCode)) AS PayCode,
  ISNULL(
    NULLIF(LTRIM(RTRIM(pm.PayDes)), ''),
    LTRIM(RTRIM(p.PayCode))
  ) AS PayName,
  p.TenderedAmt,
  p.ActAmt
FROM Tbl_BillPayTxn p WITH (NOLOCK)
LEFT JOIN Tbl_PaymentModes pm WITH (NOLOCK)
  ON LTRIM(RTRIM(pm.PayCode)) = LTRIM(RTRIM(p.PayCode))
WHERE LTRIM(RTRIM(p.BillNo)) = @billNo;
`;

interface HeaderRow {
  BillNo: string;
  TxnDateStr: string;
  TxnTime: string;
  TxnTimeCol: string;
  Gross: number;
  DisVal: number;
  GrossAfterDis: number;
  SerChg: number;
  OtherSerChg: number;
  VAT: number;
  TDL: number;
  PackChg: number;
  DelChg: number;
  OtherVAT: number;
  NetTotal: number;
  DeleveryAreaChg: number;
  CasherID: string;
  StewID: string;
  StewName: string;
  CasherName: string;
  LocCode: string;
  LocDes: string;
  OrderModeDes: string;
  VatCusName: string;
  VatCusID: string;
  OrderMode: string;
  NOPax: number;
  TableNo: string;
  DoNotShowInSales: boolean;
}

interface DetailRow {
  SubItmId: string;
  Qty: number;
  SalesPrice: number;
  TotalItmPrice: number;
  ItemName: string;
}

interface PayRow {
  PayCode: string;
  PayName: string;
  TenderedAmt: number;
  ActAmt: number;
}

export async function getBillFromDb(
  billNumber: string
): Promise<Bill | null> {
  const pool = await getPool();
  const request = pool.request();
  request.input("billNo", sql.VarChar(50), billNumber.trim());

  const result = await request.query(BILL_QUERY);
  const recordsets = result.recordsets as unknown as [
    HeaderRow[],
    DetailRow[],
    PayRow[]
  ];
  const [headerRows, detailRows, payRows] = recordsets;
  const header = headerRows[0];

  if (!header) return null;

  // ── Items ──
  const items: BillItem[] = detailRows.map((d) => {
    const qty = d.Qty ?? 1;
    return {
      name: s(d.ItemName),
      qty: Number.isInteger(qty) ? qty : round2(qty),
      unitPrice: round2(d.SalesPrice ?? 0),
      price: round2(d.TotalItmPrice ?? 0),
    };
  });

  // ── Totals breakdown ──
  const gross = round2(header.Gross ?? 0);
  const discount = round2(header.DisVal ?? 0);
  const serviceCharge = round2((header.SerChg ?? 0) + (header.OtherSerChg ?? 0));
  const tax = round2((header.VAT ?? 0) + (header.OtherVAT ?? 0));
  const tdl = round2(header.TDL ?? 0);
  const packingCharge = round2(header.PackChg ?? 0);
  const deliveryCharge = round2(
    (header.DelChg ?? 0) + (header.DeleveryAreaChg ?? 0)
  );
  const grandTotal = round2(header.NetTotal ?? 0);

  // Rounding difference (NetTotal vs computed breakdown)
  const computed =
    gross - discount + serviceCharge + tax + tdl + packingCharge + deliveryCharge;
  const roundingDiff = round2(grandTotal - computed);
  const rounding = Math.abs(roundingDiff) >= 0.005 ? roundingDiff : 0;

  // ── Payments / status ──
  const payments: BillPayment[] = payRows.map((p) => ({
    method: s(p.PayName) || s(p.PayCode) || "PAYMENT",
    amount: round2(p.ActAmt ?? 0),
  }));
  const paidTotal = payments.reduce((sum, p) => sum + p.amount, 0);

  const status: Bill["status"] = header.DoNotShowInSales
    ? "CANCELLED"
    : paidTotal + 0.05 >= grandTotal
      ? "PAID"
      : "PENDING";

  // ── Display meta ──
  const tableNo = s(header.TableNo);
  const serverName = s(header.StewID) || s(header.CasherID) || "—";

  return {
    billNumber: s(header.BillNo),
    tableName: tableNo ? `Table ${tableNo}` : "Table —",
    serverName,
    date: s(header.TxnDateStr),
    items,
    subtotal: round2(header.GrossAfterDis ?? gross),
    tax,
    tip: serviceCharge, // legacy-compat field (now shown as "Service Charge")
    grandTotal,
    status,
    gross,
    discount,
    serviceCharge,
    tdl,
    packingCharge,
    deliveryCharge,
    rounding,
    noOfPax: header.NOPax ? Math.round(header.NOPax) : undefined,
    payments: payments.length ? payments : undefined,
    time: formatTime12h(
      (() => {
        const t1 = s(header.TxnTime); // Txndate eke time part
        const t2 = s(header.TxnTimeCol); // TxnTime column eka
        if (t1 && !t1.startsWith("00:00")) return t1;
        if (t2 && !t2.startsWith("00:00")) return t2;
        return t1 || t2;
      })()
    ),
    stewardName: s(header.StewName) || undefined,
    cashierName: s(header.CasherName) || undefined,
    customerName: s(header.VatCusName) || undefined,
    customerPhone: s(header.VatCusID) || undefined,
    orderMode: s(header.OrderMode) || undefined,
    locationName: s(header.LocDes) || undefined,
    orderModeDes:
      s(header.OrderModeDes) !== s(header.OrderMode)
        ? s(header.OrderModeDes) // master table eken nam eka
        : (ORDER_MODE_FALLBACK[s(header.OrderMode).toUpperCase()] ??
          (s(header.OrderModeDes) || undefined)), // empty nam built-in fallback
  };
}
