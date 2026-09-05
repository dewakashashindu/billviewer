#!/usr/bin/env node
// ============================================================
// Decrypt a bill link / ID — verify Windows service links work
//
//   node scripts/decrypt-link.mjs 4bmCGztDtSdVmGUTaDyjfQ
//   node scripts/decrypt-link.mjs "https://microechefbillviewer.netlify.app/bill?id=4bmCGztDtSdVmGUTaDyjfQ"
//
// Uses ENCRYPTION_KEY from .env.local / .env / environment.
// Printed bill number = what the app will query the DB with.
// ============================================================
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Simple .env loader (no dependencies)
for (const file of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), file);
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  }
}

const raw = process.argv[2];
if (!raw) {
  console.error("Usage: node scripts/decrypt-link.mjs <link-or-id>");
  console.error(
    "Example: node scripts/decrypt-link.mjs 4bmCGztDtSdVmGUTaDyjfQ"
  );
  process.exit(1);
}

// Full URL nam eken ID eka witharak gannawa
let id = raw;
if (raw.includes("id=")) {
  try {
    id = new URL(raw).searchParams.get("id");
  } catch {
    id = raw.split("id=")[1]?.split("&")[0] ?? raw;
  }
}

const key = process.env.ENCRYPTION_KEY;
if (!key || key.length !== 16) {
  console.error(
    `❌ ENCRYPTION_KEY must be set and exactly 16 characters (current: ${
      key ? key.length : "not set"
    }) — Windows service eke key eka ekama wenna one`
  );
  process.exit(1);
}

const IV = Buffer.from([
  0x00, 0x01, 0x02, 0x03,
  0x04, 0x05, 0x06, 0x07,
  0x08, 0x09, 0x0a, 0x0b,
  0x0c, 0x0d, 0x0e, 0x0f,
]);

try {
  let base64 = id.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";

  const decipher = crypto.createDecipheriv(
    "aes-128-cbc",
    Buffer.from(key, "utf8"),
    IV
  );
  let decrypted = decipher.update(Buffer.from(base64, "base64"));
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  const billNo = decrypted.toString("utf8").trim();
  console.log("");
  console.log(`ID          : ${id}`);
  console.log(`Bill Number : "${billNo}"`);
  console.log("");
  console.log("→ Me bill number eken thamai DB eka query wenne.");
  console.log("  Verify: node scripts/check-db.mjs \"" + billNo + "\"");
  console.log("");
} catch (err) {
  console.error("");
  console.error(`❌ Decrypt wenne naha: ${err.message}`);
  console.error("");
  console.error("Reasons:");
  console.error(
    "  1. ENCRYPTION_KEY eka Windows service eke key ekata aduwa"
  );
  console.error("  2. ID eka truncated / damaged (SMS eken cut unta)");
  process.exit(1);
}
