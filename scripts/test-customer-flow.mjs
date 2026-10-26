// ============================================================
// scripts/test-customer-flow.mjs  (dev only)
//
// Runs lib/customerService.resolveOrCreateCustomer against an
// in-memory fake of SQL Server so the SQL text, the Tbl_TxnNumbers
// counter and the CusCode padding can be checked WITHOUT a real DB.
//
// Usage:  npx tsx scripts/test-customer-flow.mjs
// ============================================================
import { resolveOrCreateCustomer, findCustomerByPhone, normalisePhone } from "../lib/customerService.ts";

/* ───────────────────────── fake SQL Server ───────────────── */
const MASTER_DEFAULT = [
  { c: "CusID", dt: "int", nul: "NO", def: null, isId: 1, maxLen: null },
  { c: "CusCode", dt: "char", nul: "NO", def: null, isId: 0, maxLen: 10 },
  { c: "CusName", dt: "varchar", nul: "YES", def: null, isId: 0, maxLen: 50 },
  { c: "RegTel", dt: "varchar", nul: "YES", def: null, isId: 0, maxLen: 20 },
  { c: "LocCode", dt: "char", nul: "YES", def: null, isId: 0, maxLen: 2 },
  { c: "Enable", dt: "bit", nul: "YES", def: "((1))", isId: 0, maxLen: null },
  // a NOT NULL column with no default — must be filled by the service
  { c: "CusType", dt: "varchar", nul: "NO", def: null, isId: 0, maxLen: 2 },
  { c: "RegDate", dt: "datetime", nul: "YES", def: null, isId: 0, maxLen: null },
];

const TXN_DEFAULT = [
  { c: "LocCode", dt: "char", nul: "NO", def: null, isId: 0, maxLen: 2 },
  { c: "TxnType", dt: "char", nul: "NO", def: null, isId: 0, maxLen: 2 },
  { c: "Prefix", dt: "char", nul: "YES", def: null, isId: 0, maxLen: 2 },
  { c: "TxnNo", dt: "float", nul: "YES", def: null, isId: 0, maxLen: null },
  { c: "TxnDescription", dt: "varchar", nul: "YES", def: null, isId: 0, maxLen: 50 },
  { c: "Enable", dt: "bit", nul: "YES", def: null, isId: 0, maxLen: null },
];

const right9 = (v) => String(v ?? "").replace(/[^0-9]/g, "").slice(-9);

class FakeStore {
  constructor({ masterCols = MASTER_DEFAULT, customers = [], counters = [] } = {}) {
    this.masterCols = masterCols;
    this.customers = customers.map((c) => ({ CusType: "", ...c }));
    this.counters = counters.map((c) => ({ ...c }));
    this.log = [];
  }

  /* ---- helpers ---- */
  schemaFor(table) {
    if (table === "Tbl_CustomerMaster") return this.masterCols;
    if (table === "Tbl_TxnNumbers") return TXN_DEFAULT;
    return [];
  }

