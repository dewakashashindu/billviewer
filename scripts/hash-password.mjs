#!/usr/bin/env node
// ============================================================
// Generate / verify a scrypt password hash
// (same format lib/auth.ts hashPassword() writes to
//  Tbl_UserDetails.Password — "scrypt$<salthex>$<hashhex>")
//
//   node scripts/hash-password.mjs
//       → password eka terminal eke ahanna (shell history eka
//         yanne naha) — create_admin_user.sql ekata paste karanna
//
//   node scripts/hash-password.mjs "MyStrongPassword"
//       → hash eka print karanawa
//
//   node scripts/hash-password.mjs --verify "MyStrongPassword" "scrypt$…$…"
//       → hash eka password ekata galapenawada balanna
//         (DB eke thiyena hash ekak audit karanna / purana
//          default password ekak thiyenawada kiyala check karanna)
// ============================================================
import crypto from "node:crypto";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const KEYLEN = 64; // lib/auth.ts eke scryptSync(…, 64)

function hash(password) {
  const salt = crypto.randomBytes(16);
  const digest = crypto.scryptSync(password, salt, KEYLEN);
  return `scrypt$${salt.toString("hex")}$${digest.toString("hex")}`;
}

function verify(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  try {
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    const actual = crypto.scryptSync(password, salt, KEYLEN);
    return (
      actual.length === expected.length &&
      crypto.timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}

const args = process.argv.slice(2);

/* ── verify mode ── */
if (args[0] === "--verify") {
  const [, password, stored] = args;
  if (!password || !stored) {
    console.error('Usage: node scripts/hash-password.mjs --verify "<password>" "<scrypt$…$…>"');
    process.exit(2);
  }
  const ok = verify(password, stored);
  console.log(ok ? "✅ MATCH — me password eka hash ekata galapenawa" : "❌ NO MATCH");
  process.exit(ok ? 0 : 1);
}

/* ── hash mode ── */
let password = args[0];

if (!password) {
  // Arg nathuwa → prompt (password eka shell history / ps output eka yanne naha)
  const rl = readline.createInterface({ input: stdin, output: stdout });
  password = await rl.question("New admin password: ");
  const again = await rl.question("Repeat it:        ");
  rl.close();
  if (password !== again) {
    console.error("❌ Passwords do not match");
    process.exit(1);
  }
}

if (password.length < 6) {
  console.error("❌ Password must be at least 6 characters (app eke rule eka)");
  process.exit(1);
}
if (password === "Admin@123") {
  console.error(
    '❌ "Admin@123" repo eke commit wela thiyena purana default eka — ' +
      "public nisa meka use karanna epa. Aluth strong password ekak daanna."
  );
  process.exit(1);
}

const out = hash(password);
console.log("\nPaste this into create_admin_user.sql (@hash), or run:\n");
console.log(
  `  UPDATE dbo.Tbl_UserDetails SET Password = '${out}'\n` +
    `  WHERE LTRIM(RTRIM(LoginName)) = 'admin';\n`
);
console.log(out);
