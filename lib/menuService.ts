// ============================================================
// Customer menu + web order service (SERVER ONLY)
//
// Menu read:
//   Vw_MenuAssignment a INNER JOIN Tbl_MenuItems m
//     ON m.MenuItmId = a.MenuItemCode
//   Only front-visible, enabled, available items. Pictures are
//   NOT in the list query — they are served separately through
//   /api/menu/image/[code] (ItemPicMob binary -> PNG).
//
// Order confirm (additive — see the technical reference):
//   Tbl_HoldUpsCloud     = current bill lines (QTY = final qty)
//   Tbl_HoldUpsCloudTemp = activity lines (QTY = added delta,
//                          AoR = 'A')
//   Both writes happen in ONE SQL transaction. The price and
//   availability are re-read from the database — the price the
//   browser shows is never trusted.
//   Invoice: Tbl_Serials (SeriCode 'INV') -> INV-YYYYMMDD-NNN
//   Takeaway: Tbl_Serials (SeriCode 'TA') -> next serial (SeriNo+1)
//             saved as the new takeaway number, OrderType = 'TA'
//             (TabelNo = 'TA', no table is marked occupied)
//
// If the DB_* env vars are not set, mock menu data is served
// and confirms return a mock invoice (dev/demo mode).
// ============================================================
import sql from "mssql";
import { getPool, isDbConfigured } from "@/lib/db";
import { convertMenuImage, type ConvertedImage } from "./menuImage";
import { TAKEAWAY_TABLE_NO } from "./tableLink";

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

export interface MenuPage {
  items: MenuItem[];
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
  source: "database" | "mock";
}

const s = (v: unknown): string => (v == null ? "" : String(v).trim());
const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};


/* ── DB column resolution ──────────────────────────────────────
   Different POS databases name/expose the optional item columns
   differently (description, availability flag, mobile picture).
   Resolve once per process which object (Tbl_MenuItems = m,
   Vw_MenuAssignment = a) actually has each column, then build
   the queries with what exists. Missing column -> safe fallback
   (empty description, treated as available, no photo). */
type ColSrc = "m" | "a" | null;
interface MenuColumns { description: ColSrc; notAvailable: ColSrc; picture: ColSrc }
let menuColsCache: MenuColumns | null = null;

async function resolveMenuColumns(pool: sql.ConnectionPool): Promise<MenuColumns> {
  if (menuColsCache) return menuColsCache;
  const res = await pool.request().query(`
    SELECT TABLE_NAME AS t, COLUMN_NAME AS c
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME IN ('Tbl_MenuItems', 'Vw_MenuAssignment');
  `);
  const itemCols = new Set<string>();
  const viewCols = new Set<string>();
  for (const r of res.recordset) {
    (s(r.t) === "Tbl_MenuItems" ? itemCols : viewCols).add(s(r.c).toLowerCase());
  }
  const pick = (name: string): ColSrc =>
    itemCols.has(name.toLowerCase()) ? "m" : viewCols.has(name.toLowerCase()) ? "a" : null;
  menuColsCache = {
    description: pick("DisplayItemDes"),
    notAvailable: pick("ItemNotAvailable"),
    picture: pick("ItemPicMob"),
  };
  console.log("Menu columns resolved:", menuColsCache);
  return menuColsCache;
}
const col = (src: ColSrc, name: string): string | null => (src ? `${src}.[${name}]` : null);

/* ── destination column sizes ─────────────────────────────────
   SQL error 8152 ("String or binary data would be truncated")
   happens when a value is longer than its column. The POS schema
   differs between installs (CusCode char(10), CusName varchar(50)
   or 100, InvoiceNo char(20) …), so the real sizes are read once
   from INFORMATION_SCHEMA and every string parameter is clamped
   to fit before it is sent. */
const colSizeCache = new Map<string, Record<string, number>>();

async function loadColumnSizes(
  tx: sql.Transaction,
  tables: string[]
): Promise<void> {
  const missing = tables.filter((t) => !colSizeCache.has(t));
  if (!missing.length) return;
  try {
    const req = tx.request();
    const inList = missing.map((_, i) => `@t${i}`).join(", ");
    missing.forEach((t, i) => req.input(`t${i}`, sql.VarChar(128), t));
    const res = await req.query(`
      SELECT UPPER(TABLE_NAME) AS TableName,
             UPPER(COLUMN_NAME) AS ColumnName,
             CHARACTER_MAXIMUM_LENGTH AS MaxLen
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME IN (${inList})
        AND CHARACTER_MAXIMUM_LENGTH IS NOT NULL;
    `);
    for (const t of missing) colSizeCache.set(t, {});
    for (const r of res.recordset) {
      const table = String(r.TableName);
      const map = colSizeCache.get(table) ?? {};
      map[String(r.ColumnName)] = Number(r.MaxLen);
      colSizeCache.set(table, map);
    }
    const sizes = [...colSizeCache.entries()].map(([t, m]) => `${t}: ${Object.keys(m).length} cols`);
    console.log("Order column sizes loaded:", sizes.join(" · "));
  } catch (error) {
    console.error("Could not read column sizes (clamping disabled):", error);
    for (const t of missing) colSizeCache.set(t, {});
  }
}

