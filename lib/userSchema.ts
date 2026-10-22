// ============================================================
// LOCATION: lib/userSchema.ts
// Ensures dbo.Tbl_UserDetails has the [LoginName] column
// (leaving [Password] completely unchanged), and migrates any
// existing web login accounts whose LoginName was still empty.
// ============================================================
import type sql from "mssql";

let schemaReady = false;

export async function ensureLoginNameColumn(
  pool: sql.ConnectionPool
): Promise<void> {
  if (schemaReady) return;
  try {
    // Batch 1: Add LoginName column if missing
    await pool.request().query(`
      IF COL_LENGTH('dbo.Tbl_UserDetails', 'LoginName') IS NULL
      BEGIN
        ALTER TABLE dbo.Tbl_UserDetails ADD LoginName VARCHAR(50) NULL;
      END
    `);

    // Batch 2: Backfill LoginName ONLY for web accounts that have scrypt Password set
    await pool.request().query(`
      UPDATE dbo.Tbl_UserDetails
      SET LoginName = LEFT(LTRIM(RTRIM(LogName)), 50)
      WHERE (LoginName IS NULL OR LTRIM(RTRIM(LoginName)) = '')
        AND [Password] LIKE 'scrypt$%$%'
        AND LogName IS NOT NULL
        AND LTRIM(RTRIM(LogName)) <> '';
    `);

    schemaReady = true;
  } catch (err) {
    console.warn("ensureLoginNameColumn warning:", err);
    schemaReady = true;
  }
}
