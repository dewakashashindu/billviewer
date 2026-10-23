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
// Order confirm (QR staging queue):
//   Saves ONLY into dbo.Tbl_HoldUpsCloudTempQR (22 columns):
//     • LocCode      = location code carried inside the QR link
//     • UserID/Name  = 'QR'
//     • OrderNo      = Tbl_Serials (SeriCode 'ODN') -> 1, 2, 3...
//                      (new OrderNo on every confirm, even when adding
//                       items to an existing open InvoiceNo)
//     • RowLine      = MAX(RowLine) + 1 per item in Tbl_HoldUpsCloudTempQR
//     • Invoice:       Tbl_Serials (SeriCode 'INV') -> INV-YYYYMMDD-NNN
//                      (reused when adding items to the same open table bill)
//     • Takeaway:      Tbl_Serials (SeriCode 'TA') -> TA-0001 in TabelNo
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
const colSizeCache = new Map<string, Record<string, number>>([
  [
    "TBL_HOLDUPSCLOUDTEMPQR",
    {
      LOCCODE: 10,
      TABELNO: 10,
      ORDERNO: 10,
      USERID: 10,
      USERNAME: 50,
      AOR: 1,
      ITEMCODE: 10,
      ITEMREMARKS: 500,
      TABELGRPID: 10,
      MGRID: 10,
      ORDERTYPE: 5,
      VOIDREMARK: 200,
      INVOICENO: 50,
      CUSNAME: 200,
      CUSCODE: 10,
    },
  ],
]);
const colSizeLoaded = new Set<string>();

async function loadColumnSizes(
  tx: sql.Transaction,
  tables: string[]
): Promise<void> {
  const missing = tables.filter((t) => !colSizeLoaded.has(t.toUpperCase()));
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
    for (const t of missing) {
      const up = t.toUpperCase();
      colSizeLoaded.add(up);
      if (!colSizeCache.has(up)) colSizeCache.set(up, {});
    }
    for (const r of res.recordset) {
      const table = String(r.TableName).toUpperCase();
      const map = colSizeCache.get(table) ?? {};
      map[String(r.ColumnName).toUpperCase()] = Number(r.MaxLen);
      colSizeCache.set(table, map);
    }
  } catch (error) {
    console.error("Could not read column sizes (using fallback defaults):", error);
    for (const t of missing) {
      const up = t.toUpperCase();
      colSizeLoaded.add(up);
      if (!colSizeCache.has(up)) colSizeCache.set(up, {});
    }
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
  /** Location code from the scanned QR (Tbl_LocationMaster.LocCode). */
  locCode?: string;
  /** Existing unpaid InvoiceNo on this table's active session (DI only). */
  existingInvoiceNo?: string;
  items: ConfirmLineInput[];
  customerName?: string;
  customerPhone?: string;
  /** Tbl_CustomerMaster.CusCode when the phone matched a customer. */
  customerCode?: string;
  /** Number of guests for this order (LPax). */
  pax?: number;
  /** Local guests (LPax) — preferred over `pax`. */
  localPax?: number;
  /** Foreign guests (FPax). */
  foreignPax?: number;
  requestId?: string;
}
export interface ConfirmResult {
  tableNo: string;
  tableGroup: string;
  invoiceNo: string;
  orderNo: string;
  locCode: string;
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
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const ymd = fmt.format(new Date()); // YYYY-MM-DD
  return { ymd, date: new Date(`${ymd}T00:00:00Z`) };
}

/* ── Dynamic Tbl_Serials schema inspection ───────────────────
   Some POS databases have SeriDate / LocCode on Tbl_Serials and
   others do not (e.g. SQL5075 when SeriDate is absent). Inspect
   INFORMATION_SCHEMA.COLUMNS once so INV, TA, and ODN serials work
   cleanly on every schema variant. */
