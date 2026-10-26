// ============================================================
// LOCATION: lib/customerService.ts        (SERVER ONLY)
//
// Customer master bridge for the QR ordering flow.
//
//   Tbl_CustomerMaster
//     • phone  = RegTel (or CusTel / Mobile / Phone on other installs)
//     • code   = CusCode, generated from Tbl_TxnNumbers
//
//   Tbl_TxnNumbers  (TxnType = 'CC', one counter PER location)
//     LocCode 01 | CC | Prefix 'A' | TxnNo  4
//       → next customer  A000005   (Prefix + TxnNo zero-padded 6)
//
// Everything here runs inside the caller's SQL transaction, so a
// failed order rolls the customer row back too (no orphans) and two
// guests confirming at the same second can never share a code
// (UPDLOCK / HOLDLOCK on the counter row).
//
// The customer NEVER sees the CusCode — it is only used to link
// dbo.Tbl_HoldUpsCloudTempQR back to Tbl_CustomerMaster for the POS.
// ============================================================
import sql from "mssql";

export type Db = sql.ConnectionPool | sql.Transaction;

const CUSTOMER_TABLE = "Tbl_CustomerMaster";
const TXN_TABLE = "Tbl_TxnNumbers";

/** Location used when the QR link carries no LocCode. */
export function defaultLocCode(): string {
  const v = (process.env.DEFAULT_LOC_CODE ?? "").trim();
  return v || "01";
}

/** Digits of the numeric part of CusCode ("A000004" → 6). */
function codePad(): number {
  const w = Number(process.env.CUSTOMER_CODE_PAD ?? 6);
  return Number.isFinite(w) && w >= 1 && w <= 9 ? Math.floor(w) : 6;
}

/* ── phone normalisation ─────────────────────────────────────
   CusCode/RegTel on this POS are local 10-digit numbers:
     "+94 77 123 4567" → "0771234567"
     "0094 77 …"       → "0771234567"
     "94771234567"     → "0771234567"                        */
export function normalisePhone(raw: string): string {
  let d = String(raw ?? "").replace(/[^0-9]/g, "");
  if (d.startsWith("0094")) d = `0${d.slice(4)}`; // 0094 77 …
  else if (d.startsWith("94") && d.length >= 11) d = `0${d.slice(2)}`; // +94 77 …
  if (d.length > 10 && !d.startsWith("0")) d = d.slice(-10);
  return d.slice(0, 10);
}

/** SQL expression: strip every non-digit character from a column. */
function digitsOnlySql(colExpr: string): string {
  let expr = `LTRIM(RTRIM(CAST(${colExpr} AS VARCHAR(50))))`;
  for (const junk of [" ", "-", "+", "(", ")", ".", "/", "\\"]) {
    expr = `REPLACE(${expr}, '${junk}', '')`;
  }
  return expr;
}

/* ── schema inspection (POS installs differ) ──────────────── */
interface ColMeta {
  name: string;
  type: string;
  nullable: boolean;
  hasDefault: boolean;
  isIdentity: boolean;
  maxLen: number | null;
}
type TableSchema = Map<string, ColMeta>; // key = UPPER(column)

const schemaCache = new Map<string, TableSchema>();

async function tableSchema(db: Db, table: string): Promise<TableSchema> {
  const key = table.toUpperCase();
  const cached = schemaCache.get(key);
  if (cached) return cached;

  const req = db.request();
  req.input("t", sql.VarChar(128), table);
  const res = await req.query(`
    SELECT
      COLUMN_NAME AS c,
      LOWER(DATA_TYPE) AS dt,
      IS_NULLABLE AS nul,
      COLUMN_DEFAULT AS def,
      COLUMNPROPERTY(OBJECT_ID(TABLE_SCHEMA + '.' + TABLE_NAME), COLUMN_NAME, 'IsIdentity') AS isId,
      CHARACTER_MAXIMUM_LENGTH AS maxLen
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = @t;
  `);

  const map: TableSchema = new Map();
  for (const r of res.recordset) {
    const name = String(r.c ?? "");
    if (!name) continue;
    map.set(name.toUpperCase(), {
      name,
      type: String(r.dt ?? "").toLowerCase(),
      nullable: String(r.nul ?? "").toUpperCase() === "YES",
      hasDefault: r.def != null,
      isIdentity: Number(r.isId) === 1,
      maxLen: r.maxLen == null ? null : Number(r.maxLen),
    });
  }
  if (map.size) schemaCache.set(key, map);
  return map;
}