  insertInto(table, cols, values, params) {
    const row = {};
    cols.forEach((col, i) => {
      const expr = values[i].trim();
      row[col] = expr.startsWith("@") ? params[expr.slice(1)] : expr.replace(/'/g, "");
    });
    if (table === "Tbl_CustomerMaster") this.customers.push(row);
    else this.counters.push(row);
    return row;
  }

  handle(sqlText, params) {
    const sql = sqlText.replace(/\s+/g, " ").trim();
    this.log.push(sql);

    /* INFORMATION_SCHEMA.COLUMNS */
    if (sql.includes("INFORMATION_SCHEMA.COLUMNS")) {
      return this.schemaFor(params.t);
    }

    /* customer phone lookup / existence check */
    if (/^SELECT TOP 1 .*FROM dbo\.Tbl_CustomerMaster/i.test(sql)) {
      if (sql.includes("@code")) {
        const hit = this.customers.filter(
          (c) => String(c.CusCode).trim() === String(params.code).trim()
        );
        return hit.length ? [{ Hit: 1 }] : [];
      }
      const phone = right9(params.phone);
      const found = this.customers.filter(
        (c) =>
          right9(c.RegTel ?? c.CusTel ?? "") === phone &&
          (c.Enable === undefined || c.Enable)
      );
      return found.map((c) => ({ CusCode: c.CusCode, CusName: c.CusName }));
    }

    /* Tbl_TxnNumbers — read counter */
    if (/^SELECT TOP 1 .*FROM dbo\.Tbl_TxnNumbers/i.test(sql)) {
      const row = this.counters.find(
        (c) => String(c.LocCode).trim() === String(params.loc).trim() && c.TxnType === "CC"
      );
      return row ? [{ Prefix: row.Prefix, TxnNo: row.TxnNo }] : [];
    }

    /* Tbl_TxnNumbers — INSERT counter row */
    if (/^INSERT INTO dbo\.Tbl_TxnNumbers/i.test(sql)) {
      const cols = sql.slice(sql.indexOf("(") + 1, sql.indexOf(")")).split(",").map((x) => x.trim().replace(/[[\]]/g, ""));
      const vals = sql.slice(sql.indexOf("VALUES (") + 8, sql.lastIndexOf(")")).split(",").map((x) => x.trim());
      this.insertInto("Tbl_TxnNumbers", cols, vals, params);
      return [];
    }

    /* Tbl_TxnNumbers — UPDATE counter */
    if (/^UPDATE dbo\.Tbl_TxnNumbers/i.test(sql)) {
      const row = this.counters.find(
        (c) => String(c.LocCode).trim() === String(params.locUpd).trim() && c.TxnType === "CC"
      );
      if (!row) throw new Error("counter row not found for update");
      row.TxnNo = params.seq;
      return [];
    }

    /* Tbl_CustomerMaster — INSERT */
    if (/^INSERT INTO dbo\.Tbl_CustomerMaster/i.test(sql)) {
      const cols = sql.slice(sql.indexOf("(") + 1, sql.indexOf(")")).split(",").map((x) => x.trim().replace(/[[\]]/g, ""));
      const vals = sql.slice(sql.indexOf("VALUES (") + 8, sql.lastIndexOf(")")).split(",").map((x) => x.trim());
      this.insertInto("Tbl_CustomerMaster", cols, vals, params);
      return [];
    }

    throw new Error(`FakeStore: unexpected SQL → ${sql}`);
  }
}

class FakeRequest {
  constructor(store) {
    this.store = store;
    this.params = {};
  }
  input(name, _type, value) {
    this.params[name] = value;
    return this;
  }
  async query(text) {
    return { recordset: this.store.handle(text, this.params) };
  }
}
class FakeDb {
  constructor(store) {
    this.store = store;
  }
  request() {
    return new FakeRequest(this.store);
  }
}

/* ───────────────────────── test harness ──────────────────── */
let failed = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed += 1;
  console.log(
    `${ok ? "✔" : "✘"} ${label}` +
      (ok ? `  →  ${JSON.stringify(actual)}` : `  →  ${JSON.stringify(actual)} (expected ${JSON.stringify(expected)})`)
  );
};

