"use server";

// ============================================================
// Table QR — Tbl_TableGroup + Tbl_Tables (mssql pool, lib/db.ts)
//
//   Tbl_TableGroup: GroupID, GroupName (PK), Enable, ...
//   Tbl_Tables:     TableNo + TableGroup (PK — TableGroup eka
//                   GroupName ekata match wenawa), Enable,
//                   Vaccant ('Y' = vacant), ListingOrder
//
// If the DB_* env vars are not set, MOCK data is returned (the
// same dev-fallback pattern as the bill viewer) so the UI can
// be tested without a database.
// ============================================================
import sql from "mssql";
import { getPool, isDbConfigured } from "@/lib/db";
import { requireSession, actionError } from "@/lib/actionAuth";

export interface TableGroupRow {
  groupId: string;
  groupName: string;
  tableCount: number;
}

export interface TableRowData {
  tableNo: string;
  tableGroup: string;
  vacant: boolean;
  listingOrder: number;
}

export interface TablesData {
  groups: TableGroupRow[];
  tables: TableRowData[];
  source: "database" | "mock";
}

const s = (v: unknown): string => (v == null ? "" : String(v).trim());

function mockData(): TablesData {
  const defs: { name: string; prefix: string; count: number }[] = [
    { name: "Main Dining Area", prefix: "T-", count: 12 },
    { name: "VIP Room", prefix: "VIP-", count: 4 },
    { name: "Rooftop", prefix: "R-", count: 8 },
    { name: "Outdoor", prefix: "O-", count: 6 },
  ];
  const groups: TableGroupRow[] = defs.map((d, i) => ({
    groupId: `G${i + 1}`,
    groupName: d.name,
    tableCount: d.count,
  }));
  const tables: TableRowData[] = defs.flatMap((d) =>
    Array.from({ length: d.count }, (_, i) => ({
      tableNo: `${d.prefix}${String(i + 1).padStart(2, "0")}`,
      tableGroup: d.name,
      vacant: (i + d.name.length) % 3 !== 0,
      listingOrder: i + 1,
    }))
  );
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

    const gRes = await pool.request().query(`
      SELECT
        LTRIM(RTRIM(g.GroupID))   AS GroupID,
        LTRIM(RTRIM(g.GroupName)) AS GroupName,
        (SELECT COUNT(*) FROM Tbl_Tables t WITH (NOLOCK)
          WHERE LTRIM(RTRIM(t.TableGroup)) = LTRIM(RTRIM(g.GroupName))
            AND t.Enable = 1) AS TableCount
      FROM Tbl_TableGroup g WITH (NOLOCK)
      WHERE g.Enable = 1
      ORDER BY LTRIM(RTRIM(g.GroupName));
    `);

    const tRes = await pool.request().query(`
      SELECT
        LTRIM(RTRIM(TableNo))    AS TableNo,
        LTRIM(RTRIM(TableGroup)) AS TableGroup,
        LTRIM(RTRIM(Vaccant))    AS Vaccant,
        ISNULL(ListingOrder, 0)  AS ListingOrder
      FROM Tbl_Tables WITH (NOLOCK)
      WHERE Enable = 1
      ORDER BY LTRIM(RTRIM(TableGroup)), ListingOrder, LTRIM(RTRIM(TableNo));
    `);

    const groups: TableGroupRow[] = gRes.recordset.map((r) => ({
      groupId: s(r.GroupID),
      groupName: s(r.GroupName),
      tableCount: Number(r.TableCount ?? 0),
    }));
    const tables: TableRowData[] = tRes.recordset.map((r) => ({
      tableNo: s(r.TableNo),
      tableGroup: s(r.TableGroup),
      vacant: s(r.Vaccant).toUpperCase() === "Y" || s(r.Vaccant) === "1",
      listingOrder: Number(r.ListingOrder ?? 0),
    }));

    return { success: true, data: { groups, tables, source: "database" } };
  } catch (error) {
    console.error("Tables Action Error:", error);
    return actionError(error) as { success: boolean; error?: string };
  }
}