/**
 * Pick the first column that exists out of the candidates.
 * `upperToName` maps UPPER(column) → real column name (as read from
 * INFORMATION_SCHEMA), so the returned name can be used in SQL.
 */
export function findColumnName(
  upperToName: Map<string, string> | undefined,
  candidates: string[]
): string | null {
  if (!upperToName) return null;
  for (const c of candidates) {
    const hit = upperToName.get(c.toUpperCase());
    if (hit) return hit;
  }
  return null;
}

/** Pick the first column that exists out of the candidates. */
function pickCol(schema: TableSchema, candidates: string[]): string | null {
  for (const c of candidates) {
    const hit = schema.get(c.toUpperCase());
    if (hit) return hit.name;
  }
  return null;
}

interface CustomerTable {
  codeCol: string;
  nameCol: string;
  phoneCol: string | null;
  locCol: string | null;
  enableCol: string | null;
  schema: TableSchema;
}

const customerTableCache = new Map<string, CustomerTable>();

async function customerTable(db: Db): Promise<CustomerTable> {
  const cached = customerTableCache.get("v1");
  if (cached) return cached;

  const schema = await tableSchema(db, CUSTOMER_TABLE);
  const info: CustomerTable = {
    codeCol: pickCol(schema, ["CusCode", "CustomerCode", "Code"]) ?? "CusCode",
    nameCol: pickCol(schema, ["CusName", "CustomerName", "Name"]) ?? "CusName",
    phoneCol: pickCol(schema, ["RegTel", "CusTel", "CusMobile", "Mobile", "Phone", "ContactNo"]),
    locCol: pickCol(schema, ["LocCode", "LocationCode"]),
    enableCol: pickCol(schema, ["Enable", "IsActive", "Enabled"]),
    schema,
  };

  if (!info.phoneCol) {
    console.warn(
      `⚠️ ${CUSTOMER_TABLE}: phone column හම්බුනේ නෑ (RegTel / CusTel / Mobile) — customer lookup/register skip වෙනවා`
    );
  }
  if (info.schema.size) customerTableCache.set("v1", info);
  return info;
}

/* ── read: phone → customer ───────────────────────────────────
   Matches on the last 9 digits of the stored number, so
   "0779792705", "+94 77 979 2705" and "0094779792705" all find the
   same row. `lock` adds UPDLOCK/HOLDLOCK — use it inside the
   create transaction so two guests with the same phone cannot both
   create a customer.                                                */
export async function findCustomerByPhone(
  db: Db,
  phone: string,
  opts: { lock?: boolean } = {}
): Promise<{ cusCode: string; cusName: string } | null> {
  const info = await customerTable(db);
  if (!info.phoneCol) return null;

  const digits = normalisePhone(phone);
  if (digits.length < 9) return null;

  const req = db.request();
  req.input("phone", sql.VarChar(20), digits);
  const hint = opts.lock ? "UPDLOCK, HOLDLOCK" : "NOLOCK";
  const res = await req.query(`
    SELECT TOP 1
      LTRIM(RTRIM(CAST([${info.codeCol}] AS VARCHAR(20)))) AS CusCode,
      LTRIM(RTRIM(CAST([${info.nameCol}] AS VARCHAR(200)))) AS CusName
    FROM dbo.${CUSTOMER_TABLE} WITH (${hint})
    WHERE ${info.enableCol ? `ISNULL([${info.enableCol}], 1) = 1 AND ` : ""}
          RIGHT(${digitsOnlySql(`[${info.phoneCol}]`)}, 9) = RIGHT(@phone, 9)
    ORDER BY [${info.codeCol}];
  `);

  if (!res.recordset.length) return null;
  const row = res.recordset[0];
  const cusCode = String(row.CusCode ?? "").trim();
  if (!cusCode) return null;
  return { cusCode, cusName: String(row.CusName ?? "").trim() };
}

