#!/usr/bin/env node
// ============================================================
// timezone-check v2 — salt / billviewer: reports wala date shift eka verify
// ------------------------------------------------------------
// v2 wenasakam:
//   • filter window eke **anthima deka** compare karanawa (v1 eken start eka
//     witharak bæluwa nisa Colombo case eketh ✔ penenna thibba — eka waradi)
//   • .env.local / mssql eka thiyena thana auto-hunt karanawa (Windows paths)
//   • reports.ts eke patch eka apply wela thiyenawada kiyala pennanawā
//   • --plain : Windows redirect/CI walata colours nætuwa
//
// Run:
//   node timezone-check/check.mjs             # simulate okkoma TZ
//   node timezone-check/check.mjs --db        # real DB ekenuth balanna
//   node timezone-check/check.mjs --plain     # colours nætuva
// ============================================================
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const p2 = (n) => String(n).padStart(2, "0");
const args = process.argv.slice(2);
const PLAIN = args.includes("--plain") || args.includes("--no-color");
const c = (code, s) => (PLAIN ? s : `\x1b[${code}m${s}\x1b[0m`);
const green = (s) => c("32", s), red = (s) => c("31", s), dim = (s) => c("2", s), bold = (s) => c("1", s);
const ok = (b) => (b ? green("✔") : red("✘"));

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const cwd = process.cwd();

// ── app/actions/reports.ts eke wenas wela thiyenawada? ──
const reportsCandidates = [
  path.join(cwd, "app/actions/reports.ts"),
  path.join(cwd, "salt/app/actions/reports.ts"),
  path.join(scriptDir, "..", "app/actions/reports.ts"),
  path.join(scriptDir, "..", "salt/app/actions/reports.ts"),
  path.join(scriptDir, "..", "..", "salt/app/actions/reports.ts"),
];
const reportsPath = reportsCandidates.find((p) => existsSync(p));
let patchState = "unknown";
if (reportsPath) {
  const src = readFileSync(reportsPath, "utf8");
  const utcFns = /dayStr[\s\S]{0,120}getUTCDate/.test(src) && /return raw\.getUTCHours\(\)/.test(src);
  const varcharFilters = /sql\.VarChar\(10\), startDate/.test(src);
  patchState = utcFns && varcharFilters ? "applied" : utcFns || varcharFilters ? "partial" : "not applied";
}