/** Clamp `value` to the real column size, logging anything cut. */
function makeFitter() {
  return (table: string, column: string, value: string): string => {
    const max = colSizeCache.get(table.toUpperCase())?.[column.toUpperCase()];
    if (!max || max <= 0 || value.length <= max) return value; // -1 / nvarchar(max)
    const cut = value.slice(0, max);
    console.warn(
      `⚠️ ${table}.${column} holds ${max} chars — value cut from "${value}" to "${cut}"`
    );
    return cut;
  };
}

/* ── phone normalisation ─────────────────────────────────────
   CusCode is char(10) on this POS: keep local 10-digit numbers.
   "+94 77 123 4567" → "0771234567" */
export function normalisePhone(raw: string): string {
  let d = String(raw ?? "").replace(/[^0-9]/g, "");
  if (d.startsWith("0094")) d = `0${d.slice(4)}`; // 0094 77 …
  else if (d.startsWith("94") && d.length >= 11) d = `0${d.slice(2)}`; // +94 77 …
  if (d.length > 10 && !d.startsWith("0")) d = d.slice(-10);
  return d.slice(0, 10);
}

/* ─────────────────────────── mock data ─────────────────────────── */
const MOCK: MenuItem[] = [
  ["CFR1", "Chicken Fried Rice", 1600, "Food", "Mains", "Rice", "Wok-tossed rice, chicken, egg, vegetables", 1],
  ["KOT1", "Chicken Kottu Roti", 1750, "Food", "Mains", "Roti", "Chopped godamba roti, chicken, leeks, egg", 2],
  ["NAS1", "Nasi Goreng", 1850, "Food", "Mains", "Rice", "Indonesian fried rice, satay, fried egg", 3],
  ["SEA1", "Grilled Seafood Platter", 3900, "Food", "Mains", "Seafood", "Fish, prawns, cuttlefish, garlic butter", 4],
  ["DEV1", "Devilled Chicken", 2200, "Food", "Starters", "Hot", "Wok devilled chicken with capsicum and onion", 5],
  ["SOU1", "Hot Butter Cuttlefish", 2100, "Food", "Starters", "Hot", "Crisp cuttlefish in hot butter sauce", 6],
  ["SAL1", "Mirissa Beach Salad", 1200, "Food", "Starters", "Fresh", "Garden greens, grilled prawns, lime dressing", 7],
  ["BIR1", "Chicken Biriyani", 1950, "Food", "Mains", "Rice", "Fragrant biriyani rice, raita, Malay pickle", 8],
  ["JUI1", "Fresh Lime Juice", 650, "Beverage", "Drinks", "Juice", "Hand-pressed lime, mint", 9],
  ["JUI2", "King Coconut", 500, "Beverage", "Drinks", "Juice", "Chilled thambili", 10],
  ["COF1", "Iced Coffee", 800, "Beverage", "Drinks", "Coffee", "Cold brew, condensed milk", 11],
  ["DES1", "Watalappan", 700, "Dessert", "Desserts", "Local", "Coconut jaggery pudding", 12],
  ["DES2", "Chocolate Biscuit Pudding", 750, "Dessert", "Desserts", "Local", "Classic Sri Lankan biscuit pudding", 13],
].map(([id, name, price, cat, g, sub, desc, ord]) => ({
  id: String(id),
  name: String(name),
  price: Number(price),
  categoryId: String(cat),
  groupId: String(g),
  groupName: String(g),
  subGroupId: String(sub),
  subGroupName: String(sub),
  description: String(desc),
  available: true,
  imageUrl: null,
  groupOrder: Number(ord),
  listOrder: Number(ord),
}));

function mockPage(limit: number, after: string): MenuPage {
  const sorted = [...MOCK].sort((a, b) => a.id.localeCompare(b.id));
  const start = after ? sorted.findIndex((i) => i.id > after) : 0;
  const slice = sorted.slice(start < 0 ? sorted.length : start);
  const page = slice.slice(0, limit);
  return {
    items: page,
    limit,
    hasMore: slice.length > limit,
    nextCursor: page.length ? page[page.length - 1].id : null,
    source: "mock",
  };
}