interface SerialColMeta {
  name: string;
  dataType: string;
  nullable: boolean;
  hasDefault: boolean;
}
interface SerialsSchema {
  codeCol: string;
  noCol: string;
  dateCol: string | null;
  locCol: string | null;
  requiredExtras: SerialColMeta[];
}
let serialsSchemaCache: SerialsSchema | null = null;

async function resolveSerialsSchema(tx: sql.Transaction): Promise<SerialsSchema> {
  if (serialsSchemaCache) return serialsSchemaCache;
  try {
    const res = await tx.request().query(`
      SELECT
        COLUMN_NAME AS c,
        LOWER(DATA_TYPE) AS dt,
        IS_NULLABLE AS nul,
        COLUMN_DEFAULT AS def,
        COLUMNPROPERTY(OBJECT_ID(TABLE_SCHEMA + '.' + TABLE_NAME), COLUMN_NAME, 'IsIdentity') AS isId
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Tbl_Serials';
    `);
    const byUpper = new Map<string, SerialColMeta & { isId: boolean }>();
    for (const r of res.recordset) {
      const name = s(r.c);
      if (!name) continue;
      byUpper.set(name.toUpperCase(), {
        name,
        dataType: s(r.dt),
        nullable: s(r.nul).toUpperCase() === "YES",
        hasDefault: r.def != null,
        isId: Number(r.isId) === 1,
      });
    }
    if (byUpper.size === 0) {
      const probe = await tx
        .request()
        .query(`SELECT TOP 1 * FROM Tbl_Serials WITH (NOLOCK);`)
        .catch(() => null);
      const sample = probe?.recordset?.[0];
      if (sample) {
        for (const name of Object.keys(sample)) {
          byUpper.set(name.toUpperCase(), {
            name,
            dataType: typeof sample[name] === "number" ? "int" : "varchar",
            nullable: true,
            hasDefault: true,
            isId: false,
          });
        }
      }
    }

    const pick = (cands: string[]) => {
      for (const c of cands) {
        const hit = byUpper.get(c.toUpperCase());
        if (hit) return hit.name;
      }
      return null;
    };
    const codeCol = pick(["SeriCode", "SerialCode", "Code"]) ?? "SeriCode";
    const noCol = pick(["SeriNo", "SerialNo", "CurrNo", "NextNo"]) ?? "SeriNo";
    const dateCol = pick(["SeriDate", "SerialDate", "TxnDate"]);
    const locCol = pick(["LocCode", "LocationCode"]);

    const handled = new Set(
      [codeCol, noCol, dateCol, locCol]
        .filter((x): x is string => Boolean(x))
        .map((x) => x.toUpperCase())
    );
    const requiredExtras: SerialColMeta[] = [];
    for (const [upper, meta] of byUpper) {
      if (handled.has(upper) || meta.isId || meta.nullable || meta.hasDefault) continue;
      requiredExtras.push(meta);
    }

    serialsSchemaCache = { codeCol, noCol, dateCol, locCol, requiredExtras };
    return serialsSchemaCache;
  } catch (err) {
    console.warn("Could not inspect Tbl_Serials schema, using minimal columns:", err);
    return {
      codeCol: "SeriCode",
      noCol: "SeriNo",
      dateCol: null,
      locCol: null,
      requiredExtras: [],
    };
  }
}