/* ── Tbl_TxnNumbers ('CC') — per-location customer counter ── */
interface TxnTable {
  locCol: string;
  typeCol: string;
  prefixCol: string;
  noCol: string;
  descCol: string | null;
  enableCol: string | null;
  schema: TableSchema;
}

const txnTableCache = new Map<string, TxnTable>();

async function txnTable(db: Db): Promise<TxnTable> {
  const cached = txnTableCache.get("v1");
  if (cached) return cached;

  const schema = await tableSchema(db, TXN_TABLE);
  const info: TxnTable = {
    locCol: pickCol(schema, ["LocCode", "LocationCode"]) ?? "LocCode",
    typeCol: pickCol(schema, ["TxnType", "TransType", "Type"]) ?? "TxnType",
    prefixCol: pickCol(schema, ["Prefix", "PreFix", "Pre"]) ?? "Prefix",
    noCol: pickCol(schema, ["TxnNo", "TransNo", "No"]) ?? "TxnNo",
    descCol: pickCol(schema, ["TxnDescription", "Description", "Des"]),
    enableCol: pickCol(schema, ["Enable", "IsActive", "Enabled"]),
    schema,
  };
  if (schema.size) txnTableCache.set("v1", info);
  return info;
}

const TXN_TYPE_CUSTOMER = "CC"; // Create Customer

/** "A" + 5 → "A000005" (width auto-shortened for a long prefix). */
export function buildCustomerCode(prefix: string, seq: number, maxLen = 10): string {
  const p = String(prefix ?? "").trim();
  const digits = String(Math.max(1, Math.floor(Number(seq) || 1)));
  const width = Math.max(1, Math.min(codePad(), maxLen - p.length));
  const padded = digits.length >= width ? digits : digits.padStart(width, "0");
  return `${p}${padded}`.slice(0, maxLen || 50);
}

async function customerCodeExists(db: Db, code: string): Promise<boolean> {
  const info = await customerTable(db);
  const req = db.request();
  req.input("code", sql.VarChar(20), code);
  const res = await req.query(`
    SELECT TOP 1 1 AS Hit
    FROM dbo.${CUSTOMER_TABLE} WITH (UPDLOCK, HOLDLOCK)
    WHERE LTRIM(RTRIM(CAST([${info.codeCol}] AS VARCHAR(20)))) = @code;
  `);
  return res.recordset.length > 0;
}

/**
 * Reserve the next customer code for `locCode`.
 * MUST run inside a transaction — the counter row is locked with
 * UPDLOCK/HOLDLOCK so concurrent QR orders get different numbers.
 */