/* ─────────────────────────── menu read ─────────────────────────── */
export async function getMenuPage(limit: number, after: string): Promise<MenuPage> {
  const lim = Math.min(100, Math.max(1, Math.floor(limit) || 50));
  if (!isDbConfigured()) return mockPage(lim, after);

  const pool = await getPool();
  const cols = await resolveMenuColumns(pool);
  const desCol = col(cols.description, "DisplayItemDes");
  const navCol = col(cols.notAvailable, "ItemNotAvailable");
  const picCol = col(cols.picture, "ItemPicMob");
  const req = pool.request();
  req.input("limit", sql.Int, lim + 1); // +1 row to detect hasMore
  req.input("after", sql.VarChar(50), after || "");
  const res = await req.query(`
    SELECT TOP (@limit)
      a.MenuItemCode, a.MenuItmDes, a.SalesPrice, a.Category,
      a.Level1, a.Level2, a.L1Des, a.L2Des,
      a.L1LitingOrder, a.LISTINGORDER,
      ${desCol ? `${desCol} AS DisplayItemDes` : `CAST('' AS NVARCHAR(500)) AS DisplayItemDes`},
      ${navCol ? `ISNULL(${navCol}, 0) AS ItemNotAvailable` : `0 AS ItemNotAvailable`},
      ${picCol ? `CASE WHEN ${picCol} IS NOT NULL AND DATALENGTH(${picCol}) > 0 THEN 1 ELSE 0 END` : `0`} AS HasImage
    FROM dbo.Vw_MenuAssignment AS a WITH (NOLOCK)
    INNER JOIN dbo.Tbl_MenuItems AS m WITH (NOLOCK)
      ON m.MenuItmId = a.MenuItemCode
    WHERE a.DisplayInFront = '1'
      AND a.MenuAssiEnable = '1'
      AND a.MenuItemEnable = '1'
      ${navCol ? `AND ISNULL(${navCol}, 0) = 0` : ``}
      AND a.MenuItemCode > @after
    ORDER BY a.MenuItemCode;
  `);

  const rows = res.recordset;
  const hasMore = rows.length > lim;
  const items: MenuItem[] = rows.slice(0, lim).map((r) => {
    const id = s(r.MenuItemCode);
    return {
      id,
      name: s(r.MenuItmDes),
      price: n(r.SalesPrice),
      categoryId: s(r.Category),
      groupId: s(r.Level1),
      groupName: s(r.L1Des) || s(r.Level1),
      subGroupId: s(r.Level2),
      subGroupName: s(r.L2Des) || s(r.Level2),
      description: s(r.DisplayItemDes),
      available: n(r.ItemNotAvailable) !== 1,
      imageUrl: n(r.HasImage) ? `/api/menu/image/${encodeURIComponent(id)}` : null,
      groupOrder: n(r.L1LitingOrder),
      listOrder: n(r.LISTINGORDER),
    };
  });
  return {
    items,
    limit: lim,
    hasMore,
    nextCursor: items.length ? items[items.length - 1].id : null,
    source: "database",
  };
}

export async function getMenuItemImage(code: string): Promise<ConvertedImage | null> {
  if (!isDbConfigured()) return null;
  const pool = await getPool();
  const cols = await resolveMenuColumns(pool);
  if (!cols.picture) return null;
  const req = pool.request();
  req.input("code", sql.VarChar(50), code.trim());
  const res = await req.query(
    cols.picture === "a"
      ? `SELECT TOP 1 ItemPicMob FROM dbo.Vw_MenuAssignment WITH (NOLOCK)
         WHERE MenuItemCode = @code AND ItemPicMob IS NOT NULL;`
      : `SELECT TOP 1 ItemPicMob FROM dbo.Tbl_MenuItems WITH (NOLOCK)
         WHERE MenuItmId = @code AND ItemPicMob IS NOT NULL;`
  );
  const raw: Buffer | null = res.recordset[0]?.ItemPicMob ?? null;
  if (!raw || !Buffer.isBuffer(raw) || raw.length === 0) return null;
  return convertMenuImage(raw);
}

/* ─────────────────────────── order confirm ─────────────────────────── */
export interface ConfirmLineInput {
  itemId: string;
  quantity: number;
  remark?: string;
}
export interface ConfirmInput {
  tableNo: string;
  tableGroup?: string;
  items: ConfirmLineInput[];
  customerName?: string;
  customerPhone?: string;
  /** Tbl_CustomerMaster.CusCode when the phone matched a customer. */
  customerCode?: string;
  /** Number of guests for this order (Tbl_HoldUpsCloud.LPax). */
  pax?: number;
  /** Local guests (Tbl_HoldUpsCloud.LPax) — preferred over `pax`. */
  localPax?: number;
  /** Foreign guests (Tbl_HoldUpsCloud.FPax). */
  foreignPax?: number;
  requestId?: string;
}
export interface ConfirmResult {
  tableNo: string;
  tableGroup: string;
  invoiceNo: string;
  itemCount: number;
  source: "database" | "mock";
  /** 'DI' = dine-in table · 'TA' = takeaway */
  orderType: "DI" | "TA";
}

