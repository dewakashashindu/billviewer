// ============================================================
// MSSQL connection pool (SmarterASP.NET) — SERVER ONLY
// ============================================================
import sql from "mssql";

let poolPromise: Promise<sql.ConnectionPool> | null = null;

export function isDbConfigured(): boolean {
  return Boolean(
    process.env.DB_SERVER &&
      process.env.DB_DATABASE &&
      process.env.DB_USER &&
      process.env.DB_PASSWORD
  );
}

function buildConfig(): sql.config {
  return {
    user: process.env.DB_USER as string,
    password: process.env.DB_PASSWORD as string,
    server: process.env.DB_SERVER as string,
    database: process.env.DB_DATABASE as string,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 1433,
    options: {
      // SmarterASP MSSQL works with encrypted connections.
      // Set DB_ENCRYPT=false only if the server rejects TLS.
      encrypt: process.env.DB_ENCRYPT !== "false",
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== "false",
      enableArithAbort: true,
    },
    connectionTimeout: 30000,
    requestTimeout: 30000,
    pool: {
      max: 5, // shared hosting — keep it low
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

/** Singleton pool — reuse across requests */
export function getPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    const pool = new sql.ConnectionPool(buildConfig());
    poolPromise = pool.connect();
  }
  return poolPromise;
}