async function nextSerialValue(
  tx: sql.Transaction,
  seriCode: string,
  opts: { dailyReset?: boolean; locCode?: string } = {}
): Promise<number> {
  const schema = await resolveSerialsSchema(tx);
  const { ymd, date } = slDateParts();
  const loc = s(opts.locCode);

  const selectCols = [
    `[${schema.noCol}] AS SeriNo`,
    schema.dateCol ? `[${schema.dateCol}] AS SeriDate` : null,
    schema.locCol ? `LTRIM(RTRIM(CAST([${schema.locCol}] AS VARCHAR(50)))) AS RowLoc` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const sel = tx.request();
  sel.input("code", sql.VarChar(20), seriCode);
  if (schema.locCol && loc) sel.input("loc", sql.VarChar(20), loc);

  const selRes = await sel.query(`
    SELECT ${selectCols}
    FROM dbo.Tbl_Serials WITH (UPDLOCK, HOLDLOCK)
    WHERE LTRIM(RTRIM(CAST([${schema.codeCol}] AS VARCHAR(50)))) = @code
    ${
      schema.locCol && loc
        ? `ORDER BY CASE WHEN LTRIM(RTRIM(CAST([${schema.locCol}] AS VARCHAR(50)))) = @loc THEN 0 ELSE 1 END`
        : ``
    };
  `);

  let seq = 1;
  if (selRes.recordset.length) {
    const row = selRes.recordset[0];
    if (opts.dailyReset && schema.dateCol) {
      const prevDate: Date | null = row.SeriDate ? new Date(row.SeriDate) : null;
      const sameDay =
        prevDate != null &&
        !Number.isNaN(prevDate.getTime()) &&
        new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(prevDate) === ymd;
      seq = sameDay ? n(row.SeriNo) + 1 : 1;
    } else {
      seq = n(row.SeriNo) + 1;
    }

    const upd = tx.request();
    upd.input("code", sql.VarChar(20), seriCode);
    upd.input("seq", sql.Int, seq);
    const setParts = [`[${schema.noCol}] = @seq`];
    if (schema.dateCol) {
      upd.input("date", sql.DateTime, date);
      setParts.push(`[${schema.dateCol}] = @date`);
    }
    let whereLoc = "";
    if (schema.locCol && row.RowLoc !== undefined) {
      upd.input("rowLoc", sql.VarChar(50), s(row.RowLoc));
      whereLoc = ` AND LTRIM(RTRIM(ISNULL(CAST([${schema.locCol}] AS VARCHAR(50)), ''))) = @rowLoc`;
    }
    await upd.query(`
      UPDATE dbo.Tbl_Serials
      SET ${setParts.join(", ")}
      WHERE LTRIM(RTRIM(CAST([${schema.codeCol}] AS VARCHAR(50)))) = @code${whereLoc};
    `);
  } else {
    const ins = tx.request();
    const colNames = [`[${schema.codeCol}]`, `[${schema.noCol}]`];
    const valExprs = ["@code", "@seq"];
    ins.input("code", sql.VarChar(20), seriCode);
    ins.input("seq", sql.Int, 1);

    if (schema.dateCol) {
      colNames.push(`[${schema.dateCol}]`);
      valExprs.push("@date");
      ins.input("date", sql.DateTime, date);
    }
    if (schema.locCol) {
      colNames.push(`[${schema.locCol}]`);
      valExprs.push("@loc");
      ins.input("loc", sql.VarChar(20), loc);
    }
    schema.requiredExtras.forEach((extra, idx) => {
      const pName = `ex${idx}`;
      colNames.push(`[${extra.name}]`);
      valExprs.push(`@${pName}`);
      if (extra.dataType.includes("date") || extra.dataType.includes("time")) {
        ins.input(pName, sql.DateTime, date);
      } else if (
        extra.dataType.includes("int") ||
        extra.dataType.includes("float") ||
        extra.dataType.includes("decimal") ||
        extra.dataType.includes("numeric") ||
        extra.dataType.includes("money") ||
        extra.dataType === "bit"
      ) {
        ins.input(pName, sql.Int, 0);
      } else {
        ins.input(pName, sql.VarChar(20), "");
      }
    });

    await ins.query(`
      INSERT INTO dbo.Tbl_Serials (${colNames.join(", ")})
      VALUES (${valExprs.join(", ")});
    `);
  }

  return seq;
}

async function generateInvoiceNo(
  tx: sql.Transaction,
  maxLen: number = 50,
  locCode: string = ""
): Promise<string> {
  const { ymd } = slDateParts();
  const seq = await nextSerialValue(tx, "INV", { dailyReset: true, locCode });
  const compact = ymd.replaceAll("-", ""); // YYYYMMDD
  const nnn = String(seq).padStart(3, "0");
  const candidates = [
    `INV-${compact}-${nnn}`,          // INV-20261023-001 (16)
    `INV-${compact.slice(2)}-${nnn}`, // INV-261023-001   (14)
    `INV-${compact.slice(4)}-${nnn}`, // INV-1023-001     (12)
    `INV-${nnn}`,                     // INV-001          (7)
    nnn,                              // 001
  ];
  return candidates.find((c) => c.length <= maxLen) ?? candidates[candidates.length - 1];
}

async function generateTakeawayNo(
  tx: sql.Transaction,
  maxLen: number = 10,
  locCode: string = ""
): Promise<string> {
  const seq = await nextSerialValue(tx, "TA", { dailyReset: false, locCode });
  const candidates = [
    `TA-${String(seq).padStart(4, "0")}`, // TA-0001
    `TA-${String(seq).padStart(3, "0")}`, // TA-001
    `T${String(seq).padStart(3, "0")}`,   // T001
    String(seq),                          // 1
  ];
  return candidates.find((c) => c.length <= maxLen) ?? candidates[candidates.length - 1];
}

/**
 * QR Order number — Tbl_Serials (SeriCode 'ODN').
 * Plain integer string: "1", "2", "3", ...
 * Incremented on EVERY order confirmation (including when a guest
 * adds extra items to an already-open InvoiceNo on the same table).
 */
async function generateOrderNo(
  tx: sql.Transaction,
  maxLen: number = 10,
  locCode: string = ""
): Promise<string> {
  const seq = await nextSerialValue(tx, "ODN", { dailyReset: false, locCode });
  const raw = String(seq);
  return raw.length <= maxLen ? raw : raw.slice(-maxLen);
}

/** Check whether an invoice has already been settled/closed in POS. */
async function isInvoiceSettled(
  tx: sql.Transaction,
  invoiceNo: string
): Promise<boolean> {
  const inv = s(invoiceNo);
  if (!inv) return true;
  try {
    const r1 = tx.request();
    r1.input("inv", sql.VarChar(50), inv);
    const res1 = await r1.query(`
      SELECT TOP 1 1 AS Hit
      FROM dbo.Tbl_HoldUpsCloud WITH (NOLOCK)
      WHERE LTRIM(RTRIM(InvoiceNo)) = @inv AND ISNULL(IsPaid, 0) = 1;
    `);
    if (res1.recordset.length) return true;
  } catch {
    /* Tbl_HoldUpsCloud optional */
  }
  try {
    const r2 = tx.request();
    r2.input("inv", sql.VarChar(50), inv);
    const res2 = await r2.query(`
      SELECT TOP 1 1 AS Hit
      FROM dbo.Tbl_BillHeader WITH (NOLOCK)
      WHERE LTRIM(RTRIM(BillNo)) = @inv;
    `);
    if (res2.recordset.length) return true;
  } catch {
    /* Tbl_BillHeader optional */
  }
  return false;
}

function validateInput(
  input: ConfirmInput
): {
  tableNo: string;
  tableGroup: string;
  locCode: string;
  existingInvoiceNo: string;
  items: { itemId: string; quantity: number; remark: string }[];
  customerName: string;
  customerPhone: string;
  customerCode: string;
  pax: number;
  localPax: number;
  foreignPax: number;
  takeaway: boolean;
  requestId: string;
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
    return { itemId: s(i.itemId), quantity: qty, remark: s(i.remark).slice(0, 500) };
  });
  const paxRaw = Number(input.pax);
  const pax = Number.isFinite(paxRaw) && paxRaw >= 1 ? Math.min(50, Math.round(paxRaw)) : 1;
  const clampPax = (v: unknown, fallback: number) => {
    const num = Math.floor(Number(v));
    return Number.isFinite(num) && num >= 0 ? Math.min(50, num) : fallback;
  };
  const localPax = clampPax(input.localPax, pax);
  const foreignPax = clampPax(input.foreignPax, 0);

  const customerName = s(input.customerName).slice(0, 200);
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
    locCode: s(input.locCode).slice(0, 10),
    existingInvoiceNo: s(input.existingInvoiceNo).slice(0, 50),
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