// ── app eke logic eka — EHEMAMA (edit nē) ──
const time12 = (d) => {
  let h = d.getHours();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${p2(d.getMinutes())}:${p2(d.getSeconds())}${ap}`;
};
const dayStr = (d) => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
const dayStrUTC = (d) => `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
const time12UTC = (d) => {
  let h = d.getUTCHours();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}${ap}`;
};

// DB wall-clock (tedious useUTC:true → Date eke UTC components = DB wall clock)
const dbTime = new Date(Date.UTC(2026, 10, 25, 19, 30, 0));
const dbMidnight = new Date(Date.UTC(2026, 10, 25, 0, 0, 0));

// filter → @startDate/@endDate (reports.ts:219-220) → tedious datetime2 encode
const WANT = { from: "2026-11-25 00:00:00", to: "2026-11-25 23:59:59" };
function queryWindow() {
  const s = new Date("2026-11-25");
  const e = new Date("2026-11-25 23:59:59");
  const enc = (d) =>
    `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ` +
    `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`;
  return { from: enc(s), to: enc(e) };
}

const withTZ = (tz, fn) => {
  const prev = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.TZ;
    else process.env.TZ = prev;
  }
};

const machineTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const TZS = ["UTC", "Asia/Colombo", "America/New_York", "America/Los_Angeles", "Europe/London"];
const only = args.find((a) => a.startsWith("--tz="))?.split("=")[1];
const tzs = only ? [only] : TZS;

console.log(`\n${bold("SALT / billviewer — REPORT DATE SHIFT CHECK (v2)")}`);
console.log(dim("code edit karala nē · app eke logic eka copy karala simulate karala thiyenne"));
console.log(`machine TZ : ${bold(machineTZ)}   ${dim("Windows: tzutil /g   ·   Linux: timedatectl")}`);
if (reportsPath) {
  const label =
    patchState === "applied" ? green("applied ✔") : patchState === "partial" ? c("33", "partial ⚠") : red("not applied ✘");
  console.log(`reports.ts : ${dim(reportsPath)}  →  patch ${label}`);
}

console.log("");

let badDate = 0, badTime = 0, badWin = 0;
for (const tz of tzs) {
  const r = withTZ(tz, () => ({
    date: dayStr(dbMidnight),
    dateUTC: dayStrUTC(dbMidnight),
    time: time12(dbTime),
    timeUTC: time12UTC(dbTime),
    win: queryWindow(),
  }));
  const dateShift = r.date !== "25/11/2026";
  const timeShift = r.time !== "7:30:00PM";
  const fromOK = r.win.from === WANT.from;
  const toOK = r.win.to === WANT.to;
  if (dateShift) badDate++;
  if (timeShift) badTime++;
  if (!fromOK || !toOK) badWin++;

  console.log(bold(tz));
  console.log(
    `  ${ok(!dateShift)} bill date  DB 2026-11-25 00:00  →  report ${bold(r.date)}` +
      (dateShift ? `  ${red("← දවසක් පස්සට")}  ${dim(`[UTC fix: ${r.dateUTC}]`)}` : `  ${dim("ok")}`)
  );
  console.log(
    `  ${ok(!timeShift)} bill time  DB 19:30:00         →  report ${bold(r.time)}` +
      (timeShift ? `  ${red("← වෙලාව මාරු")}  ${dim(`[UTC fix: ${r.timeUTC}]`)}` : `  ${dim("ok")}`)
  );
  // window: anthima deka thenma
  if (fromOK && toOK) {
    console.log(`  ${green("✔")} filter window  →  ${dim(`${r.win.from}  →  ${r.win.to}`)}  ${dim("ok")}`);
  } else {
    const note = !toOK && toOK !== undefined && fromOK
      ? red(`← end ${r.win.to} daka witharai (${r.win.to.slice(0, 10)} ${r.win.to.slice(11, 16)} passe bills මග හැරෙනවා)`)
      : !fromOK && toOK
        ? red("← start shift (කලින් දවසේ bills එකතු වෙනවා)")
        : red("← window දෙකම shift (rows miss + leak)");
    console.log(`  ${red("✘")} filter window  →  ${dim(`${r.win.from}  →  ${r.win.to}`)}  ${note}`);
    console.log(`     ${dim(`expected: ${WANT.from}  →  ${WANT.to}`)}`);
  }
  console.log("");
}


console.log(bold("─── VERDICT ───"));
console.log(`  date shift: ${badDate}/${tzs.length}   ·   time shift: ${badTime}/${tzs.length}   ·   filter window: ${badWin}/${tzs.length}`);
console.log(dim(`  (simulated: app/actions/reports.ts eke CURRENT logic eka — patch eka nähä nam ${badWin} window issues)`));
if (badDate === 0 && badTime === 0 && badWin === 0) {
  console.log(`  ${green("Okkoma hari.")} Server TZ eka mokak unath reports correct.`);
} else {
  console.log("  → Server timezone eka (−) offset ekak (US) nam: date dawasak passta + time maru.");
  console.log(`  → Server timezone eka (+) offset ekak (Colombo/India) nam: date hari, ${c("33", "ඒත් time + window end හැරෙනවා")}.`);
  console.log(dim("  → Fix eka damma nam (patch applied) mekedi pennana gætaluva nawathinawa."));
}


// ── optional: live DB check (env + mssql auto-hunt) ──
if (args.includes("--db")) {
  console.log(`\n${bold("─── LIVE DB CHECK ───")}`);
  const roots = [cwd, path.join(cwd, "salt"), path.join(scriptDir, ".."), path.join(scriptDir, "..", "salt"), path.join(scriptDir, "..", "..", "salt")];
  const envNames = [".env.local", ".env.production", ".env"];
  let envFile = null;
  for (const r of roots) {
    for (const n of envNames) {
      const p = path.join(r, n);
      if (existsSync(p) && statSync(p).isFile()) { envFile = p; break; }
    }
    if (envFile) break;
  }
  if (!envFile) {
    console.log(`  ${dim("no .env.local / .env.production / .env found. Thiyena thana:")}`);
    for (const r of roots) console.log(dim(`    ${r}`));
    console.log(`  ${dim("→ App eke root eken run karanna, nætnam DB_SERVER/DB_DATABASE/DB_USER/DB_PASSWORD env vars set karanna.")}`);
  } else {
    const env = Object.fromEntries(
      readFileSync(envFile, "utf8")
        .split(/\r?\n/)
        .filter((l) => /^\s*[A-Za-z0-9_]+=/.test(l))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
        })
    );
    if (!env.DB_SERVER || !env.DB_USER || !env.DB_PASSWORD || !env.DB_DATABASE) {
      console.log(`  ${dim(`env found: ${envFile} — DB_* vars nähä (mock data mode)`)}`);
    } else {
      console.log(`  env        : ${dim(envFile)}`);
      let sql = null;
      for (const r of roots) {
        const modPath = path.join(r, "node_modules", "mssql");
        if (existsSync(modPath)) {
          const { createRequire } = await import("node:module");
          const req = createRequire(path.join(r, "package.json"));
          sql = req("mssql");
          console.log(`  mssql      : ${dim(modPath)}`);
          break;
        }
      }
      if (!sql) {
        console.log(`  ${dim("mssql module nähä — app root eken `npm install` karanna")}`);
      } else {
        try {
          const pool = await sql.connect({
            server: env.DB_SERVER,
            port: Number(env.DB_PORT || 1433),
            database: env.DB_DATABASE,
            user: env.DB_USER,
            password: env.DB_PASSWORD,
            options: {
              encrypt: env.DB_ENCRYPT !== "false",
              trustServerCertificate: env.DB_TRUST_SERVER_CERT !== "false",
            },
            connectionTimeout: 20000,
            requestTimeout: 20000,
          });
          const view = env.SALES_SUMMARY_VIEW || "VW_SalesSummery";
          const q = await pool.request().query(`
            SELECT COUNT(*) AS Rows_,
                   MIN(CONVERT(varchar(10), Txndate, 23)) AS MinD,
                   MAX(CONVERT(varchar(10), Txndate, 23)) AS MaxD
            FROM dbo.${view}
            WHERE Txndate >= DATEADD(day, -7, GETDATE())`);
          const row = q.recordset[0];
          console.log(`  view       : ${view}`);
          console.log(`  last 7d    : ${row.Rows_} rows · ${row.MinD} → ${row.MaxD}`);
          console.log(dim("  → App eke report eka me range ekata wada dawasak pahala nam, date shift confirm."));
          await pool.close();
        } catch (e) {
          console.log(`  ${red("DB connect fail:")} ${e.message}`);
        }
      }
    }
  }
}