export async function nextCustomerCode(
  tx: sql.Transaction,
  locCode: string
): Promise<{ code: string; seq: number; prefix: string }> {
  const info = await txnTable(tx);
  const loc = (locCode || defaultLocCode()).trim().slice(0, 10);

  const sel = tx.request();
  sel.input("loc", sql.VarChar(20), loc);
  const res = await sel.query(`
    SELECT TOP 1
      LTRIM(RTRIM(CAST([${info.prefixCol}] AS VARCHAR(10)))) AS Prefix,
      [${info.noCol}] AS TxnNo
    FROM dbo.${TXN_TABLE} WITH (UPDLOCK, HOLDLOCK)
    WHERE LTRIM(RTRIM(CAST([${info.locCol}] AS VARCHAR(20)))) = @loc
      AND LTRIM(RTRIM(CAST([${info.typeCol}] AS VARCHAR(20)))) = '${TXN_TYPE_CUSTOMER}'
      ${info.enableCol ? `AND ISNULL([${info.enableCol}], 1) = 1` : ""}
    ORDER BY [${info.noCol}] DESC;
  `);

  let prefix = "A";
  let start = 0;

  if (res.recordset.length) {
    const row = res.recordset[0];
    prefix = String(row.Prefix ?? "").trim() || "A";
    start = Math.floor(Number(row.TxnNo) || 0);
  } else {
    /* No counter for this location yet — provision one (TxnNo = 0,
       so the first customer becomes A000001). */
    const ins = tx.request();
    const cols = [`[${info.locCol}]`, `[${info.typeCol}]`, `[${info.prefixCol}]`, `[${info.noCol}]`];
    const vals = ["@loc", "@type", "@prefix", "@zero"];
    ins.input("loc", sql.VarChar(20), loc);
    ins.input("type", sql.VarChar(20), TXN_TYPE_CUSTOMER);
    ins.input("prefix", sql.VarChar(10), prefix);
    ins.input("zero", sql.Float, 0);
    if (info.descCol) {
      cols.push(`[${info.descCol}]`);
      vals.push("@des");
      ins.input("des", sql.VarChar(100), "Create Customer");
    }
    if (info.enableCol) {
      cols.push(`[${info.enableCol}]`);
      vals.push("@en");
      ins.input("en", sql.Bit, true);
    }
    /* any other NOT NULL column without a default must be filled */
    let extra = 0;
    for (const [upper, meta] of info.schema) {
      const handled = new Set(
        [info.locCol, info.typeCol, info.prefixCol, info.noCol, info.descCol, info.enableCol]
          .filter((x): x is string => Boolean(x))
          .map((x) => x.toUpperCase())
      );
      if (handled.has(upper) || meta.isIdentity || meta.nullable || meta.hasDefault) continue;
      const p = `x${extra++}`;
      cols.push(`[${meta.name}]`);
      vals.push(`@${p}`);
      if (meta.type.includes("date") || meta.type.includes("time")) {
        ins.input(p, sql.DateTime, new Date());
      } else if (meta.type === "bit") {
        ins.input(p, sql.Bit, false);
      } else if (
        /int|float|decimal|numeric|money|real/.test(meta.type)
      ) {
        ins.input(p, sql.Float, 0);
      } else {
        ins.input(p, sql.VarChar(50), "");
      }
    }
    await ins.query(`
      INSERT INTO dbo.${TXN_TABLE} (${cols.join(", ")})
      VALUES (${vals.join(", ")});
    `);
  }

  /* Walk forward until a code that is not already in the master
     table is found — keeps working even when the counter is out of
     sync with the existing CusCode values. */
  const upd = (seq: number) => {
    const r = tx.request();
    r.input("locUpd", sql.VarChar(20), loc);
    r.input("seq", sql.Float, seq);
    return r.query(`
      UPDATE dbo.${TXN_TABLE}
      SET [${info.noCol}] = @seq
      WHERE LTRIM(RTRIM(CAST([${info.locCol}] AS VARCHAR(20)))) = @locUpd
        AND LTRIM(RTRIM(CAST([${info.typeCol}] AS VARCHAR(20)))) = '${TXN_TYPE_CUSTOMER}';
    `);
  };

  for (let i = 1; i <= 50; i += 1) {
    const seq = start + i;
    const code = buildCustomerCode(prefix, seq);
    if (await customerCodeExists(tx, code)) continue;
    await upd(seq);
    return { code, seq, prefix };
  }

  throw new Error(
    `Could not allocate a customer code for location ${loc} (Tbl_TxnNumbers '${TXN_TYPE_CUSTOMER}' counter is exhausted)`
  );
}

