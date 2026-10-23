"use server";

// ============================================================
// Table QR — Tbl_LocationMaster + Tbl_TableGroup + Tbl_Tables
//
//   Tbl_LocationMaster: LocCode, LocDes, SubLoc (0/false = main loc)
//   Tbl_TableGroup:     GroupID, GroupName (PK), Enable, ...
//   Tbl_Tables:         TableNo + TableGroup (PK), Enable,
//                       Vaccant ('Y' = vacant), ListingOrder
// ============================================================
import { getPool, isDbConfigured } from "@/lib/db";
import { requireSession, actionError } from "@/lib/actionAuth";

export interface TableLocationRow {
  locCode: string;
  locName: string;
}

export interface TableGroupRow {
  groupId: string;
  groupName: string;
  tableCount: number;
}

export interface TableRowData {
  tableNo: string;
  /** Raw Tbl_Tables.TableGroup value (group id in this POS). */
  tableGroup: string;
  /** Resolved Tbl_TableGroup.GroupID — "" when the table has no group. */
  groupId: string;
  /** Resolved Tbl_TableGroup.GroupName — "" when the table has no group. */
  groupName: string;
  vacant: boolean;
  listingOrder: number;
  /** false = added by hand on the QR screen (not in Tbl_Tables). */
  inDb: boolean;
  /** true = the single Takeaway (TA) card — not a POS table. */
  takeaway?: boolean;
}

export interface TablesData {
  locations: TableLocationRow[];
  groups: TableGroupRow[];
  tables: TableRowData[];
  source: "database" | "mock";
}

const s = (v: unknown): string => (v == null ? "" : String(v).trim());

