#!/usr/bin/env node
// ============================================================
// Generate an encrypted bill link
//
//   node scripts/generate-link.mjs MC-8492
//
// Encrypts the bill number with ENCRYPTION_KEY (AES-128-CBC,
// fixed IV — same scheme the /api/bill decrypt route expects)
// and prints the customer-facing /bill?id=... URL.
// Reads ENCRYPTION_KEY from .env.local / .env or the environment.
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

const billNo = process.argv[2];
if (!billNo) {
  console.error("Usage: node scripts/generate-link.mjs <BillNo>");
  console.error("Example: node scripts/generate-link.mjs MC-8492");
  process.exit(1);
}

const key = process.env.ENCRYPTION_KEY;
if (!key || key.length !== 16) {
  console.error(
    `❌ ENCRYPTION_KEY must be set and exactly 16 characters (current: ${
      key ? key.length : "not set"
    })`
  );
  process.exit(1);
}

const IV = Buffer.from([
  0x00, 0x01, 0x02, 0x03,
  0x04, 0x05, 0x06, 0x07,
  0x08, 0x09, 0x0a, 0x0b,
  0x0c, 0x0d, 0x0e, 0x0f,
]);

const cipher = crypto.createCipheriv(
  "aes-128-cbc",
  Buffer.from(key, "utf8"),
  IV
);
const encrypted = Buffer.concat([cipher.update(billNo, "utf8"), cipher.final()]);

// URL-safe Base64 (no padding) — matches the decrypt route
const id = encrypted
  .toString("base64")
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");

const base = process.env.PUBLIC_BASE_URL || "http://localhost:3000";

console.log("");
console.log(`Bill No : ${billNo}`);
console.log(`Link    : ${base}/bill?id=${id}`);
console.log("");