/* ── INSERT helpers ─────────────────────────────────────────── */
function fillValue(meta: ColMeta): unknown {
  if (meta.type.includes("date") || meta.type.includes("time")) return new Date();
  if (meta.type === "bit") return false;
  if (/int|float|decimal|numeric|money|real/.test(meta.type)) return 0;
  return "";
}

async function insertCustomer(
  tx: sql.Transaction,
  input: { locCode: string; phone: string; name: string; code: string }
): Promise<void> {
  const info = await customerTable(tx);
  if (!info.phoneCol) throw new Error("Tbl_CustomerMaster has no phone column");

  const req = tx.request();
  const cols: string[] = [];
  const vals: string[] = [];
  const used = new Set<string>();

  const put = (colName: string, param: string, type: sql.ISqlType | (() => sql.ISqlType), value: unknown) => {
    cols.push(`[${colName}]`);
    vals.push(`@${param}`);
    (req.input as (name: string, t: unknown, v: unknown) => void)(param, type, value);
    used.add(colName.toUpperCase());
  };

  put(info.codeCol, "code", sql.VarChar(20), input.code.slice(0, 20));
  put(info.nameCol, "name", sql.VarChar(200), input.name.slice(0, 200));
  put(info.phoneCol, "phone", sql.VarChar(30), input.phone.slice(0, 30));
  if (info.locCol) put(info.locCol, "loc", sql.VarChar(20), input.locCode.slice(0, 10));
  if (info.enableCol) put(info.enableCol, "enable", sql.Bit, true);

  /* anything NOT NULL without a default still needs a value */
  let extra = 0;
  for (const [upper, meta] of info.schema) {
    if (used.has(upper) || meta.isIdentity || meta.nullable || meta.hasDefault) continue;
    const p = `ex${extra++}`;
    cols.push(`[${meta.name}]`);
    vals.push(`@${p}`);
    const value = fillValue(meta);
    if (value instanceof Date) req.input(p, sql.DateTime, value);
    else if (typeof value === "boolean") req.input(p, sql.Bit, value);
    else if (typeof value === "number") req.input(p, sql.Float, value);
    else req.input(p, sql.VarChar(50), String(value));
  }

  await req.query(`
    INSERT INTO dbo.${CUSTOMER_TABLE} (${cols.join(", ")})
    VALUES (${vals.join(", ")});
  `);
}

/* ── resolve-or-create ──────────────────────────────────────
   Called from POST /api/customer/register (guest form "Continue")
   and again from confirmOrder as a safety net. Returns the real
   Tbl_CustomerMaster.CusCode.                                  */
export async function resolveOrCreateCustomer(
  tx: sql.Transaction,
  input: { locCode?: string; phone: string; name: string }
): Promise<{ cusCode: string; cusName: string; created: boolean }> {
  const phone = normalisePhone(input.phone);
  const name = String(input.name ?? "").trim().slice(0, 200);
  const locCode = (input.locCode || defaultLocCode()).trim().slice(0, 10);

  if (phone.length < 9) throw new Error("A valid phone number is required.");
  if (name.length < 2) throw new Error("A customer name is required.");

  /* 1) already registered? (range-locked → no duplicate customers) */
  const existing = await findCustomerByPhone(tx, phone, { lock: true });
  if (existing) {
    return { cusCode: existing.cusCode, cusName: existing.cusName, created: false };
  }

  /* 2) brand-new customer — CusCode from Tbl_TxnNumbers ('CC') */
  const { code } = await nextCustomerCode(tx, locCode);
  await insertCustomer(tx, { locCode, phone, name, code });

  /* 3) read it back (identity column / trigger safe) */
  const saved = await findCustomerByPhone(tx, phone);
  return {
    cusCode: saved?.cusCode || code,
    cusName: saved?.cusName || name,
    created: true,
  };
}