const run = async () => {
  /* ── 1. brand-new customer, LocCode 01 (counter TxnNo = 4) ── */
  console.log("\n── 1. new phone, loc 01, TxnNo starts at 4 ──────");
  let store = new FakeStore({
    counters: [
      { LocCode: "01", TxnType: "CC", Prefix: "A", TxnNo: 4, TxnDescription: "Create Customer", Enable: true },
      { LocCode: "02", TxnType: "CC", Prefix: "A", TxnNo: 0, TxnDescription: "Create Customer", Enable: true },
    ],
  });
  let res = await resolveOrCreateCustomer(new FakeDb(store), {
    locCode: "01",
    phone: "+94 77 979 2705",
    name: "S.M.C.Dewaka Shashindu",
  });
  check("CusCode = A000005", res.cusCode, "A000005");
  check("created = true", res.created, true);
  check("master row RegTel normalised", store.customers[0].RegTel, "0779792705");
  check("master row LocCode", store.customers[0].LocCode, "01");
  check("NOT NULL CusType filled", store.customers[0].CusType, "");
  check("counter advanced to 5", store.counters[0].TxnNo, 5);
  check("CusID (identity) not inserted", "CusID" in store.customers[0], false);

  /* ── 2. same phone again → no duplicate ─────────────────── */
  console.log("\n── 2. same phone again (any format) ────────────");
  res = await resolveOrCreateCustomer(new FakeDb(store), {
    locCode: "01",
    phone: "0094779792705",
    name: "ignored",
  });
  check("same CusCode", res.cusCode, "A000005");
  check("created = false", res.created, false);
  check("no extra master row", store.customers.length, 1);
  check("counter untouched (still 5)", store.counters[0].TxnNo, 5);

  /* ── 3. second new phone ────────────────────────────────── */
  console.log("\n── 3. another new phone ────────────────────────");
  res = await resolveOrCreateCustomer(new FakeDb(store), {
    locCode: "01",
    phone: "0712345678",
    name: "Perera family",
  });
  check("CusCode = A000006", res.cusCode, "A000006");
  check("counter advanced to 6", store.counters[0].TxnNo, 6);

  /* ── 4. different location → its own counter ───────────── */
  console.log("\n── 4. same phone, loc 02 → separate counter ────");
  res = await resolveOrCreateCustomer(new FakeDb(store), {
    locCode: "02",
    phone: "0771111111",
    name: "Mirissa guest",
  });
  check("CusCode = A000001 (loc 02)", res.cusCode, "A000001");
  check("loc 02 counter = 1", store.counters[1].TxnNo, 1);
  check("loc 01 counter still 6", store.counters[0].TxnNo, 6);

  /* ── 5. counter out of sync with existing codes ───────── */
  console.log("\n── 5. counter out of sync (A000007 already used) ─");
  store = new FakeStore({
    customers: [
      { CusCode: "A000006", CusName: "old 1", RegTel: "0700000001", LocCode: "01", Enable: true },
      { CusCode: "A000007", CusName: "old 2", RegTel: "0700000002", LocCode: "01", Enable: true },
    ],
    // counter says "last used = 6" but 6 AND 7 already exist in the master
    counters: [{ LocCode: "01", TxnType: "CC", Prefix: "A", TxnNo: 6 }],
  });
  res = await resolveOrCreateCustomer(new FakeDb(store), {
    locCode: "01",
    phone: "0722222222",
    name: "New guest",
  });
  check("skips to A000008", res.cusCode, "A000008");
  check("counter now 8", store.counters[0].TxnNo, 8);

  /* ── 6. no counter row for the location → auto-provision ─ */
  console.log("\n── 6. location has no 'CC' counter row ─────────");
  store = new FakeStore({ counters: [] });
  res = await resolveOrCreateCustomer(new FakeDb(store), {
    locCode: "03",
    phone: "0755555555",
    name: "Auto provisioned",
  });
  check("CusCode = A000001", res.cusCode, "A000001");
  check("counter row created", store.counters.length, 1);
  check("counter loc", store.counters[0].LocCode, "03");
  check("counter TxnNo", store.counters[0].TxnNo, 1);

  /* ── 7. install without RegTel (phone is CusTel) ───────── */
  console.log("\n── 7. phone column = CusTel (no RegTel) ────────");
  const altCols = MASTER_DEFAULT.map((c) =>
    c.c === "RegTel" ? { ...c, c: "CusTel" } : c
  );
  store = new FakeStore({
    masterCols: altCols,
    customers: [{ CusCode: "A000009", CusName: "Existing", CusTel: "+94779792705", Enable: true }],
    counters: [{ LocCode: "01", TxnType: "CC", Prefix: "A", TxnNo: 9 }],
  });
  const hit = await findCustomerByPhone(new FakeDb(store), "0779792705");
  check("found via CusTel", hit, { cusCode: "A000009", cusName: "Existing" });

  /* ── 8. disabled customer is ignored → new row ────────── */
  console.log("\n── 8. phone belongs to a disabled customer ─────");
  store = new FakeStore({
    customers: [{ CusCode: "A000003", CusName: "Disabled", RegTel: "0773333333", Enable: false }],
    counters: [{ LocCode: "01", TxnType: "CC", Prefix: "A", TxnNo: 3 }],
  });
  res = await resolveOrCreateCustomer(new FakeDb(store), {
    locCode: "01",
    phone: "0773333333",
    name: "Re-activated guest",
  });
  check("new code A000004", res.cusCode, "A000004");
  check("created = true", res.created, true);

  /* ── 9. validation guards ─────────────────────────────── */
  console.log("\n── 9. guard rails ──────────────────────────────");
  const guard = async (label, input, expectThrow) => {
    try {
      await resolveOrCreateCustomer(new FakeDb(new FakeStore()), input);
      check(label, "no throw", expectThrow ? "throw" : "no throw");
    } catch {
      check(label, "throw", expectThrow ? "throw" : "no throw");
    }
  };
  await guard("short phone rejected", { phone: "123", name: "Ab" }, true);
  await guard("short name rejected", { phone: "0771234567", name: "A" }, true);

  console.log(
    failed === 0 ? "\n✅ all customer-flow checks passed\n" : `\n❌ ${failed} check(s) failed\n`
  );
  process.exit(failed === 0 ? 0 : 1);
};

run().catch((err) => {
  console.error("\n💥 test crashed:", err);
  process.exit(1);
});
