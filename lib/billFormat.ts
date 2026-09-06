// ============================================================
// Shared bill types + formatting helpers
// (Client-safe — DO NOT import mssql / server-only stuff here)
// ============================================================

export interface BillItem {
  name: string;
  price: number;
  qty?: number; // line quantity (real DB bills)
  unitPrice?: number; // per-unit price (real DB bills)
}

export interface BillPayment {
  method: string;
  amount: number;
}

export interface Bill {
  billNumber: string;
  tableName: string;
  serverName: string;
  date: string;
  items: BillItem[];
  subtotal: number;
  tax: number;
  tip: number;
  grandTotal: number;
  status: "PAID" | "PENDING" | "CANCELLED";

  // ── Extended fields (populated for real DB bills) ──
  gross?: number;
  discount?: number;
  discountPre?: number;
  serviceCharge?: number;
  tdl?: number;
  packingCharge?: number;
  deliveryCharge?: number;
  rounding?: number;
  noOfPax?: number;
  payments?: BillPayment[];

  // ── Receipt-style fields (real DB bills) ──
  time?: string; // "5:30 PM"
  stewardName?: string; // StewID
  cashierName?: string; // CasherID
  customerName?: string; // VatCusName
  customerPhone?: string; // VatCusID
  orderMode?: string; // raw code e.g. "TA"
  locationName?: string; // Tbl_LocationMaster.LocDes (branch name)
  orderModeDes?: string; // Tbl_OrderModes.ModeDes (e.g. "Take Away")
}

// ============================================================
// ✏️ RESTAURANT HEADER — receipt eke uda pennana details.
//    Me values oyage restaurant ekata wenas karanna.
// ============================================================
export const RESTAURANT_INFO = {
  name: "MicroEChef",
  city: "", // ← ain kala (oke watina nam city name eka daganna)
  addressLines: [] as string[], // ← ain kala (address one nam "No.528, Galle Road" wage daganna)
  logoPath: "/CAPTURE 1.png", // public/ folder eke thiyena image eka
  // 📱 Review QR — receipt eke "Scan to rate us" QR ekata link eka.
  //    oyage Google review link eka dananna (g.page link eka wage)
  reviewUrl: "https://www.google.com/search?q=MicroEChef+reviews",
};

// Tbl_OrderModes table eka empty nam me fallback names use wenawa
// (oyage POS eke wena codes thiyenawanam methanata add karanna)
export const ORDER_MODE_FALLBACK: Record<string, string> = {
  DI: "Dine In",
  TA: "Take Away",
  DL: "Delivery",
  PU: "Pick Up",
  OT: "Other",
};

/** "17:30:00" → "05:30 PM" */
export function formatTime12h(t?: string): string | undefined {
  if (!t) return undefined;
  const m = t.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return undefined;
  let h = Number(m[1]);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${String(h).padStart(2, "0")}:${m[2]} ${ap}`;
}

/** Receipt meta eke status word — PAID → SETTLED */
export function statusReceiptWord(status: Bill["status"]): string {
  return status === "PAID" ? "SETTLED" : status;
}

export interface BillTotalRow {
  label: string;
  value: number;
}

export interface StatusMeta {
  bg: string;
  solidBg: string;
  fg: string;
  border: string;
  label: string;
  pdfLabel: string;
}

// Status badge colors / labels (used by both page + PDF)
export const STATUS_META: Record<Bill["status"], StatusMeta> = {
  PAID: {
    bg: "rgba(22,163,74,0.10)",
    solidBg: "#DCFCE7",
    fg: "#16a34a",
    border: "rgba(22,163,74,0.2)",
    label: "✓ PAID",
    pdfLabel: "PAID",
  },
  PENDING: {
    bg: "rgba(234,179,8,0.10)",
    solidBg: "#FEF9C3",
    fg: "#ca8a04",
    border: "rgba(234,179,8,0.2)",
    label: "⏳ PENDING",
    pdfLabel: "PENDING",
  },
  CANCELLED: {
    bg: "rgba(220,38,38,0.10)",
    solidBg: "#FEE2E2",
    fg: "#dc2626",
    border: "rgba(220,38,38,0.2)",
    label: "✕ CANCELLED",
    pdfLabel: "CANCELLED",
  },
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Build the totals breakdown rows for a bill.
 * Real DB bills (gross present) → Subtotal / Discount / Service Charge / VAT / TDL / ...
 * Mock bills (no gross)         → legacy Subtotal / Tax (8%) / Tip rows.
 */
export function getBillTotalRows(bill: Bill): BillTotalRow[] {
  if (bill.gross == null) {
    return [
      { label: "Gross Total", value: bill.subtotal },
      { label: "Tax (8%)", value: bill.tax },
      { label: "Tip", value: bill.tip },
    ];
  }

  const rows: BillTotalRow[] = [{ label: "Gross Total", value: r2(bill.gross) }];
  if (bill.discount)
    rows.push({
      // percentage thiyenawa nam "Discount (10%)" wage
      label: `Discount${
        bill.discountPre
          ? ` (${Math.round(bill.discountPre * 100) / 100}%)`
          : ""
      }`,
      value: -r2(bill.discount),
    });
  if (bill.serviceCharge)
    rows.push({ label: "Service Charge", value: r2(bill.serviceCharge) });
  if (bill.tax) rows.push({ label: "VAT", value: r2(bill.tax) });
  if (bill.tdl) rows.push({ label: "TDL", value: r2(bill.tdl) });
  if (bill.packingCharge)
    rows.push({ label: "Packing Charges", value: r2(bill.packingCharge) });
  if (bill.deliveryCharge)
    rows.push({ label: "Delivery Charges", value: r2(bill.deliveryCharge) });
  if (bill.rounding) rows.push({ label: "Rounding", value: r2(bill.rounding) });
  return rows;
}
