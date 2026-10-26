// ============================================================
// scripts/test-customer-code.mjs  (dev only)
//
// Pure-function checks for lib/customerService.ts:
//   • normalisePhone  — every phone shape the POS can hold
//   • buildCustomerCode — Prefix + zero-padded TxnNo (A000005)
//   • defaultLocCode  — env fallback
//
// Usage:  npx tsx scripts/test-customer-code.mjs
// ============================================================
import {
  buildCustomerCode,
  defaultLocCode,
  findColumnName,
  normalisePhone,
} from "../lib/customerService.ts";

let failed = 0;
const eq = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failed += 1;
  console.log(`${ok ? "✔" : "✘"} ${label}  →  "${actual}"${ok ? "" : `   (expected "${expected}")`}`);
};

console.log("\n── normalisePhone ─────────────────────────────");
eq("0779792705", normalisePhone("0779792705"), "0779792705");
eq("+94 77 979 2705", normalisePhone("+94 77 979 2705"), "0779792705");
eq("0094 77 979 2705", normalisePhone("0094 77 979 2705"), "0779792705");
eq("94779792705", normalisePhone("94779792705"), "0779792705");
eq("(077) 979-2705", normalisePhone("(077) 979-2705"), "0779792705");
eq("empty", normalisePhone(""), "");

console.log("\n── buildCustomerCode (pad 6) ──────────────────");
eq("A + 5", buildCustomerCode("A", 5), "A000005");
eq("A + 1", buildCustomerCode("A", 1), "A000001");
eq("A + 1234567 (no cut)", buildCustomerCode("A", 1234567), "A1234567");
eq("A + 4.9 (float TxnNo → floor)", buildCustomerCode("A", 4.9), "A000004");
eq("A + 0 (never 0)", buildCustomerCode("A", 0), "A000001");
eq("'A ' trailing space trimmed", buildCustomerCode("A ", 12), "A000012");
eq("empty prefix", buildCustomerCode("", 7), "000007");

console.log("\n── findColumnName (ContactNo detection) ──────");
const qrCols = new Map([
  ["LOCCODE", "LocCode"],
  ["CUSCODE", "CusCode"],
  ["CONTACTNO", "ContactNo"],
  ["ROWLIN", "RowLine"],
]);
const candidates = ["ContactNo", "Contact_No", "CusTel", "Mobile", "Phone"];
eq("ContactNo found", findColumnName(qrCols, candidates), "ContactNo");
eq(
  "CusTel fallback",
  findColumnName(new Map([["CUSTEL", "CusTel"]]), candidates),
  "CusTel"
);
eq("missing column → null", findColumnName(new Map([["LOCCODE", "LocCode"]]), candidates), null);
eq("no schema loaded → null", findColumnName(undefined, candidates), null);
eq(
  "real name casing preserved",
  findColumnName(new Map([["CONTACTNO", "contactno"]]), candidates),
  "contactno"
);

console.log("\n── defaultLocCode ────────────────────────────");
eq("env unset", defaultLocCode(), "01");
process.env.DEFAULT_LOC_CODE = "02";
eq("env = 02", defaultLocCode(), "02");
process.env.DEFAULT_LOC_CODE = "  ";
eq("env = spaces", defaultLocCode(), "01");
delete process.env.DEFAULT_LOC_CODE;

console.log(
  failed === 0
    ? "\n✅ all customer-code checks passed\n"
    : `\n❌ ${failed} check(s) failed\n`
);
process.exit(failed === 0 ? 0 : 1);