/** Takeaway QR — the table number is the fixed "TA" code. */
export const isTakeawayTable = (tableNo: string) =>
  String(tableNo ?? "").trim().toUpperCase() === TAKEAWAY_TABLE_NO;

export class OrderError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function slDateParts(): { ymd: string; date: Date } {
  // Asia/Colombo date for the invoice number (server tz agnostic)
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const ymd = fmt.format(new Date()); // YYYY-MM-DD
  return { ymd, date: new Date(`${ymd}T00:00:00Z`) };
}

async function generateInvoiceNo(
  tx: sql.Transaction,
  maxLen: number = 50
): Promise<string> {
  const { ymd, date } = slDateParts();
  const req = tx.request();
  req.input("code", sql.Char(10), "INV");
  const res = await req.query(`
    SELECT SeriNo, SeriDate FROM dbo.Tbl_Serials WITH (UPDLOCK, HOLDLOCK)
    WHERE SeriCode = @code;
  `);
  let seq = 1;
  if (res.recordset.length) {
    const prevDate: Date | null = res.recordset[0].SeriDate ?? null;
    const sameDay =
      prevDate != null &&
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(prevDate) === ymd;
    seq = sameDay ? n(res.recordset[0].SeriNo) + 1 : 1;
    const upd = tx.request();
    upd.input("code", sql.Char(10), "INV");
    upd.input("seq", sql.Int, seq);
    upd.input("date", sql.DateTime, date);
    await upd.query(`
      UPDATE dbo.Tbl_Serials SET SeriNo = @seq, SeriDate = @date
      WHERE SeriCode = @code;
    `);
  } else {
    const ins = tx.request();
    ins.input("code", sql.Char(10), "INV");
    ins.input("date", sql.DateTime, date);
    await ins.query(`
      INSERT INTO dbo.Tbl_Serials (SeriCode, SeriNo, SeriDate)
      VALUES (@code, 1, @date);
    `);
  }
  /* Pick the longest format that still fits InvoiceNo on this DB
     (some installs have char(10)/char(20), not char(50)). */
  const compact = ymd.replaceAll("-", "");       // YYYYMMDD
  const nnn = String(seq).padStart(3, "0");
  const candidates = [
    `INV-${compact}-${nnn}`,                     // INV-20261019-001 (16)
    `INV-${compact.slice(2)}-${nnn}`,            // INV-261019-001    (14)
    `INV-${compact.slice(4)}-${nnn}`,            // INV-1019-001      (12)
    `INV-${nnn}`,                                // INV-001           (7)
    nnn,                                         // 001
  ];
  return candidates.find((c) => c.length <= maxLen) ?? candidates[candidates.length - 1];
}

/**
 * Takeaway number — Tbl_Serials (SeriCode 'TA').
 *
 *   next = Current Serial + 1   → saved as the new serial
 *   returns the new takeaway number, e.g. "TA-0007"
 *
 * UPDLOCK/HOLDLOCK keeps two simultaneous TA orders from getting
 * the same number (the whole order runs in one transaction).
 */
async function generateTakeawayNo(
  tx: sql.Transaction,
  maxLen: number = 20
): Promise<string> {
  const { date } = slDateParts();
  const req = tx.request();
  req.input("code", sql.Char(10), "TA");
  const res = await req.query(`
    SELECT SeriNo FROM dbo.Tbl_Serials WITH (UPDLOCK, HOLDLOCK)
    WHERE SeriCode = @code;
  `);
  let seq = 1;
  if (res.recordset.length) {
    seq = n(res.recordset[0].SeriNo) + 1;
    const upd = tx.request();
    upd.input("code", sql.Char(10), "TA");
    upd.input("seq", sql.Int, seq);
    upd.input("date", sql.DateTime, date);
    await upd.query(`
      UPDATE dbo.Tbl_Serials SET SeriNo = @seq, SeriDate = @date
      WHERE SeriCode = @code;
    `);
  } else {
    const ins = tx.request();
    ins.input("code", sql.Char(10), "TA");
    ins.input("date", sql.DateTime, date);
    await ins.query(`
      INSERT INTO dbo.Tbl_Serials (SeriCode, SeriNo, SeriDate)
      VALUES (@code, 1, @date);
    `);
  }
  const candidates = [
    `TA-${String(seq).padStart(4, "0")}`, // TA-0007
    `TA-${String(seq).padStart(3, "0")}`, // TA-007
    `T${String(seq).padStart(3, "0")}`,   // T007
    String(seq),                          // 7
  ];
  return candidates.find((c) => c.length <= maxLen) ?? candidates[candidates.length - 1];
}

