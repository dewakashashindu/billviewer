#!/usr/bin/env node
// ============================================================
// scripts/inspect-customer-schema.mjs
//
// STEP 1 of docs/plan-customer-cuscode.md
//
// Dumps everything we need to know before writing the real
// CusCode generator:
//   • Tbl_CustomerMaster  — every column, type, nullability,
//                           default, identity, max length
//   • Tbl_TxnNumbers      — all rows (LocCode / TxnType / Prefix / TxnNo)
//   • existing CusCode    — pattern + max value per location
//   • duplicate phones    — data hygiene check
//   • Tbl_HoldUpsCloudTempQR — what CusCode values are landing now
//
// Usage:
//   node scripts/inspect-customer-schema.mjs
//
// Reads DB_* from .env.local (or the process environment).
// ============================================================
import fs from "node:fs";
import path from "node:path";
import sql from "mssql";

/* ── tiny .env loader (no dependency) ─────────────────────── */
function loadEnv() {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv();

const cfg = {
  server: process.env.DB_SERVER,
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: String(process.env.DB_ENCRYPT ?? "true") !== "false",
    trustServerCertificate:
      String(process.env.DB_TRUST_SERVER_CERT ?? "true") !== "false",
    enableArithAbort: true,
  },
  pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
};

if (!cfg.server || !cfg.database || !cfg.user) {
  console.error(
    "\n✖ DB_SERVER / DB_DATABASE / DB_USER not set.\n" +
      "  Fill them in .env.local first (see .env.example).\n"
  );
  process.exit(1);
}

const line = (s = "") => console.log(s);
const h1 = (s) => console.log(`\n${"═".repeat(70)}\n${s}\n${"═".repeat(70)}`);

async function safeQuery(pool, label, query) {
  try {
    const res = await pool.request().query(query);
    return res.recordset;
  } catch (err) {
    console.warn(`  ⚠ ${label} — ${err.message}`);
    return null;
  }
}

function table(rows, cols) {
  if (!rows || !rows.length) return line("  (no rows)");
  const widths = {};
  for (const c of cols) {
    widths[c] = Math.max(
      c.length,
      ...rows.map((r) => String(r[c] ?? "").length)
    );
  }
  line("  " + cols.map((c) => c.padEnd(widths[c])).join("  "));
  line("  " + cols.map((c) => "-".repeat(widths[c])).join("  "));
  for (const r of rows) {
    line("  " + cols.map((c) => String(r[c] ?? "").padEnd(widths[c])).join("  "));
  }
}

const pool = await sql.connect(cfg);
line(`✔ connected: ${cfg.server} / ${cfg.database}`);

/* ── 1. Tbl_CustomerMaster columns ────────────────────────── */
h1("1. Tbl_CustomerMaster — COLUMNS");
const cols = await safeQuery(
  pool,
  "Tbl_CustomerMaster not found",
  `
  SELECT
    ORDINAL_POSITION              AS Pos,
    COLUMN_NAME                   AS ColumnName,
    LOWER(DATA_TYPE)              AS DataType,
    CHARACTER_MAXIMUM_LENGTH      AS MaxLen,
    NUMERIC_PRECISION             AS Prec,
    NUMERIC_SCALE                 AS Scale,
    IS_NULLABLE                   AS IsNullable,
    ISNULL(CAST(COLUMN_DEFAULT AS VARCHAR(100)), '') AS ColDefault,
    COLUMNPROPERTY(OBJECT_ID(TABLE_SCHEMA + '.' + TABLE_NAME), COLUMN_NAME, 'IsIdentity') AS IsIdentity
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'Tbl_CustomerMaster'
  ORDER BY ORDINAL_POSITION;
`
);
table(cols, ["Pos", "ColumnName", "DataType", "MaxLen", "IsNullable", "ColDefault", "IsIdentity"]);

if (cols && cols.length) {
  const required = cols.filter(
    (c) =>
      String(c.IsNullable).toUpperCase() === "NO" &&
      !c.ColDefault &&
      Number(c.IsIdentity) !== 1
  );
  line();
  line(
    required.length
      ? `  ⚠ NOT NULL (no default, not identity) → INSERT එකේදී අනිවාර්යයෙන් value දෙන්න ඕන:` +
          `\n     ${required.map((c) => `${c.ColumnName} ${c.DataType}`).join(", ")}`
      : "  ✔ සියලුම NOT NULL columns වලට default/identity තියෙනවා"
  );
}

/* ── 2. Tbl_TxnNumbers ───────────────────────────────────── */
h1("2. Tbl_TxnNumbers — rows");
const txn = await safeQuery(
  pool,
  "Tbl_TxnNumbers not found",
  `
  SELECT LTRIM(RTRIM(LocCode)) AS LocCode,
         LTRIM(RTRIM(TxnType)) AS TxnType,
         '[' + LTRIM(RTRIM(Prefix)) + ']' AS Prefix,
         TxnNo,
         TxnDescription,
         Enable
  FROM dbo.Tbl_TxnNumbers
  ORDER BY LocCode, TxnType;
`
);
table(txn, ["LocCode", "TxnType", "Prefix", "TxnNo", "TxnDescription", "Enable"]);
if (txn) {
  const cc = txn.filter((r) => String(r.TxnType).toUpperCase() === "CC");
  line();
  line(`  CC rows (customer serial): ${cc.length}`);
  for (const r of cc) {
    line(
      `     Loc ${r.LocCode} → next code = ${String(r.Prefix).replace(/\[|\]/g, "")}` +
        `${String(Math.floor(Number(r.TxnNo)) + 1).padStart(4, "0")}   (TxnNo=${r.TxnNo})`
    );
  }
}