let mockOrderCounter = 0;

export async function confirmOrder(rawInput: ConfirmInput): Promise<ConfirmResult> {
  const input = validateInput(rawInput);

  /* ── mock mode (no DB): validate against the mock menu ── */
  if (!isDbConfigured()) {
    for (const line of input.items) {
      const m = MOCK.find((x) => x.id === line.itemId);
      if (!m) throw new OrderError(`Item not available: ${line.itemId}`);
    }
    mockOrderCounter += 1;
    const { ymd } = slDateParts();
    const inv =
      !input.takeaway && input.existingInvoiceNo
        ? input.existingInvoiceNo
        : `INV-${ymd.replaceAll("-", "")}-${String(mockOrderCounter).padStart(3, "0")}`;
    return {
      tableNo: input.takeaway ? `TA-${String(mockOrderCounter).padStart(4, "0")}` : input.tableNo,
      tableGroup: input.takeaway ? "Takeaway" : input.tableGroup,
      invoiceNo: inv,
      orderNo: String(mockOrderCounter),
      locCode: input.locCode,
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
    /* 1) Order context — dine-in table or takeaway (TA) */
    let dbTableGroup = "Takeaway";
    let tableGrpId = "";
    let invoiceNo = "";

    if (!input.takeaway) {
      const tReq = tx.request();
      tReq.input("table", sql.VarChar(20), input.tableNo);
      const tRes = await tReq.query(`
        SELECT
          LTRIM(RTRIM(TableNo)) AS TableNo,
          LTRIM(RTRIM(ISNULL(TableGroup, ''))) AS TableGroup
        FROM dbo.Tbl_Tables WITH (NOLOCK)
        WHERE LTRIM(RTRIM(TableNo)) = @table AND Enable = 1;
      `);
      if (!tRes.recordset.length)
        throw new OrderError("Table not found. Please scan the QR code on your table again.", 404);
      dbTableGroup = s(tRes.recordset[0].TableGroup);

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

    /* 3) Column sizes for dbo.Tbl_HoldUpsCloudTempQR */
    const TARGET_TABLE = "Tbl_HoldUpsCloudTempQR";
    await loadColumnSizes(tx, [TARGET_TABLE]);
    const fit = makeFitter();

    const qrCols = colSizeCache.get(TARGET_TABLE.toUpperCase()) ?? {};
    const invoiceMax = qrCols["INVOICENO"] && qrCols["INVOICENO"] > 0 ? qrCols["INVOICENO"] : 50;
    const tableMax = qrCols["TABELNO"] && qrCols["TABELNO"] > 0 ? qrCols["TABELNO"] : 10;
    const orderNoMax = qrCols["ORDERNO"] && qrCols["ORDERNO"] > 0 ? qrCols["ORDERNO"] : 10;

    /* 4) Resolve TabelNo + InvoiceNo:
          • Takeaway (TA): fresh TA-0001 in TabelNo + fresh INV-... in InvoiceNo
          • Dine-in  (DI): reuse open unpaid InvoiceNo for this table if one
                           exists (in Tbl_HoldUpsCloudTempQR, Tbl_HoldUpsCloud,
                           or active guest session), otherwise generate fresh INV-... */
    let resolvedTableNo = input.tableNo;
    if (input.takeaway) {
      resolvedTableNo = await generateTakeawayNo(tx, tableMax, input.locCode);
      invoiceNo = await generateInvoiceNo(tx, invoiceMax, input.locCode);
    } else {
      // (a) Check pending rows still in Tbl_HoldUpsCloudTempQR
      const q1 = tx.request();
      q1.input("table", sql.VarChar(20), input.tableNo);
      q1.input("loc", sql.VarChar(20), input.locCode);
      const r1 = await q1.query(`
        SELECT TOP 1 LTRIM(RTRIM(InvoiceNo)) AS InvoiceNo
        FROM dbo.Tbl_HoldUpsCloudTempQR WITH (UPDLOCK, HOLDLOCK)
        WHERE LTRIM(RTRIM(TabelNo)) = @table
          AND (@loc = '' OR LTRIM(RTRIM(LocCode)) = @loc)
          AND ISNULL(IsPaid, 0) = 0
        ORDER BY TxnDateTime DESC, RowLine DESC;
      `);
      if (r1.recordset.length && s(r1.recordset[0].InvoiceNo)) {
        invoiceNo = s(r1.recordset[0].InvoiceNo);
      }

      // (b) Check open hold-up bill synced by POS into Tbl_HoldUpsCloud (read-only)
      if (!invoiceNo) {
        try {
          const q2 = tx.request();
          q2.input("table", sql.VarChar(20), input.tableNo);
          const r2 = await q2.query(`
            SELECT TOP 1 LTRIM(RTRIM(InvoiceNo)) AS InvoiceNo
            FROM dbo.Tbl_HoldUpsCloud WITH (NOLOCK)
            WHERE LTRIM(RTRIM(TabelNo)) = @table
              AND ISNULL(IsPaid, 0) = 0
            ORDER BY TxnDateTime DESC;
          `);
          if (r2.recordset.length && s(r2.recordset[0].InvoiceNo)) {
            invoiceNo = s(r2.recordset[0].InvoiceNo);
          }
        } catch {
          /* Tbl_HoldUpsCloud optional */
        }
      }

      // (c) If POS already deleted TempQR rows and has not synced Tbl_HoldUpsCloud yet,
      //     reuse the guest cart's active InvoiceNo unless settled in POS.
      if (!invoiceNo && input.existingInvoiceNo) {
        const settled = await isInvoiceSettled(tx, input.existingInvoiceNo);
        if (!settled) {
          invoiceNo = input.existingInvoiceNo;
        }
      }

      // (d) Brand-new table order -> fresh INV serial
      if (!invoiceNo) {
        invoiceNo = await generateInvoiceNo(tx, invoiceMax, input.locCode);
      }
    }

    /* 5) OrderNo — ALWAYS generated fresh from Tbl_Serials ('ODN')
          even when adding items to an existing InvoiceNo! */
    const orderNo = await generateOrderNo(tx, orderNoMax, input.locCode);

    /* 6) RowLine — check current MAX(RowLine) in Tbl_HoldUpsCloudTempQR
          (rows are deleted by POS as it imports them, so start from
          ISNULL(MAX(RowLine), 0) + 1 and increment by 1 per item). */
    const maxRowRes = await tx.request().query(`
      SELECT ISNULL(MAX(RowLine), 0) AS MaxRowLine
      FROM dbo.Tbl_HoldUpsCloudTempQR WITH (TABLOCKX, HOLDLOCK);
    `);
    let nextRowLine = Math.floor(n(maxRowRes.recordset[0]?.MaxRowLine));

    const locValue = fit(TARGET_TABLE, "LocCode", input.locCode);
    const tableValue = fit(TARGET_TABLE, "TabelNo", resolvedTableNo);
    const orderNoValue = fit(TARGET_TABLE, "OrderNo", orderNo);
    const userIdValue = fit(TARGET_TABLE, "UserID", "QR");
    const userNameValue = fit(TARGET_TABLE, "UserName", "QR");
    const aorValue = fit(TARGET_TABLE, "AOR", "A");
    const grpValue = fit(TARGET_TABLE, "TabelGrpID", input.takeaway ? "" : tableGrpId);
    const mgrIdValue = fit(TARGET_TABLE, "MgrID", "");
    const orderTypeValue = fit(TARGET_TABLE, "OrderType", input.takeaway ? "TA" : "DI");
    const voidRemarkValue = fit(TARGET_TABLE, "VoidRemark", "");
    const invoiceValue = fit(TARGET_TABLE, "InvoiceNo", invoiceNo);
    const cusNameValue = fit(TARGET_TABLE, "CusName", input.customerName);
    const cusCodeValue = fit(
      TARGET_TABLE,
      "CusCode",
      input.customerCode || normalisePhone(input.customerPhone) || input.customerPhone
    );

    /* 7) Save ONLY into dbo.Tbl_HoldUpsCloudTempQR */
    for (const line of priced) {
      nextRowLine += 1;
      const itemValue = fit(TARGET_TABLE, "ItemCode", line.itemId);
      const remarkValue = fit(TARGET_TABLE, "ItemRemarks", line.remark ?? "");

      const ins = tx.request();
      ins.input("locCode", sql.Char(10), locValue);
      ins.input("table", sql.Char(10), tableValue);
      ins.input("orderNo", sql.Char(10), orderNoValue);
      ins.input("userId", sql.Char(10), userIdValue);
      ins.input("userName", sql.VarChar(50), userNameValue);
      ins.input("aor", sql.Char(1), aorValue);
      ins.input("item", sql.Char(10), itemValue);
      ins.input("qty", sql.Float, line.quantity);
      ins.input("remark", sql.VarChar(500), remarkValue);
      ins.input("grp", sql.Char(10), grpValue);
      ins.input("lpx", sql.Float, input.takeaway ? 0 : input.localPax);
      ins.input("fpx", sql.Float, input.takeaway ? 0 : input.foreignPax);
      ins.input("mgrId", sql.Char(10), mgrIdValue);
      ins.input("orderType", sql.VarChar(5), orderTypeValue);
      ins.input("price", sql.Float, line.price);
      ins.input("voidRemark", sql.VarChar(200), voidRemarkValue);
      ins.input("inv", sql.VarChar(50), invoiceValue);
      ins.input("isPaid", sql.Bit, 0);
      ins.input("cusName", sql.VarChar(200), cusNameValue);
      ins.input("cusCode", sql.Char(10), cusCodeValue);
      ins.input("rowLine", sql.Float, nextRowLine);

      await ins.query(`
        INSERT INTO dbo.Tbl_HoldUpsCloudTempQR (
          LocCode, TabelNo, OrderNo, UserID, UserName, AOR,
          ItemCode, QTY, ItemRemarks, TabelGrpID, TxnDateTime,
          LPax, FPax, MgrID, OrderType, SalesPrice, VoidRemark,
          InvoiceNo, IsPaid, CusName, CusCode, RowLine
        ) VALUES (
          @locCode, @table, @orderNo, @userId, @userName, @aor,
          @item, @qty, @remark, @grp, DATEADD(MINUTE, 330, GETUTCDATE()),
          @lpx, @fpx, @mgrId, @orderType, @price, @voidRemark,
          @inv, @isPaid, @cusName, @cusCode, @rowLine
        );
      `);
    }

    await tx.commit();
    return {
      tableNo: tableValue,
      tableGroup: dbTableGroup,
      invoiceNo: invoiceValue,
      orderNo: orderNoValue,
      locCode: locValue,
      itemCount: priced.reduce((a, i) => a + i.quantity, 0),
      source: "database",
      orderType: input.takeaway ? "TA" : "DI",
    };
  } catch (err) {
    try {
      await tx.rollback();
    } catch {
      /* already rolled back */
    }
    if (err instanceof OrderError) throw err;

    const errNumber = (err as { number?: number })?.number;
    if (errNumber === 8152) {
      const dump: string[] = [];
      for (const [table, colsMap] of colSizeCache) {
        dump.push(
          `  ${table}: ${Object.entries(colsMap)
            .map(([c, l]) => `${c}=${l}`)
            .join(", ")}`
        );
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

/* ── Existing unpaid bill for a table (READ-ONLY) ─────────────
   Reads any open bill synced by POS into Tbl_HoldUpsCloud PLUS any
   newly submitted QR lines still queued in Tbl_HoldUpsCloudTempQR
   (before POS imports and deletes them). */
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

export async function getExistingBill(
  tableNo: string,
  locCode: string = ""
): Promise<ExistingBill> {
  const table = s(tableNo);
  const loc = s(locCode);
  if (!table || isTakeawayTable(table) || !isDbConfigured())
    return { invoiceNo: "", lines: [] };

  const pool = await getPool();
  const byKey = new Map<string, ExistingBillLine>();
  let invoiceNo = "";

  // 1) Open hold-up bill synced by POS in Tbl_HoldUpsCloud (if present)
  try {
    const req1 = pool.request();
    req1.input("table", sql.VarChar(20), table);
    const res1 = await req1.query(`
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
    for (const r of res1.recordset) {
      if (!invoiceNo) invoiceNo = s(r.InvoiceNo);
      if (s(r.InvoiceNo) !== invoiceNo) continue;
      const key = `${s(r.ItemCode)}|${s(r.ItemRemarks)}`;
      const prev = byKey.get(key);
      if (prev) prev.qty += n(r.QTY);
      else {
        byKey.set(key, {
          itemCode: s(r.ItemCode),
          name: s(r.ItemName),
          qty: n(r.QTY),
          remark: s(r.ItemRemarks),
          price: n(r.SalesPrice),
        });
      }
    }
  } catch {
    /* Tbl_HoldUpsCloud optional */
  }

  // 2) Pending QR lines still waiting in Tbl_HoldUpsCloudTempQR
  try {
    const req2 = pool.request();
    req2.input("table", sql.VarChar(20), table);
    req2.input("loc", sql.VarChar(20), loc);
    const res2 = await req2.query(`
      SELECT LTRIM(RTRIM(q.InvoiceNo)) AS InvoiceNo,
             LTRIM(RTRIM(q.ItemCode)) AS ItemCode,
             ISNULL(NULLIF(LTRIM(RTRIM(m.MenuItmDes)), ''), LTRIM(RTRIM(q.ItemCode))) AS ItemName,
             q.QTY, ISNULL(q.ItemRemarks, '') AS ItemRemarks, q.SalesPrice
      FROM dbo.Tbl_HoldUpsCloudTempQR AS q WITH (NOLOCK)
      LEFT JOIN dbo.Tbl_MenuItems AS m WITH (NOLOCK)
        ON m.MenuItmId = q.ItemCode
      WHERE LTRIM(RTRIM(q.TabelNo)) = @table
        AND (@loc = '' OR LTRIM(RTRIM(q.LocCode)) = @loc)
        AND ISNULL(q.IsPaid, 0) = 0
      ORDER BY q.RowLine, q.TxnDateTime;
    `);
    for (const r of res2.recordset) {
      if (!invoiceNo) invoiceNo = s(r.InvoiceNo);
      if (s(r.InvoiceNo) !== invoiceNo) continue;
      const key = `${s(r.ItemCode)}|${s(r.ItemRemarks)}`;
      const prev = byKey.get(key);
      if (prev) prev.qty += n(r.QTY);
      else {
        byKey.set(key, {
          itemCode: s(r.ItemCode),
          name: s(r.ItemName),
          qty: n(r.QTY),
          remark: s(r.ItemRemarks),
          price: n(r.SalesPrice),
        });
      }
    }
  } catch {
    /* Tbl_HoldUpsCloudTempQR not created yet */
  }

  return {
    invoiceNo,
    lines: [...byKey.values()].filter((l) => l.itemCode && l.qty > 0),
  };
}