function validateInput(
  input: ConfirmInput
): Required<Omit<ConfirmInput, "requestId" | "pax" | "localPax" | "foreignPax">> & {
  requestId: string;
  pax: number;
  localPax: number;
  foreignPax: number;
  takeaway: boolean;
} {
  const tableNo = s(input.tableNo);
  if (!tableNo) throw new OrderError("Table number is required. Scan the table QR code.");
  const takeaway = isTakeawayTable(tableNo);
  if (!Array.isArray(input.items) || input.items.length === 0)
    throw new OrderError("Your cart is empty.");
  if (input.items.length > 50) throw new OrderError("Too many items in one order.");
  const items = input.items.map((i) => {
    const qty = Math.floor(Number(i.quantity));
    if (!s(i.itemId)) throw new OrderError("Invalid item in cart.");
    if (!Number.isFinite(qty) || qty < 1 || qty > 99)
      throw new OrderError(`Invalid quantity for ${s(i.itemId)}.`);
    return { itemId: s(i.itemId), quantity: qty, remark: s(i.remark).slice(0, 200) };
  });
  const paxRaw = Number(input.pax);
  const pax = Number.isFinite(paxRaw) && paxRaw >= 1 ? Math.min(50, Math.round(paxRaw)) : 1;
  const clampPax = (v: unknown, fallback: number) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= 0 ? Math.min(50, n) : fallback;
  };
  // localPax wins over the legacy single `pax` (backward compatible).
  const localPax = clampPax(input.localPax, pax);
  const foreignPax = clampPax(input.foreignPax, 0);

  /* ── mandatory guest details ──────────────────────────────
     Both flows: name + phone. Dine-in: pax ≥ 1 as well. */
  const customerName = s(input.customerName).slice(0, 100);
  const customerPhone = s(input.customerPhone).slice(0, 30);
  if (customerName.length < 2)
    throw new OrderError("Please enter the customer name.");
  if (customerPhone.replace(/[^0-9]/g, "").length < 9)
    throw new OrderError("Please enter a valid phone number.");
  if (!takeaway && localPax + foreignPax < 1)
    throw new OrderError("Please enter the number of guests.");

  return {
    tableNo,
    tableGroup: s(input.tableGroup),
    items,
    customerName,
    customerPhone,
    pax,
    localPax: takeaway ? 0 : localPax,
    foreignPax: takeaway ? 0 : foreignPax,
    customerCode: s(input.customerCode).slice(0, 10),
    takeaway,
    requestId: s(input.requestId),
  };
}

