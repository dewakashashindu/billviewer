#!/usr/bin/env node
// ============================================================
// Detailed DB Connection & Error Diagnostic Script
// ============================================================
import fs from "node:fs";
import path from "node:path";
import sql from "mssql";

// 1. Load .env file
const envPath = path.join(process.cwd(), ".env");
const envLocalPath = path.join(process.cwd(), ".env.local");

let loadedFile = null;
for (const p of [envLocalPath, envPath]) {
  if (fs.existsSync(p)) {
    loadedFile = p;
    const content = fs.readFileSync(p, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*\$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']\$/g, "").trim();
      }
    }
  }
}

console.log("\n============================================");
console.log("🔍 DATABASE DIAGNOSTIC TOOL");
console.log("============================================");

if (loadedFile) {
  console.log(`📄 Env File Loaded: ${loadedFile}`);
} else {
  console.error("❌ ERROR: .env හෝ .env.local file එකක් හමුවූයේ නැත!");
  process.exit(1);
}

// Environment variables check
const server = process.env.DB_SERVER;
const database = process.env.DB_DATABASE;
const user = process.env.DB_USER;
const password = process.env.DB_PASSWORD;
const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 1433;

console.log(`📡 Server:   '${server}'`);
console.log(`🗄️ Database: '${database}'`);
console.log(`👤 User:     '${user}'`);
console.log(`🔑 Password: '${password ? "****** (Loaded)" : "NOT SET!"}'`);
console.log(`🔌 Port:     ${port}`);
console.log("--------------------------------------------");

if (!server || !database || !user || !password) {
  console.error("❌ ERROR: DB variables (.env) හරියාකාරව සෙට් වී නොමැත.");
  process.exit(1);
}

// Test Configuration 1: encrypt=false, trustServerCertificate=true (Standard for SmarterASP)
const config = {
  user: user,
  password: password,
  server: server,
  database: database,
  port: port,
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  connectionTimeout: 15000,
  requestTimeout: 15000,
};

async function runDiagnostics() {
  console.log("⏳ Connecting to SQL Server...");
  try {
    const pool = await new sql.ConnectionPool(config).connect();
    console.log("\n✅ SUCCESS: Database එකට සාර්ථකව Connect වුණා! 🎉\n");

    const result = await pool.request().query("SELECT DB_NAME() AS current_db, @@VERSION AS version");
    console.log(`📌 Connected DB Name: ${result.recordset[0].current_db}`);
    console.log(`ℹ️ Server Version:    ${result.recordset[0].version.split("\n")[0]}`);

    // Check Tbl_BillHeader count
    const countRes = await pool.request().query("SELECT COUNT(*) AS total FROM Tbl_BillHeader WITH (NOLOCK)");
    console.log(`📊 Total Bills in Tbl_BillHeader: ${countRes.recordset[0].total}`);

    await pool.close();
    console.log("\n============================================\n");
  } catch (err) {
    console.error("\n❌ CONNECTION FAILED! Exact Error Details:\n");
    console.error(`Name:    ${err.name}`);
    console.error(`Message: ${err.message}`);
    console.error(`Code:    ${err.code || "N/A"}`);
    if (err.originalError) {
      console.error(`Driver Error: ${err.originalError.message}`);
    }

    console.log("\n🛠️ REASON ANALYSIS (හේතුව):");
    if (err.message.includes("Login failed")) {
      console.log("👉 **User Name** හෝ **Password** එක වැරදියි! SmarterASP එකෙන් DB Password එක Reset කරන්න.");
    } else if (err.message.includes("Cannot open database")) {
      console.log("👉 **Database Name** (`db_acfab4_milamirissa`) එක වැරදියි හෝ DB එක active නැත.");
    } else if (err.message.includes("Failed to connect") || err.code === "ESOCKET" || err.name === "WebRequestError") {
      console.log("👉 **Server Host Name** හෝ **Port** එක වැරදියි, නැතහොත් Local Router/Firewall මගින් Block වේ.");
    } else {
      console.log("👉 SQL Driver Config / SSL Issue එකක් විය හැක.");
    }
    console.log("============================================\n");
  }
}

runDiagnostics();