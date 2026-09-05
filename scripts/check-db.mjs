#!/usr/bin/env node
// ============================================================
// DB connectivity + data check — run this BEFORE wiring the UI
//
//   node scripts/check-db.mjs I000011
//
// Runs the same queries the /api/bill route runs, prints what
// was found + debug dumps when master-table joins fall back
// to raw codes (so we can see what's actually in the DB).
// ============================================================
import fs from "node:fs";
import path from "node:path";
import sql from "mssql";

// Simple .env loader
for (const file of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), file);
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  }
}

const billNo = process.argv[2];
if (!billNo) {
  console.error("Usage: node scripts/check-db.mjs <BillNo>");
  console.error("Example: node scripts/check-db.mjs I000011");
  process.exit(1);
}

if (
  !process.env.DB_SERVER ||
  !process.env.DB_DATABASE ||
  !process.env.DB_USER ||
  !process.env.DB_PASSWORD
) {
  console.error(
    "❌ DB_* env vars missing — .env.local eka fill karanna (see .env.example)"
  );
  process.exit(1);
}

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT !== "false",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== "false",
    enableArithAbort: true,
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

const fmt = (v) => (v == null ? "" : String(v).trim());

async function main() {
  console.log("");
  console.log(
    `Connecting → ${config.server}:${config.port} / ${config.database} as ${config.user}`
  );
  const pool = await new sql.ConnectionPool(config).connect();
  console.log("✅ Connected!");
  console.log("");

  const req = pool.request();
  req.input("billNo", sql.VarChar(50), billNo.trim());

  // ── Header (all master joins) ──
  const header = await req.query(
    `SELECT TOP 1
      h.*,
      ISNULL(NULLIF(LTRIM(RTRIM(l.LocDes)),''), LTRIM(RTRIM(h.LocCode))) AS LocDes,
      ISNULL(NULLIF(LTRIM(RTRIM(om.ModeDes)),''), LTRIM(RTRIM(h.OrderMode))) AS OrderModeDes,
      ISNULL(NULLIF(LTRIM(RTRIM(su.UserName)),''), LTRIM(RTRIM(h.StewID))) AS StewName,
      ISNULL(NULLIF(LTRIM(RTRIM(cu.UserName)),''), LTRIM(RTRIM(h.CasherID))) AS CasherName
    FROM Tbl_BillHeader h WITH (NOLOCK)
    LEFT JOIN Tbl_LocationMaster l WITH (NOLOCK) ON LTRIM(RTRIM(l.LocCode)) = LTRIM(RTRIM(h.LocCode))
    LEFT JOIN Tbl_OrderModes om WITH (NOLOCK) ON LTRIM(RTRIM(om.ModeID)) = LTRIM(RTRIM(h.OrderMode))
    LEFT JOIN Tbl_UserDetails su WITH (NOLOCK) ON LTRIM(RTRIM(su.UserId)) = LTRIM(RTRIM(h.StewID))
    LEFT JOIN Tbl_UserDetails cu WITH (NOLOCK) ON LTRIM(RTRIM(cu.UserId)) = LTRIM(RTRIM(h.CasherID))
    WHERE LTRIM(RTRIM(h.BillNo)) = @billNo`
  );
  const h = header.recordset[0];
  if (!h) {
    console.error(`❌ Tbl_BillHeader eke "${billNo}" kiyaana bill ekak naha`);
    await pool.close();
    process.exit(2);
  }
  console.log("── Tbl_BillHeader ──");
  console.log(
    `  BillNo=${fmt(h.BillNo)}  Txndate=${fmt(h.Txndate)}  TableNo=${fmt(
      h.TableNo
    )}  StewID=${fmt(h.StewID)}  CasherID=${fmt(h.CasherID)}`
  );
  console.log(
    `  Location: ${fmt(h.LocDes)}  |  Order Mode: ${fmt(h.OrderModeDes)}`
  );
  console.log(
    `  Steward: ${fmt(h.StewName)}  |  Cashier: ${fmt(h.CasherName)}`
  );
  console.log(
    `  Gross=${h.Gross}  DisVal=${h.DisVal}  SerChg=${h.SerChg}  VAT=${h.VAT}  TDL=${h.TDL}  NetTotal=${h.NetTotal}`
  );
  console.log(
    `  BillType=${fmt(h.BillType)}  OrderMode=${fmt(h.OrderMode)}  DoNotShowInSales=${h.DoNotShowInSales}`
  );

  // ── OrderModes debug: ModeDes raw code ekama nam → table eka dump karanna ──
  if (fmt(h.OrderModeDes) === fmt(h.OrderMode) && fmt(h.OrderMode)) {
    const modes = await pool
      .request()
      .query(
        `SELECT TOP 20 LTRIM(RTRIM(ModeID)) AS ModeID, LTRIM(RTRIM(ModeDes)) AS ModeDes, LTRIM(RTRIM(ID)) AS ID, Enable FROM Tbl_OrderModes WITH (NOLOCK)`
      );
    console.log(
      `  ⚠️ OrderMode '${fmt(h.OrderMode)}' → Tbl_OrderModes eke ModeID ekakin match une naha. Thiyena rows (sample 20):`
    );
    for (const r of modes.recordset)
      console.log(
        `    ModeID='${r.ModeID}'  ModeDes='${r.ModeDes}'  ID='${r.ID}'  Enable=${r.Enable}`
      );
  }

  // ── UserDetails debug: names ID ekama nam → match check ──
  const staffIds = [...new Set([fmt(h.StewID), fmt(h.CasherID)].filter(Boolean))];
  const staffNames = [fmt(h.StewName), fmt(h.CasherName)];
  if (staffIds.length && staffIds.some((id, i) => staffNames[i] === id)) {
    const uReq = pool.request();
    const params = staffIds.map((id, i) => `@u${i}`).join(",");
    staffIds.forEach((id, i) => uReq.input(`u${i}`, sql.VarChar(20), id));
    const users = await uReq.query(
      `SELECT TOP 20 LTRIM(RTRIM(UserId)) AS UserId, LTRIM(RTRIM(UserName)) AS UserName, LTRIM(RTRIM(LoginName)) AS LoginName, LTRIM(RTRIM(LogName)) AS LogName, Enable
       FROM Tbl_UserDetails WITH (NOLOCK)
       WHERE LTRIM(RTRIM(UserId)) IN (${params})`
    );
    console.log("  ── Tbl_UserDetails match check ──");
    if (!users.recordset.length) {
      console.log(`  ❌ UserId IN (${staffIds.join(", ")}) walata rows naha!`);
      const sample = await pool
        .request()
        .query(
          `SELECT TOP 15 LTRIM(RTRIM(UserId)) AS UserId, LTRIM(RTRIM(UserName)) AS UserName, LTRIM(RTRIM(LoginName)) AS LoginName FROM Tbl_UserDetails WITH (NOLOCK) WHERE Enable = 1`
        );
      console.log("  Thiyena users (Enable=1, sample 15):");
      for (const r of sample.recordset)
        console.log(
          `    UserId='${r.UserId}'  UserName='${r.UserName}'  LoginName='${r.LoginName}'`
        );
    } else {
      for (const r of users.recordset)
        console.log(
          `    UserId='${r.UserId}'  UserName='${r.UserName}'  LoginName='${r.LoginName}'  LogName='${r.LogName}'  Enable=${r.Enable}`
        );
      const matched = new Set(users.recordset.map((r) => r.UserId));
      const missing = staffIds.filter((id, i) => staffNames[i] === id && !matched.has(id));
      if (missing.length)
        console.log(`  ⚠️ Me UserId(s) rows thiyenawata names fallback une naha (UserName empty da?): ${missing.join(", ")}`);
    }
  }
  console.log("");

  // ── Details + item names ──
  const details = await req.query(
    `SELECT
      LTRIM(RTRIM(d.SubItmId)) AS SubItmId, d.Qty, d.SalesPrice, d.TotalItmPrice,
      ISNULL(NULLIF(LTRIM(RTRIM(m.MenuItmDes)), ''),
        ISNULL(NULLIF(LTRIM(RTRIM(m.PrintDes)), ''), LTRIM(RTRIM(d.SubItmId)))
      ) AS ItemName
    FROM Tbl_BillDetails d WITH (NOLOCK)
    LEFT JOIN Tbl_MenuItems m WITH (NOLOCK)
      ON LTRIM(RTRIM(m.MenuItmId)) = LTRIM(RTRIM(d.SubItmId))
    WHERE LTRIM(RTRIM(d.BillNo)) = @billNo
    ORDER BY d.KOTBOTNO, d.SubItmId`
  );
  console.log(`── Tbl_BillDetails (${details.recordset.length} items) ──`);
  for (const d of details.recordset) {
    console.log(
      `  ${fmt(d.ItemName)}  [${fmt(d.SubItmId)}]  x${d.Qty}  = ${d.TotalItmPrice}`
    );
  }
  const unmatched = details.recordset.filter(
    (d) => fmt(d.ItemName) === fmt(d.SubItmId)
  );
  if (unmatched.length) {
    console.log(
      `  ⚠️ ${unmatched.length} item(s) Tbl_MenuItems eke match une naha (ID eka witharak pennanne)`
    );
  }
  console.log("");

  // ── Payments ──
  const pays = await req.query(
    `SELECT LTRIM(RTRIM(p.PayCode)) AS PayCode,
       ISNULL(NULLIF(LTRIM(RTRIM(pm.PayDes)),''), LTRIM(RTRIM(p.PayCode))) AS PayName,
       p.TenderedAmt, p.ActAmt
     FROM Tbl_BillPayTxn p WITH (NOLOCK)
     LEFT JOIN Tbl_PaymentModes pm WITH (NOLOCK) ON LTRIM(RTRIM(pm.PayCode)) = LTRIM(RTRIM(p.PayCode))
     WHERE LTRIM(RTRIM(p.BillNo)) = @billNo`
  );
  console.log(`── Tbl_BillPayTxn (${pays.recordset.length} payments) ──`);
  let total = 0;
  for (const p of pays.recordset) {
    total += p.ActAmt ?? 0;
    console.log(`  ${fmt(p.PayName) || "?"} (code: ${fmt(p.PayCode)})  ActAmt=${p.ActAmt}`);
  }
  if (!pays.recordset.length) console.log("  (payments naha → PENDING wenawa pennanne)");
  else {
    const net = h.NetTotal ?? 0;
    console.log(
      `  → Σ ActAmt=${Math.round(total * 100) / 100} vs NetTotal=${net} → ${
        total + 0.05 >= net ? "PAID ✅" : "PENDING ⏳"
      }`
    );
  }
  console.log("");

  await pool.close();
}

main().catch((err) => {
  console.error("");
  console.error(`❌ DB error: ${err.message}`);
  console.error("");
  console.error("Check list:");
  console.error("  1. DB_SERVER host eka hariyata daala da (e.g. sqlXXXX.site4now.net)");
  console.error("  2. SmarterASP panel eke Remote Access enabled da?");
  console.error("  3. Port 1433 block karana firewall ekak da?");
  console.error("  4. DB_USER format eka hari da (some hosts: user,db-name)");
  process.exit(1);
});