export async function confirmOrder(rawInput: ConfirmInput): Promise<ConfirmResult> {
  const input = validateInput(rawInput);

  /* ── mock mode (no DB): validate against the mock menu ── */
  if (!isDbConfigured()) {
    for (const line of input.items) {
      const m = MOCK.find((x) => x.id === line.itemId);
      if (!m) throw new OrderError(`Item not available: ${line.itemId}`);
    }
    const { ymd } = slDateParts();
    return {
      tableNo: input.tableNo,
      tableGroup: input.takeaway ? "Takeaway" : input.tableGroup,
      invoiceNo: input.takeaway ? "TA-0001" : `INV-${ymd.replaceAll("-", "")}-001`,
      itemCount: input.items.reduce((a, i) => a + i.quantity, 0),
      source: "mock",
      orderType: input.takeaway ? "TA" : "DI",
    };
  }

  const pool = await getPool();
  const cols = await resolveMenuColumns(pool);
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    /* 1) Order context — dine-in table or the takeaway (TA) flow */
    let dbTableGroup = "Takeaway";
    let tableGrpId = "";
    let invoiceNo = "";

    const tReq = tx.request();
    tReq.input("table", sql.VarChar(10), input.tableNo);
    if (!input.takeaway) {
      const tRes = await tReq.query(`
        SELECT LTRIM(RTRIM(TableNo)) AS TableNo, LTRIM(RTRIM(TableGroup)) AS TableGroup
        FROM dbo.Tbl_Tables WITH (UPDLOCK, HOLDLOCK)
        WHERE LTRIM(RTRIM(TableNo)) = @table AND Enable = 1;
      `);
      if (!tRes.recordset.length)
        throw new OrderError("Table not found. Please scan the QR code on your table again.", 404);
      dbTableGroup = s(tRes.recordset[0].TableGroup);

      /* Table group id (Tbl_TableGroup.GroupID).
         Tbl_Tables.TableGroup holds the group ID on this POS, but older
         installs store the group name — try the ID first, then the name. */
      tableGrpId = dbTableGroup;
      const gReq = tx.request();
      gReq.input("gval", sql.VarChar(50), dbTableGroup);
      const gRes = await gReq.query(`
        SELECT TOP 1 LTRIM(RTRIM(GroupID)) AS GroupID
        FROM dbo.Tbl_TableGroup WITH (NOLOCK)
        WHERE LTRIM(RTRIM(GroupID)) = @gval
           OR LTRIM(RTRIM(GroupName)) = @gval
        ORDER BY CASE WHEN LTRIM(RTRIM(GroupID)) = @gval THEN 0 ELSE 1 END;
      `);
      if (gRes.recordset.length) tableGrpId = s(gRes.recordset[0].GroupID);
    }

    /* 2) Authoritative prices + availability from the DB */
    const priced: (ConfirmLineInput & { price: number })[] = [];
    for (const line of input.items) {
      const navCol = col(cols.notAvailable, "ItemNotAvailable");
      const pReq = tx.request();
      pReq.input("id", sql.VarChar(50), line.itemId);
      const pRes = await pReq.query(`
        SELECT TOP 1 a.SalesPrice
        FROM dbo.Vw_MenuAssignment AS a WITH (NOLOCK)
        INNER JOIN dbo.Tbl_MenuItems AS m WITH (NOLOCK)
          ON m.MenuItmId = a.MenuItemCode
        WHERE a.MenuItemCode = @id
          AND a.DisplayInFront = '1' AND a.MenuAssiEnable = '1' AND a.MenuItemEnable = '1'
          ${navCol ? `AND ISNULL(${navCol}, 0) = 0` : ``};
      `);
      if (!pRes.recordset.length)
        throw new OrderError(`Item not available: ${line.itemId}`);
      priced.push({ ...line, price: n(pRes.recordset[0].SalesPrice) });
    }

    /* 2b) Real column sizes — every string below is clamped so a
       long name / phone number can never raise SQL 8152. */
    await loadColumnSizes(tx, ["Tbl_HoldUpsCloud", "Tbl_HoldUpsCloudTemp"]);
    const fit = makeFitter();

    const invoiceMax =
      colSizeCache.get("TBL_HOLDUPSCLOUD")?.["INVOICENO"] ?? 50;
    const cusCodeValue = fit(
      "Tbl_HoldUpsCloud",
      "CusCode",
      input.customerCode || normalisePhone(input.customerPhone) || input.customerPhone
    );
    const cusNameValue = fit("Tbl_HoldUpsCloud", "CusName", input.customerName);
    const orderTypeValue = fit(
      "Tbl_HoldUpsCloud",
      "OrderType",
      input.takeaway ? "TA" : "DI"
    );
    const grpValue = fit("Tbl_HoldUpsCloud", "TabelGrpID", tableGrpId);
    const tableValue = fit("Tbl_HoldUpsCloud", "TabelNo", input.tableNo);

    /* 3) Order number
       • dine-in → the table's open invoice, or a fresh INV number
       • takeaway → always a NEW number from Tbl_Serials ('TA') */
    if (input.takeaway) {
      invoiceNo = await generateTakeawayNo(tx, invoiceMax);
    } else {
      const invReq = tx.request();
      invReq.input("table", sql.VarChar(10), input.tableNo);
      const invRes = await invReq.query(`
        SELECT TOP 1 LTRIM(RTRIM(InvoiceNo)) AS InvoiceNo
        FROM dbo.Tbl_HoldUpsCloud WITH (UPDLOCK, HOLDLOCK)
        WHERE LTRIM(RTRIM(TabelNo)) = @table AND ISNULL(IsPaid, 0) = 0
        ORDER BY TxnDateTime DESC;
      `);
      invoiceNo = invRes.recordset.length
        ? s(invRes.recordset[0].InvoiceNo)
        : await generateInvoiceNo(tx, invoiceMax);
    }
    const invoiceValue = fit("Tbl_HoldUpsCloud", "InvoiceNo", invoiceNo);

    /* 4) Additive writes: bill line = final qty, activity = delta */
    for (const line of priced) {
      const itemValue = fit("Tbl_HoldUpsCloud", "ItemCode", line.itemId);
      const remarkValue = fit("Tbl_HoldUpsCloud", "ItemRemarks", line.remark ?? "");

      const find = tx.request();
      find.input("table", sql.VarChar(10), tableValue);
      find.input("inv", sql.VarChar(50), invoiceValue);
      find.input("item", sql.VarChar(50), itemValue);
      find.input("remark", sql.VarChar(200), remarkValue);
      const found = await find.query(`
        SELECT QTY FROM dbo.Tbl_HoldUpsCloud WITH (UPDLOCK, HOLDLOCK)
        WHERE LTRIM(RTRIM(TabelNo)) = @table AND InvoiceNo = @inv
          AND ItemCode = @item AND ISNULL(ItemRemarks, '') = @remark;
      `);
      const existingQty = found.recordset.length ? n(found.recordset[0].QTY) : 0;
      const finalQty = existingQty + line.quantity;

      if (found.recordset.length) {
        const upd = tx.request();
        upd.input("qty", sql.Float, finalQty);
        upd.input("table", sql.VarChar(10), tableValue);
        upd.input("inv", sql.VarChar(50), invoiceValue);
        upd.input("item", sql.VarChar(50), itemValue);
        upd.input("remark", sql.VarChar(200), remarkValue);
        await upd.query(`
          UPDATE dbo.Tbl_HoldUpsCloud SET QTY = @qty
          WHERE LTRIM(RTRIM(TabelNo)) = @table AND InvoiceNo = @inv
            AND ItemCode = @item AND ISNULL(ItemRemarks, '') = @remark;
        `);
      } else {
        const ins = tx.request();
        ins.input("table", sql.VarChar(10), tableValue);
        ins.input("inv", sql.VarChar(50), invoiceValue);
        ins.input("item", sql.VarChar(50), itemValue);
        ins.input("qty", sql.Float, finalQty);
        ins.input("price", sql.Float, line.price);
        ins.input("remark", sql.VarChar(200), remarkValue);
        ins.input("grp", sql.Char(10), grpValue);
        // CusCode = the real Tbl_CustomerMaster code when the phone
        // matched a customer, otherwise the 10-digit local phone.
        ins.input("cusCode", sql.VarChar(30), cusCodeValue);
        ins.input("cusName", sql.VarChar(100), cusNameValue);
        ins.input("lpx", sql.Int, input.localPax);
        ins.input("fpx", sql.Int, input.foreignPax);
        ins.input("orderType", sql.Char(2), orderTypeValue);
        ins.input("userId", sql.VarChar(20), fit("Tbl_HoldUpsCloud", "UserID", "WEB"));
        await ins.query(`
          INSERT INTO dbo.Tbl_HoldUpsCloud (
            TabelNo, ItemCode, QTY, SalesPrice, ItemRemarks, UserID,
            TabelGrpID, LPax, FPax, OrderType, InvoiceNo, IsPaid,
            CusCode, CusName, TxnDateTime
          ) VALUES (
            @table, @item, @qty, @price, @remark, @userId,
            @grp, @lpx, @fpx, @orderType, @inv, 0,
            @cusCode, @cusName, DATEADD(MINUTE, 330, GETUTCDATE())
          );
        `);
      }

      /* the activity table has its OWN column sizes */
      const act = tx.request();
      act.input("table", sql.VarChar(10), fit("Tbl_HoldUpsCloudTemp", "TabelNo", tableValue));
      act.input("inv", sql.VarChar(50), fit("Tbl_HoldUpsCloudTemp", "InvoiceNo", invoiceValue));
      act.input("item", sql.VarChar(50), fit("Tbl_HoldUpsCloudTemp", "ItemCode", itemValue));
      act.input("qty", sql.Float, line.quantity);
      act.input("price", sql.Float, line.price);
      act.input("remark", sql.VarChar(200), fit("Tbl_HoldUpsCloudTemp", "ItemRemarks", remarkValue));
      act.input("grp", sql.Char(10), fit("Tbl_HoldUpsCloudTemp", "TabelGrpID", grpValue));
      act.input("cusCode", sql.VarChar(30), fit("Tbl_HoldUpsCloudTemp", "CusCode", cusCodeValue));
      act.input("cusName", sql.VarChar(100), fit("Tbl_HoldUpsCloudTemp", "CusName", cusNameValue));
      act.input("lpx", sql.Int, input.takeaway ? 0 : input.pax);
      act.input("orderType", sql.Char(2), orderTypeValue);
      /* the fixed literals are clamped too — some installs have
         UserName char(10) / MgrID char(5) on the activity table */
      act.input("userId", sql.VarChar(20), fit("Tbl_HoldUpsCloudTemp", "UserID", "WEB"));
      act.input("voidRemark", sql.VarChar(50), fit("Tbl_HoldUpsCloudTemp", "VoidRemark", ""));
      act.input("mgrId", sql.VarChar(20), fit("Tbl_HoldUpsCloudTemp", "MgrID", ""));
      act.input("aor", sql.VarChar(5), fit("Tbl_HoldUpsCloudTemp", "AoR", "A"));
      act.input("userName", sql.VarChar(50), fit("Tbl_HoldUpsCloudTemp", "UserName", "Web Menu"));
      await act.query(`
        INSERT INTO dbo.Tbl_HoldUpsCloudTemp (
          TabelNo, UserID, ItemCode, QTY, ItemRemarks, VoidRemark,
          TabelGrpID, TxnDateTime, LPax, FPax, SalesPrice, MgrID,
          OrderType, AoR, UserName, InvoiceNo, CusCode, CusName
        ) VALUES (
          @table, @userId, @item, @qty, @remark, @voidRemark,
          @grp, DATEADD(MINUTE, 330, GETUTCDATE()), @lpx, 0, @price, @mgrId,
          @orderType, @aor, @userName, @inv, @cusCode, @cusName
        );
      `);
    }

    /* 5) Mark the dining table occupied (takeaway has no table) */
    if (!input.takeaway) {
      const occ = tx.request();
      occ.input("table", sql.VarChar(10), tableValue);
      await occ.query(`
        UPDATE dbo.Tbl_Tables SET Vaccant = 'N'
        WHERE LTRIM(RTRIM(TableNo)) = @table;
      `);
    }

    await tx.commit();
    return {
      tableNo: input.tableNo,
      tableGroup: dbTableGroup,
      invoiceNo: invoiceValue,
      itemCount: priced.reduce((a, i) => a + i.quantity, 0),
      source: "database",
      orderType: input.takeaway ? "TA" : "DI",
    };
  } catch (err) {
    try { await tx.rollback(); } catch { /* already rolled back */ }
    if (err instanceof OrderError) throw err;

    /* SQL 8152 = a value did not fit its column. Print what was
       being written so the exact column can be found in one go. */
    const errNumber = (err as { number?: number })?.number;
    if (errNumber === 8152) {
      const dump: string[] = [];
      for (const [table, cols] of colSizeCache) {
        dump.push(`  ${table}: ${Object.entries(cols).map(([c, l]) => `${c}=${l}`).join(", ")}`);
      }
      console.error(
        "Order confirm error (SQL 8152 — value too long for column):",
        JSON.stringify(rawInput, null, 2)
      );
      console.error("Column sizes read from INFORMATION_SCHEMA:\n" + dump.join("\n"));
    }
    console.error("Order confirm error:", err);
    throw new OrderError("Order could not be saved. Please try again.", 500);
  }
}