/* ── 3. existing CusCode pattern ─────────────────────────── */
h1("3. Existing CusCode pattern (Tbl_CustomerMaster)");
const sample = await safeQuery(
  pool,
  "CusCode sample failed",
  `
  SELECT TOP 20
         '[' + LTRIM(RTRIM(CusCode)) + ']' AS CusCode,
         LEN(LTRIM(RTRIM(CusCode)))        AS CodeLen,
         LTRIM(RTRIM(CusName))             AS CusName,
         LTRIM(RTRIM(ISNULL(RegTel, '')))  AS RegTel,
         LTRIM(RTRIM(ISNULL(LocCode, ''))) AS LocCode
  FROM dbo.Tbl_CustomerMaster
  ORDER BY CusCode DESC;
`
);
table(sample, ["CusCode", "CodeLen", "CusName", "RegTel", "LocCode"]);

const stats = await safeQuery(
  pool,
  "CusCode stats failed",
  `
  SELECT
    COUNT(*)                                        AS TotalCustomers,
    MIN(LEN(LTRIM(RTRIM(CusCode))))                 AS MinLen,
    MAX(LEN(LTRIM(RTRIM(CusCode))))                 AS MaxLen,
    MIN(LTRIM(RTRIM(CusCode)))                      AS MinCode,
    MAX(LTRIM(RTRIM(CusCode)))                      AS MaxCode
  FROM dbo.Tbl_CustomerMaster;
`
);
table(stats, ["TotalCustomers", "MinLen", "MaxLen", "MinCode", "MaxCode"]);

const numericMax = await safeQuery(
  pool,
  "numeric CusCode scan failed",
  `
  SELECT LTRIM(RTRIM(ISNULL(LocCode, '')))  AS LocCode,
         LEFT(LTRIM(RTRIM(CusCode)), 1)     AS Prefix,
         COUNT(*)                           AS Rows_,
         MAX(TRY_CAST(SUBSTRING(LTRIM(RTRIM(CusCode)), 2, 12) AS INT)) AS MaxSeq,
         MAX(LEN(LTRIM(RTRIM(CusCode))))    AS CodeLen
  FROM dbo.Tbl_CustomerMaster
  WHERE TRY_CAST(SUBSTRING(LTRIM(RTRIM(CusCode)), 2, 12) AS INT) IS NOT NULL
  GROUP BY LTRIM(RTRIM(ISNULL(LocCode, ''))), LEFT(LTRIM(RTRIM(CusCode)), 1)
  ORDER BY LocCode, Prefix;
`
);
line();
line("  Per location: prefix + highest sequence (මේක TxnNo counter එකට compare කරන්න)");
table(numericMax, ["LocCode", "Prefix", "Rows_", "MaxSeq", "CodeLen"]);

/* ── 4. duplicate phones ─────────────────────────────────── */
h1("4. Duplicate phone numbers (data hygiene)");
const dups = await safeQuery(
  pool,
  "duplicate scan failed",
  `
  SELECT TOP 20
         REPLACE(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(RegTel)), ' ', ''), '-', ''), '+', ''), '(', '') AS Phone,
         COUNT(*) AS Rows_,
         MIN(LTRIM(RTRIM(CusCode))) AS FirstCode
  FROM dbo.Tbl_CustomerMaster
  WHERE LTRIM(RTRIM(ISNULL(RegTel, ''))) <> ''
  GROUP BY REPLACE(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(RegTel)), ' ', ''), '-', ''), '+', ''), '(', '')
  HAVING COUNT(*) > 1
  ORDER BY COUNT(*) DESC;
`
);
table(dups, ["Phone", "Rows_", "FirstCode"]);
if (dups) {
  line();
  line(
    dups.length
      ? `  ⚠ ${dups.length} duplicate phone groups — lookup එකේදී TOP 1 + ORDER BY CusCode`
      : "  ✔ duplicate phones නෑ"
  );
}

/* ── 5. what is landing in the QR table now ──────────────── */
h1("5. Tbl_HoldUpsCloudTempQR — CusCode now");
const qr = await safeQuery(
  pool,
  "Tbl_HoldUpsCloudTempQR not found",
  `
  SELECT TOP 15
         '[' + LTRIM(RTRIM(CusCode)) + ']' AS CusCode,
         LTRIM(RTRIM(CusName))             AS CusName,
         LTRIM(RTRIM(LocCode))             AS LocCode,
         LTRIM(RTRIM(TabelNo))             AS TabelNo,
         LTRIM(RTRIM(InvoiceNo))           AS InvoiceNo,
         TxnDateTime
  FROM dbo.Tbl_HoldUpsCloudTempQR
  ORDER BY TxnDateTime DESC;
`
);
table(qr, ["CusCode", "CusName", "LocCode", "TabelNo", "InvoiceNo", "TxnDateTime"]);

await pool.close();
h1("DONE — මේ output එක docs/plan-customer-cuscode.md section 11 එකට ගැලපෙන්න බලන්න");