function mockData(): TablesData {
  const locations: TableLocationRow[] = [
    { locCode: "001", locName: "Mila Mirissa" },
    { locCode: "002", locName: "Beach Lounge" },
  ];
  const defs: { id: string; name: string; prefix: string; count: number }[] = [
    { id: "001", name: "A. Ground Floor", prefix: "T-", count: 12 },
    { id: "002", name: "B. First Floor", prefix: "F-", count: 6 },
    { id: "P/M 1", name: "P. Pick Me Food", prefix: "PICK ", count: 8 },
    { id: "UB 001", name: "E. Uber Eats", prefix: "UB-", count: 3 },
  ];
  const groups: TableGroupRow[] = defs.map((d) => ({
    groupId: d.id,
    groupName: d.name,
    tableCount: d.count,
  }));
  const tables: TableRowData[] = defs.flatMap((d) =>
    Array.from({ length: d.count }, (_, i) => ({
      tableNo: `${d.prefix}${String(i + 1).padStart(2, "0")}`,
      tableGroup: d.id,
      groupId: d.id,
      groupName: d.name,
      vacant: (i + d.name.length) % 3 !== 0,
      listingOrder: i + 1,
      inDb: true,
    }))
  );
  /* one table with no group — exercises the custom-name flow */
  tables.push({
    tableNo: "TEMP-1",
    tableGroup: "",
    groupId: "",
    groupName: "",
    vacant: true,
    listingOrder: 9999,
    inDb: true,
  });
  return { locations, groups, tables, source: "mock" };
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

function findRowKey(keys: string[], candidates: string[]): string | null {
  const lower = new Map<string, string>();
  for (const k of keys) lower.set(k.toLowerCase(), k);
  for (const cand of candidates) {
    const hit = lower.get(cand.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

export async function getTablesDataAction(): Promise<{
  success: boolean;
  data?: TablesData;
  error?: string;
}> {
  try {
    await requireSession();

    if (!isDbConfigured()) {
      console.warn("DB_* env vars not configured - serving MOCK tables (dev fallback)");
      return { success: true, data: mockData() };
    }

    const pool = await getPool();

    /* Run Tbl_LocationMaster, Tbl_TableGroup, and Tbl_Tables in parallel
       to cut remote DB round-trip latency (~3x faster on SQL5075).
       Location lookup uses direct SELECT * (no TRY_CAST / INFORMATION_SCHEMA)
       so it works on SQL Server 2008 R2 / Compat Level 100+. */
    const [locRes, gRes, tRes] = await Promise.all([
      pool
        .request()
        .query(`SELECT * FROM Tbl_LocationMaster WITH (NOLOCK);`)
        .catch(() =>
          pool
            .request()
            .query(`SELECT * FROM dbo.Tbl_LocationMaster WITH (NOLOCK);`)
            .catch((locErr) => {
              console.error("Location master load error on Table QR:", locErr);
              return null;
            })
        ),
      pool.request().query(`
        SELECT
          LTRIM(RTRIM(g.GroupID))   AS GroupID,
          LTRIM(RTRIM(g.GroupName)) AS GroupName,
          (SELECT COUNT(*) FROM Tbl_Tables t WITH (NOLOCK)
            WHERE t.Enable = 1
              AND (
                LTRIM(RTRIM(t.TableGroup)) = LTRIM(RTRIM(g.GroupID))
                OR LTRIM(RTRIM(t.TableGroup)) = LTRIM(RTRIM(g.GroupName))
              )) AS TableCount
        FROM Tbl_TableGroup g WITH (NOLOCK)
        WHERE g.Enable = 1
        ORDER BY LTRIM(RTRIM(g.GroupName));
      `),
      pool.request().query(`
        SELECT
          LTRIM(RTRIM(t.TableNo))                  AS TableNo,
          LTRIM(RTRIM(ISNULL(t.TableGroup, '')))   AS TableGroup,
          LTRIM(RTRIM(ISNULL(t.Vaccant, 'Y')))     AS Vaccant,
          ISNULL(t.ListingOrder, 0)                AS ListingOrder,
          LTRIM(RTRIM(ISNULL(g.GroupID, '')))      AS GroupID,
          LTRIM(RTRIM(ISNULL(g.GroupName, '')))    AS GroupName
        FROM Tbl_Tables t WITH (NOLOCK)
        LEFT JOIN Tbl_TableGroup g WITH (NOLOCK)
          ON LTRIM(RTRIM(g.GroupID))   = LTRIM(RTRIM(t.TableGroup))
          OR LTRIM(RTRIM(g.GroupName)) = LTRIM(RTRIM(t.TableGroup))
        WHERE t.Enable = 1
        ORDER BY
          CASE WHEN ISNULL(g.GroupName, '') = '' THEN 1 ELSE 0 END,
          LTRIM(RTRIM(g.GroupName)),
          t.ListingOrder,
          LTRIM(RTRIM(t.TableNo));
      `),
    ]);

    let locations: TableLocationRow[] = [];
    const locRows = (locRes?.recordset ?? []) as Record<string, unknown>[];
    if (locRows.length > 0) {
      const keys = Object.keys(locRows[0]);
      const lcKey = findRowKey(keys, ["LocCode", "Code", "Loc"]);
      const ldKey = findRowKey(keys, ["LocDes", "LocName", "Description", "Name"]);
      const subKey = findRowKey(keys, [
        "SubLoc",
        "IsSubLoc",
        "SubLocation",
        "Sub_Loc",
      ]);

      if (lcKey) {
        const allLocs: TableLocationRow[] = [];
        const mainLocs: TableLocationRow[] = [];
        const seenAll = new Set<string>();
        const seenMain = new Set<string>();

        for (const r of locRows) {
          const locCode = s(r[lcKey]);
          if (!locCode) continue;
          const locName = (ldKey ? s(r[ldKey]) : "") || locCode;
          const upper = locCode.toUpperCase();

          if (!seenAll.has(upper)) {
            seenAll.add(upper);
            allLocs.push({ locCode, locName });
          }
          const sub = subKey ? isSubLocationFlag(r[subKey]) : false;
          if (!sub && !seenMain.has(upper)) {
            seenMain.add(upper);
            mainLocs.push({ locCode, locName });
          }
        }

        mainLocs.sort((a, b) => a.locCode.localeCompare(b.locCode));
        allLocs.sort((a, b) => a.locCode.localeCompare(b.locCode));
        locations = mainLocs.length > 0 ? mainLocs : allLocs;
      }
    }

    const groups: TableGroupRow[] = gRes.recordset.map((r) => ({
      groupId: s(r.GroupID),
      groupName: s(r.GroupName),
      tableCount: Number(r.TableCount ?? 0),
    }));

    const tables: TableRowData[] = tRes.recordset.map((r) => {
      const tableGroup = s(r.TableGroup);
      const groupId = s(r.GroupID);
      const groupName = s(r.GroupName);
      return {
        tableNo: s(r.TableNo),
        tableGroup,
        groupId,
        groupName,
        vacant: s(r.Vaccant).toUpperCase() === "Y" || s(r.Vaccant) === "1",
        listingOrder: Number(r.ListingOrder ?? 0),
        inDb: true,
      };
    });

    return { success: true, data: { locations, groups, tables, source: "database" } };
  } catch (error) {
    console.error("Tables Action Error:", error);
    return actionError(error) as { success: boolean; error?: string };
  }
}
