// ============================================================
// LOCATION: components/order/types.ts
// Shared types for the customer QR ordering flow (/order).
//
//   GET  /api/order/table?table=&t=      → table info
//   GET  /api/menu/items?limit=&after=    → menu items
//   GET  /api/order/existing?table=&t=    → the table's open bill
//   POST /api/order/confirm               → place the order
// ============================================================

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  groupId: string;
  groupName: string;
  subGroupId: string;
  subGroupName: string;
  description: string;
  available: boolean;
  imageUrl: string | null;
  groupOrder: number;
  listOrder: number;
}

export interface TableInfo {
  tableNo: string;
  tableGroup: string;
  groupId: string;
  vacant: boolean;
  area: string;
  source: "database" | "mock";
}

/** A menu category tab (FOOD / BEVERAGE / …). */
export interface MenuTab {
  key: string;
  label: string;
  count: number;
}

/** A group of items (Level 1 in the POS menu tree). */
export interface MenuGroup {
  key: string;
  name: string;
  tabKey: string;
  items: MenuItem[];
  count: number;
}

export interface MenuTree {
  tabs: MenuTab[];
  groups: MenuGroup[];
  items: MenuItem[];
}

/** Line already on the table's bill (read-only in the cart). */
export interface ExistingLine {
  itemCode: string;
  name: string;
  qty: number;
  remark: string;
  price: number;
}

export interface ExistingBill {
  invoiceNo: string;
  lines: ExistingLine[];
}

/** A cart line. `qty` is the FINAL quantity (baseline + added). */
export interface CartLine {
  key: string; // itemId|remark
  itemId: string;
  name: string;
  unitPrice: number;
  qty: number;
  remark: string;
}

export interface CartRow {
  rowId: string;
  lineKey: string;
  itemId: string;
  name: string;
  unitPrice: number;
  remark: string;
  qty: number;
  readOnly: boolean;
}

export interface ConfirmResult {
  tableNo: string;
  tableGroup: string;
  invoiceNo: string;
  itemCount: number;
  source: "database" | "mock";
}

export const lineKey = (itemId: string, remark: string) =>
  `${itemId}|${(remark ?? "").trim()}`;

/** Raw POS category codes → friendly tab labels. */
export const CATEGORY_LABELS: Record<string, string> = {
  F: "FOOD",
  FOOD: "FOOD",
  B: "BEVERAGE",
  BEVERAGE: "BEVERAGE",
  D: "DESSERT",
  DES: "DESSERT",
  DESSERT: "DESSERT",
  S: "SOUP",
  SOUP: "SOUP",
  O: "OTHER",
  OTHER: "OTHER",
};

const CATEGORY_ORDER = ["FOOD", "BEVERAGE", "DESSERT", "SOUP", "OTHER"];

export function categoryLabel(code: string): string {
  const key = (code || "").trim().toUpperCase();
  return CATEGORY_LABELS[key] ?? (key || "OTHER");
}

export function categoryRank(label: string): number {
  const i = CATEGORY_ORDER.indexOf(label);
  return i === -1 ? CATEGORY_ORDER.length : i;
}
