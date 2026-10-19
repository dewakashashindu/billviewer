"use server";

// ============================================================
// Table QR — Tbl_TableGroup + Tbl_Tables (mssql pool, lib/db.ts)
//
//   Tbl_TableGroup: GroupID, GroupName (PK), Enable, ...
//   Tbl_Tables:     TableNo + TableGroup (PK), Enable,
//                   Vaccant ('Y' = vacant), ListingOrder
//
// ⚠️ In this POS, Tbl_Tables.TableGroup holds the GROUP ID
//    (e.g. "P/M 1"), not the group name. Older installs store the
//    group NAME instead, so the join below accepts either.
//
// Tables whose TableGroup is empty (or points at a disabled /
// deleted group) are still returned, flagged with an empty
// groupId — the QR screen lets staff give them a custom card
// name / group name.
//
// If the DB_* env vars are not set, MOCK data is returned (the
// same dev-fallback pattern as the bill viewer) so the UI can
// be tested without a database.
// ============================================================
import { getPool, isDbConfigured } from "@/lib/db";
import { requireSession, actionError } from "@/lib/actionAuth";

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
  groups: TableGroupRow[];
  tables: TableRowData[];
  source: "database" | "mock";
}

const s = (v: unknown): string => (v == null ? "" : String(v).trim());

function mockData(): TablesData {
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
  return { groups, tables, source: "mock" };
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

    /* Groups + how many enabled tables point at them. The match
       accepts either the GroupID or the GroupName, because
       Tbl_Tables.TableGroup holds the id on this install. */
    const gRes = await pool.request().query(`
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
    `);

    const tRes = await pool.request().query(`
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
    `);

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

    return { success: true, data: { groups, tables, source: "database" } };
  } catch (error) {
    console.error("Tables Action Error:", error);
    return actionError(error) as { success: boolean; error?: string };
  }
}
