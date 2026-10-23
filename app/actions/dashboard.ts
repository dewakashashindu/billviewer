"use server";

// ============================================================
// LOCATION: app/actions/dashboard.ts
// Dashboard analytics powered EXCLUSIVELY by dbo.Tbl_PerformanceValues
// (+ Tbl_LocationMaster for friendly location names).
//
// Compatible with SQL Server 2008 R2 / Compatibility Level 100
// (no TRY_CAST, TRY_CONVERT, IIF, FORMAT, or INFORMATION_SCHEMA).
// ============================================================
import { getPool, isDbConfigured } from "@/lib/db";
import { requireSession, actionError } from "@/lib/actionAuth";

export interface PerfLocationOption {
  locCode: string;
  locName: string;
}

export interface PerfAmountItem {
  name: string;
  amt: number;
  rate?: string;
}

export interface PerfFamilyItem {
  name: string;
  qty: number;
  amt: number;
}

export interface PerfDaySnapshot {
  /** YYYY-MM-DD */
  dateIso: string;
  /** Short label, e.g. "03 Aug" */
  label: string;
  /** Full business date text from SortingOrder = 1, e.g. "03/Aug/2026" */
  businessDay: string;
  /** Snapshot capture time from SortingOrder = 2, e.g. "22:12:54" */
  captureTime: string;
  /** Snapshot user from SortingOrder = 3, e.g. "[9999]aura" */
  captureUser: string;
  locCode: string;
  locName: string;

  salesVolume: number;
  salesWithoutTax: number;
  taxTotal: number;
  taxes: PerfAmountItem[];
  serviceModes: PerfAmountItem[];
  pax: {
    total: number;
    local: number;
    foreign: number;
  };
  payModes: PerfAmountItem[];
  cashiers: PerfAmountItem[];
  discount: number;
  otherSerChg: number;
  addSerChg: number;
  compCount: number;
  compAmt: number;
  promotionsAmt: number;
  voidCount: number;
  voidAmt: number;
  billCount: number;
  unclosedCount: number;
  unclosedAmt: number;
  spendBill: number;
  spendPax: number;
  avgPax: number;
  avgTime: string;
  mainGroups: PerfAmountItem[];
  families: PerfFamilyItem[];
  mtdModes: PerfAmountItem[];
  mtdTotal: number;
  mtdDays: number;
  mtdAvg: number;
}

export interface DashboardPerfData {
  locations: PerfLocationOption[];
  snapshots: PerfDaySnapshot[];
  source: "database" | "mock";
}

const s = (v: unknown): string => (v == null ? "" : String(v).trim());

function parseNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const cleaned = String(v).replace(/,/g, "").trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function toDateIso(raw: unknown): string {
  if (!raw) return "";
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getUTCFullYear();
    const m = String(raw.getUTCMonth() + 1).padStart(2, "0");
    const d = String(raw.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const str = String(raw).trim();
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const mo = String(parsed.getMonth() + 1).padStart(2, "0");
    const da = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${mo}-${da}`;
  }
  return "";
}

function shortDateLabel(dateIso: string): string {
  const m = dateIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateIso;
  const monthIdx = Number(m[2]) - 1;
  return `${m[3]} ${MONTHS_SHORT[monthIdx] ?? m[2]}`;
}

function findRowKey(keys: string[], candidates: string[]): string | null {
  const lower = new Map<string, string>();
  for (const k of keys) lower.set(k.toLowerCase(), k);
  for (const cand of candidates) {
    const hit = lower.get(cand.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

function isSubLocationFlag(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0;
  const str = String(val).trim().toLowerCase();
  if (!str || str === "0" || str === "0.0" || str === "false" || str === "n" || str === "no") {
    return false;
  }
  if (str === "1" || str === "true" || str === "y" || str === "yes") {
    return true;
  }
  const num = Number(str);
  return Number.isFinite(num) ? num !== 0 : false;
}

function isHeadingFlag(val: unknown): boolean {
  if (val === true || val === 1) return true;
  const str = String(val ?? "").trim().toLowerCase();
  return str === "1" || str === "true" || str === "y";
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function mockDashboardData(): DashboardPerfData {
  return {
    source: "mock",
    locations: [{ locCode: "01", locName: "Mila Mirissa" }],
    snapshots: [
      {
        dateIso: "2026-07-25",
        label: "25 Jul",
        businessDay: "25/Jul/2026",
        captureTime: "11:48:41",
        captureUser: "[9999]aura",
        locCode: "01",
        locName: "Mila Mirissa",
        salesVolume: 11010,
        salesWithoutTax: 11010,
        taxTotal: 0,
        taxes: [{ name: "Sales Without TAX", amt: 11010 }],
        serviceModes: [{ name: "TAKEAWAY", amt: 11010 }],
        pax: { total: 1, local: 1, foreign: 0 },
        payModes: [{ name: "CASH", amt: 11010 }],
        cashiers: [{ name: "aura", amt: 11010 }],
        discount: 0,
        otherSerChg: 0,
        addSerChg: 0,
        compCount: 0,
        compAmt: 0,
        promotionsAmt: 0,
        voidCount: 0,
        voidAmt: 0,
        billCount: 1,
        unclosedCount: 2,
        unclosedAmt: 5840,
        spendBill: 11010,
        spendPax: 11010,
        avgPax: 1,
        avgTime: "—",
        mainGroups: [{ name: "FOOD", amt: 11010 }],
        families: [
          { name: "INDIAN", qty: 7, amt: 8330 },
          { name: "ROTY", qty: 2, amt: 2680 },
        ],
        mtdModes: [{ name: "TAKEAWAY", amt: 11010 }],
        mtdTotal: 11010,
        mtdDays: 25,
        mtdAvg: 440.4,
      },
      {
        dateIso: "2026-07-26",
        label: "26 Jul",
        businessDay: "26/Jul/2026",
        captureTime: "12:31:12",
        captureUser: "[9999]aura",
        locCode: "01",
        locName: "Mila Mirissa",
        salesVolume: 3520,
        salesWithoutTax: 3520,
        taxTotal: 0,
        taxes: [{ name: "Sales Without TAX", amt: 3520 }],
        serviceModes: [{ name: "TAKEAWAY", amt: 3520 }],
        pax: { total: 1, local: 1, foreign: 0 },
        payModes: [{ name: "CASH", amt: 3520 }],
        cashiers: [{ name: "aura", amt: 3520 }],
        discount: 0,
        otherSerChg: 0,
        addSerChg: 0,
        compCount: 0,
        compAmt: 0,
        promotionsAmt: 0,
        voidCount: 0,
        voidAmt: 0,
        billCount: 1,
        unclosedCount: 0,
        unclosedAmt: 0,
        spendBill: 3520,
        spendPax: 3520,
        avgPax: 1,
        avgTime: "—",
        mainGroups: [{ name: "BEVERAGE", amt: 3520 }],
        families: [{ name: "JUICE BAR", qty: 7, amt: 3520 }],
        mtdModes: [{ name: "TAKEAWAY", amt: 14530 }],
        mtdTotal: 14530,
        mtdDays: 26,
        mtdAvg: 558.85,
      },
      {
        dateIso: "2026-08-03",
        label: "03 Aug",
        businessDay: "03/Aug/2026",
        captureTime: "22:12:54",
        captureUser: "[9999]aura",
        locCode: "01",
        locName: "Mila Mirissa",
        salesVolume: 260894.19,
        salesWithoutTax: 219263,
        taxTotal: 41631.19,
        taxes: [
          { name: "Sales Without TAX", amt: 219263 },
          { name: "SSCL (15%)", rate: "15%", amt: 33218.36 },
          { name: "Service Charge (10%)", rate: "10%", amt: 6220.2 },
          { name: "TDL (1%)", rate: "1%", amt: 2192.63 },
        ],
        serviceModes: [
          { name: "TAKEAWAY", amt: 182426.37 },
          { name: "DINING", amt: 78467.82 },
        ],
        pax: { total: 16, local: 16, foreign: 0 },
        payModes: [
          { name: "CASH", amt: 127572.72 },
          { name: "MASTER CARD", amt: 72855.48 },
          { name: "VISA CARD", amt: 60465.99 },
        ],
        cashiers: [{ name: "aura", amt: 260894.19 }],
        discount: 4067,
        otherSerChg: 0,
        addSerChg: 0,
        compCount: 0,
        compAmt: 0,
        promotionsAmt: 0,
        voidCount: 0,
        voidAmt: 0,
        billCount: 12,
        unclosedCount: 0,
        unclosedAmt: 0,
        spendBill: 18271.92,
        spendPax: 13703.94,
        avgPax: 1.33,
        avgTime: "03 h38 m34 s",
        mainGroups: [
          { name: "FOOD", amt: 149630 },
          { name: "BEVERAGE", amt: 56870 },
          { name: "OTHER", amt: 16830 },
        ],
        families: [
          { name: "JUICE BAR", qty: 131, amt: 75230 },
          { name: "PENTRY", qty: 27, amt: 69020 },
          { name: "CHINESE", qty: 28, amt: 35900 },
          { name: "INDIAN", qty: 33, amt: 35720 },
          { name: "SUBMARINE", qty: 3, amt: 3770 },
          { name: "ROTY", qty: 4, amt: 2940 },
          { name: "BOTTLED WATERS", qty: 7, amt: 750 },
        ],
        mtdModes: [
          { name: "TAKEAWAY", amt: 182426.37 },
          { name: "DINING", amt: 78467.82 },
        ],
        mtdTotal: 260894.19,
        mtdDays: 3,
        mtdAvg: 86964.73,
      },
      {
        dateIso: "2026-09-05",
        label: "05 Sep",
        businessDay: "05/Sep/2026",
        captureTime: "16:43:25",
        captureUser: "[9999]aura",
        locCode: "01",
        locName: "Mila Mirissa",
        salesVolume: 85185.3,
        salesWithoutTax: 70808,
        taxTotal: 14377.3,
        taxes: [
          { name: "Sales Without TAX", amt: 70808 },
          { name: "SSCL (15%)", rate: "15%", amt: 10727.42 },
          { name: "Service Charge (10%)", rate: "10%", amt: 2941.8 },
          { name: "TDL (1%)", rate: "1%", amt: 708.08 },
        ],
        serviceModes: [
          { name: "TAKEAWAY", amt: 48074.49 },
          { name: "DINING", amt: 37110.81 },
        ],
        pax: { total: 8, local: 8, foreign: 0 },
        payModes: [
          { name: "MASTER CARD", amt: 31664.08 },
          { name: "CASH", amt: 30535.84 },
          { name: "AMEX", amt: 17456.64 },
          { name: "GIFT VOUCHER", amt: 5764.37 },
        ],
        cashiers: [{ name: "aura", amt: 85420.93 }],
        discount: 2442,
        otherSerChg: 0,
        addSerChg: 0,
        compCount: 1,
        compAmt: 7690,
        promotionsAmt: 0,
        voidCount: 0,
        voidAmt: 0,
        billCount: 6,
        unclosedCount: 0,
        unclosedAmt: 0,
        spendBill: 11801.33,
        spendPax: 8851,
        avgPax: 1.33,
        avgTime: "01 h36 m18 s",
        mainGroups: [
          { name: "FOOD", amt: 60870 },
          { name: "BEVERAGE", amt: 12380 },
        ],
        families: [
          { name: "INDIAN", qty: 20, amt: 20590 },
          { name: "CHINESE", qty: 2, amt: 2180 },
          { name: "BOTTLED WATERS", qty: 6, amt: 670 },
        ],
        mtdModes: [
          { name: "TAKEAWAY", amt: 48074.49 },
          { name: "DINING", amt: 37110.81 },
        ],
        mtdTotal: 85185.3,
        mtdDays: 5,
        mtdAvg: 17037.06,
      },
    ],
  };
}

export async function getDashboardPerformanceAction(): Promise<{
  success: boolean;
  data?: DashboardPerfData;
  error?: string;
}> {
  try {
    await requireSession();

    if (!isDbConfigured()) {
      return { success: true, data: mockDashboardData() };
    }

    const pool = await getPool();

    const [locRes, perfRes] = await Promise.all([
      pool
        .request()
        .query(`SELECT * FROM Tbl_LocationMaster WITH (NOLOCK);`)
        .catch(() =>
          pool
            .request()
            .query(`SELECT * FROM dbo.Tbl_LocationMaster WITH (NOLOCK);`)
            .catch(() => null)
        ),
      pool
        .request()
        .query(`SELECT * FROM Tbl_PerformanceValues WITH (NOLOCK);`)
        .catch(() =>
          pool
            .request()
            .query(`SELECT * FROM dbo.Tbl_PerformanceValues WITH (NOLOCK);`)
        ),
    ]);

    /* 1) Map main locations from Tbl_LocationMaster */
    const locNameByCode = new Map<string, string>();
    const mainLocList: PerfLocationOption[] = [];
    const locRows = (locRes?.recordset ?? []) as Record<string, unknown>[];
    if (locRows.length > 0) {
      const lKeys = Object.keys(locRows[0]);
      const lcKey = findRowKey(lKeys, ["LocCode", "Code", "Loc"]);
      const ldKey = findRowKey(lKeys, ["LocDes", "LocName", "Description", "Name"]);
      const subKey = findRowKey(lKeys, ["SubLoc", "IsSubLoc", "SubLocation", "Sub_Loc"]);

      if (lcKey) {
        const seenMain = new Set<string>();
        for (const r of locRows) {
          const code = s(r[lcKey]);
          if (!code) continue;
          const name = (ldKey ? s(r[ldKey]) : "") || code;
          const up = code.toUpperCase();
          locNameByCode.set(up, name);
          const isSub = subKey ? isSubLocationFlag(r[subKey]) : false;
          if (!isSub && !seenMain.has(up)) {
            seenMain.add(up);
            mainLocList.push({ locCode: code, locName: name });
          }
        }
      }
    }

    /* 2) Parse Tbl_PerformanceValues rows into daily snapshots per (LocID, TxnDate) */
    const rawRows = (perfRes?.recordset ?? []) as Record<string, unknown>[];
    if (rawRows.length === 0) {
      mainLocList.sort((a, b) => a.locCode.localeCompare(b.locCode));
      return {
        success: true,
        data: {
          locations: mainLocList,
          snapshots: [],
          source: "database",
        },
      };
    }

    const pKeys = Object.keys(rawRows[0]);
    const kDate = findRowKey(pKeys, ["TxnDate", "TrnDate", "Date"]) ?? "TxnDate";
    const kPerDes = findRowKey(pKeys, ["PerDes", "Description"]) ?? "PerDes";
    const kValDes = findRowKey(pKeys, ["Valdes", "ValDes", "ValueDes"]) ?? "Valdes";
    const kAmt = findRowKey(pKeys, ["PerfAmount", "Amount", "Val"]) ?? "PerfAmount";
    const kUser = findRowKey(pKeys, ["UserID", "UserId", "User"]);
    const kLoc = findRowKey(pKeys, ["LocID", "LocCode", "Loc"]) ?? "LocID";
    const kSort = findRowKey(pKeys, ["SortingOrder", "SortOrder", "OrderNo"]) ?? "SortingOrder";
    const kHead = findRowKey(pKeys, ["Heading", "IsHeading"]) ?? "Heading";

    interface RawBucket {
      dateIso: string;
      locCode: string;
      chosenUser: string | null;
      rows: Array<{
        perDes: string;
        valDes: string;
        perfAmt: string;
        sort: number;
        heading: boolean;
        user: string;
      }>;
    }

    const buckets = new Map<string, RawBucket>();
    const seenLocsInPerf = new Set<string>();

    for (const r of rawRows) {
      const dateIso = toDateIso(r[kDate]);
      if (!dateIso) continue;
      const locCode = s(r[kLoc]) || "01";
      seenLocsInPerf.add(locCode.toUpperCase());
      const key = `${locCode.toUpperCase()}|${dateIso}`;
      const user = kUser ? s(r[kUser]) : "";

      let b = buckets.get(key);
      if (!b) {
        b = { dateIso, locCode, chosenUser: user || null, rows: [] };
        buckets.set(key, b);
      }
      b.rows.push({
        perDes: s(r[kPerDes]),
        valDes: s(r[kValDes]),
        perfAmt: s(r[kAmt]),
        sort: parseNum(r[kSort]),
        heading: isHeadingFlag(r[kHead]),
        user,
      });
    }

    /* Ensure any location present in Tbl_PerformanceValues is selectable */
    const locOptionMap = new Map<string, PerfLocationOption>();
    for (const m of mainLocList) {
      locOptionMap.set(m.locCode.toUpperCase(), m);
    }
    for (const upCode of seenLocsInPerf) {
      if (!locOptionMap.has(upCode)) {
        locOptionMap.set(upCode, {
          locCode: upCode,
          locName: locNameByCode.get(upCode) || upCode,
        });
      }
    }
    const locations = [...locOptionMap.values()].sort((a, b) =>
      a.locCode.localeCompare(b.locCode)
    );

    const addNamedAmt = (
      arr: PerfAmountItem[],
      name: string,
      amt: number,
      rate?: string
    ) => {
      const cleanName = name.trim();
      if (!cleanName) return;
      const existing = arr.find((x) => x.name.toUpperCase() === cleanName.toUpperCase());
      if (existing) {
        existing.amt = round2(existing.amt + amt);
        if (rate && !existing.rate) existing.rate = rate;
      } else {
        arr.push({ name: cleanName, amt: round2(amt), ...(rate ? { rate } : {}) });
      }
    };

    const snapshots: PerfDaySnapshot[] = [];

    for (const b of buckets.values()) {
      // If multiple users captured on the same (LocID, TxnDate), keep the last user's rows
      let activeRows = b.rows;
      if (b.rows.length > 0) {
        const lastUser = b.rows[b.rows.length - 1].user;
        if (lastUser) {
          const filtered = b.rows.filter((x) => !x.user || x.user === lastUser);
          if (filtered.length > 0) activeRows = filtered;
        }
      }

      activeRows.sort((a, c) => a.sort - c.sort);

      const locUpper = b.locCode.toUpperCase();
      const locName = locNameByCode.get(locUpper) || b.locCode;

      const snap: PerfDaySnapshot = {
        dateIso: b.dateIso,
        label: shortDateLabel(b.dateIso),
        businessDay: "",
        captureTime: "",
        captureUser: "",
        locCode: b.locCode,
        locName,
        salesVolume: 0,
        salesWithoutTax: 0,
        taxTotal: 0,
        taxes: [],
        serviceModes: [],
        pax: { total: 0, local: 0, foreign: 0 },
        payModes: [],
        cashiers: [],
        discount: 0,
        otherSerChg: 0,
        addSerChg: 0,
        compCount: 0,
        compAmt: 0,
        promotionsAmt: 0,
        voidCount: 0,
        voidAmt: 0,
        billCount: 0,
        unclosedCount: 0,
        unclosedAmt: 0,
        spendBill: 0,
        spendPax: 0,
        avgPax: 0,
        avgTime: "—",
        mainGroups: [],
        families: [],
        mtdModes: [],
        mtdTotal: 0,
        mtdDays: 0,
        mtdAvg: 0,
      };

      const taxItemsOnly: PerfAmountItem[] = [];
      let hasSalesWithoutTaxRow = false;

      for (const row of activeRows) {
        if (row.heading) continue;
        const so = row.sort;
        const pd = row.perDes;
        const pdUpper = pd.toUpperCase();
        const vd = row.valDes;
        const pa = row.perfAmt;
        const amtNum = parseNum(pa);
        const valNum = parseNum(vd);

        if (so === 1 || pdUpper === "BUSSINESS DAY" || pdUpper === "BUSINESS DAY") {
          snap.businessDay = vd || pa || snap.businessDay;
        } else if (so === 2 || pdUpper === "CURRENT TIME") {
          snap.captureTime = vd || pa || snap.captureTime;
        } else if (so === 3 || pdUpper === "USER") {
          snap.captureUser = vd || snap.captureUser;
        } else if (so === 6) {
          snap.salesVolume = amtNum;
        } else if (so >= 8 && so <= 11) {
          if (pd) {
            const label = vd ? `${pd} (${vd})` : pd;
            addNamedAmt(taxItemsOnly, label, amtNum, vd || undefined);
          }
        } else if (so === 12 || pdUpper === "TAX TOTAL") {
          snap.taxTotal = amtNum;
        } else if (so === 13 || pdUpper === "SALES WITHOUT TAX") {
          snap.salesWithoutTax = amtNum;
          hasSalesWithoutTaxRow = true;
        } else if (so === 15) {
          addNamedAmt(snap.serviceModes, pd, amtNum);
        } else if (so === 17 || pdUpper === "TOTAL PAX COUNT") {
          snap.pax.total = amtNum || valNum;
        } else if (so === 18 || pdUpper === "LOCAL PAX COUNT") {
          snap.pax.local = amtNum || valNum;
        } else if (so === 19 || pdUpper.includes("FORIEGN PAX") || pdUpper.includes("FOREIGN PAX")) {
          snap.pax.foreign = amtNum || valNum;
        } else if (so === 21) {
          addNamedAmt(snap.payModes, pd, amtNum);
        } else if (so === 23) {
          addNamedAmt(snap.cashiers, pd, amtNum);
        } else if (so === 25 || pdUpper.includes("COMPLEMENT")) {
          snap.compCount += valNum || (amtNum > 0 ? 1 : 0);
          snap.compAmt = round2(snap.compAmt + amtNum);
        } else if (so === 26 || pdUpper === "TOTAL DISCOUNT") {
          snap.discount = amtNum;
        } else if (so === 27 || pdUpper === "OTHER SERVICE CHARGE") {
          snap.otherSerChg = amtNum;
        } else if (so === 28 || pdUpper.includes("ADDITIONAL SERVICE")) {
          snap.addSerChg = amtNum;
        } else if (so >= 30 && so < 37) {
          snap.promotionsAmt = round2(snap.promotionsAmt + amtNum);
        } else if (so === 38 || pdUpper.includes("VOID BILL")) {
          snap.voidCount = valNum;
          snap.voidAmt = amtNum;
        } else if (so === 39 || pdUpper === "BILL COUNT") {
          snap.billCount = valNum;
          if (!snap.salesVolume && amtNum > 0) snap.salesVolume = amtNum;
        } else if (so === 40 || pdUpper === "UNCLOSED BILLS") {
          snap.unclosedCount = valNum;
          snap.unclosedAmt = amtNum;
        } else if (so === 42 || pdUpper === "SPENDING PER BILL") {
          snap.spendBill = amtNum;
        } else if (so === 43 || pdUpper === "SPENDING PER PAX") {
          snap.spendPax = amtNum;
        } else if (so === 44 || pdUpper === "AVG PAX PER BILL") {
          snap.avgPax = amtNum;
        } else if (so === 45 || pdUpper === "AVG TIME PER BILL") {
          const timeText = pa || vd;
          if (timeText) snap.avgTime = timeText;
        } else if (so === 48) {
          addNamedAmt(snap.mainGroups, pd, amtNum);
        } else if (so === 52) {
          if (pd) {
            const m = pd.match(/^\[(\d+(?:\.\d+)?)\]\s*(.*)$/);
            const qty = m ? Number(m[1]) || 0 : valNum;
            const famName = (m ? m[2] : pd).trim() || pd;
            const hit = snap.families.find(
              (f) => f.name.toUpperCase() === famName.toUpperCase()
            );
            if (hit) {
              hit.qty = round2(hit.qty + qty);
              hit.amt = round2(hit.amt + amtNum);
            } else {
              snap.families.push({ name: famName, qty, amt: round2(amtNum) });
            }
          }
        } else if (so === 55) {
          const modeLabel = pd.replace(/^Month\s*To\s*Date\s*/i, "").trim() || pd;
          addNamedAmt(snap.mtdModes, modeLabel, amtNum);
        } else if (so === 56 || pdUpper === "MONTH TO DATE TOTAL") {
          snap.mtdTotal = amtNum;
        } else if (so === 57 || pdUpper === "MONTH TO DATE AVERAGE") {
          snap.mtdDays = valNum;
          snap.mtdAvg = amtNum;
        }
      }

      const computedTaxSum = round2(
        taxItemsOnly.reduce((acc, t) => acc + t.amt, 0)
      );
      if (!snap.taxTotal && computedTaxSum > 0) {
        snap.taxTotal = computedTaxSum;
      }
      if (!hasSalesWithoutTaxRow) {
        snap.salesWithoutTax = Math.max(0, round2(snap.salesVolume - snap.taxTotal));
      }

      snap.taxes = [
        ...(snap.salesWithoutTax > 0
          ? [{ name: "Sales Without TAX", amt: snap.salesWithoutTax }]
          : []),
        ...taxItemsOnly.filter((t) => t.amt > 0),
      ];

      snap.serviceModes.sort((a, c) => c.amt - a.amt);
      snap.payModes.sort((a, c) => c.amt - a.amt);
      snap.cashiers.sort((a, c) => c.amt - a.amt);
      snap.mainGroups.sort((a, c) => c.amt - a.amt);
      snap.families.sort((a, c) => c.amt - a.amt);

      snapshots.push(snap);
    }

    snapshots.sort((a, b) =>
      a.dateIso === b.dateIso
        ? a.locCode.localeCompare(b.locCode)
        : a.dateIso.localeCompare(b.dateIso)
    );

    return {
      success: true,
      data: {
        locations,
        snapshots,
        source: "database",
      },
    };
  } catch (error) {
    console.error("Dashboard Tbl_PerformanceValues Action Error:", error);
    return actionError(error) as { success: boolean; error?: string };
  }
}
