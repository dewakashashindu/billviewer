// ============================================================
// LOCATION: components/menu/types.ts
// Customer menu (/menu) — shared types.
// Shapes match the existing (guarded) APIs:
//   GET  /api/menu/items?limit=&after=       → MenuItem[]
//   GET  /api/order/table?table=&t=          → table info (validation)
//   GET  /api/order/existing?table=&t=       → { invoiceNo, lines[] }
//   POST /api/order/confirm                  → { invoiceNo, ... }
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

/** A searchable row: item + where it lives in the tree. */
export interface SearchableItem extends MenuItem {
  categoryLabel: string;
}

export interface SubGroup {
  key: string;
  name: string;
  items: MenuItem[];
}

export interface GroupCard {
  key: string;
  name: string;
  categoryId: string;
  items: MenuItem[];
  subGroups: SubGroup[];
  count: number;
  imageUrl: string | null;
}

export interface MenuTab {
  key: string;
  label: string;
  count: number;
}

export interface MenuTree {
  tabs: MenuTab[];
  groups: GroupCard[];
  searchable: SearchableItem[];
}

/** Line of the table's current unpaid bill (read-only baseline). */
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

/** Customer cart line — `qty` is the FINAL quantity (baseline + added). */
export interface CartLine {
  key: string; // itemId|remark
  itemId: string;
  name: string;
  unitPrice: number;
  qty: number;
  remark: string;
}

export interface ConfirmResult {
  tableNo: string;
  tableGroup: string;
  invoiceNo: string;
  itemCount: number;
  source: "database" | "mock";
  /** 'DI' = dine-in · 'TA' = takeaway (invoiceNo = the TA number) */
  orderType?: "DI" | "TA";
}

export const lineKey = (itemId: string, remark: string) =>
  `${itemId}|${(remark ?? "").trim()}`;