/* ── Existing unpaid bill for a table ──────────────────────────
   Used by the customer cart to render already-ordered lines as
   read-only ("ALREADY ON BILL") and to keep quantity steppers
   from going below what is already on the bill. */
export interface ExistingBillLine {
  itemCode: string;
  name: string;
  qty: number;
  remark: string;
  price: number;
}
export interface ExistingBill {
  invoiceNo: string;
  lines: ExistingBillLine[];
}

export async function getExistingBill(tableNo: string): Promise<ExistingBill> {
  const table = s(tableNo);
  /* Takeaway has no table bill — every TA order stands alone. */
  if (!table || isTakeawayTable(table) || !isDbConfigured())
    return { invoiceNo: "", lines: [] };
  const pool = await getPool();
  const req = pool.request();
  req.input("table", sql.VarChar(10), table);
  const res = await req.query(`
    SELECT LTRIM(RTRIM(h.InvoiceNo)) AS InvoiceNo,
           LTRIM(RTRIM(h.ItemCode)) AS ItemCode,
           ISNULL(NULLIF(LTRIM(RTRIM(m.MenuItmDes)), ''), LTRIM(RTRIM(h.ItemCode))) AS ItemName,
           h.QTY, ISNULL(h.ItemRemarks, '') AS ItemRemarks, h.SalesPrice
    FROM dbo.Tbl_HoldUpsCloud AS h WITH (NOLOCK)
    LEFT JOIN dbo.Tbl_MenuItems AS m WITH (NOLOCK)
      ON m.MenuItmId = h.ItemCode
    WHERE LTRIM(RTRIM(h.TabelNo)) = @table AND ISNULL(h.IsPaid, 0) = 0
    ORDER BY h.TxnDateTime, h.ItemCode;
  `);
  const byKey = new Map<string, ExistingBillLine>();
  let invoiceNo = "";
  for (const r of res.recordset) {
    if (!invoiceNo) invoiceNo = s(r.InvoiceNo);
    const key = `${s(r.ItemCode)}|${s(r.ItemRemarks)}`;
    const prev = byKey.get(key);
    if (prev) prev.qty += n(r.QTY);
    else byKey.set(key, {
      itemCode: s(r.ItemCode), name: s(r.ItemName),
      qty: n(r.QTY), remark: s(r.ItemRemarks), price: n(r.SalesPrice),
    });
  }
  return { invoiceNo, lines: [...byKey.values()].filter((l) => l.itemCode && l.qty > 0) };
}
