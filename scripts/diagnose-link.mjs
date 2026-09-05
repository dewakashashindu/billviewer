#!/usr/bin/env node
// ============================================================
// Link decrypt diagnostic — key/algorithm mismatch hoyanna
//
//   node scripts/diagnose-link.mjs 6VEJFyewGdXJUpOMXkEN0g
//   node scripts/diagnose-link.mjs "<full link>"
//
// ENCRYPTION_KEY eka .env.local / env eken gannawa.
// Common C# variants okkoma try karanawa:
//   • Key encodings: UTF8(16B→AES-128), Unicode/UTF-16LE(32B→AES-256),
//     MD5(key), SHA256(key), zero-padded 32B
//   • Modes: CBC (fixed IV + zero IV) and ECB
// Print-out text ekak (bill number wage) wela decana eka thamai hari eka.
// ============================================================
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// .env loader
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
  console.error("Usage: node scripts/diagnose-link.mjs <link-or-id>");
  process.exit(1);
}

let id = raw;
if (raw.includes("id=")) {
  try {
    id = new URL(raw).searchParams.get("id");
  } catch {
    id = raw.split("id=")[1]?.split("&")[0] ?? raw;
  }
}

const keyStr = process.env.ENCRYPTION_KEY;
if (!keyStr) {
  console.error("❌ ENCRYPTION_KEY naha (.env.local check karanna)");
  process.exit(1);
}
console.log(`\nKey (env eken): "${keyStr}" (${keyStr.length} chars)`);

let cipherBytes;
try {
  let b64 = id.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  cipherBytes = Buffer.from(b64, "base64");
} catch (e) {
  console.error("❌ Base64 decode wenne naha — ID eka damaged da?");
  process.exit(1);
}
console.log(
  `Ciphertext: ${cipherBytes.length} bytes (${
    cipherBytes.length % 16 === 0 ? "block-aligned ✓" : "⚠️ NOT block-aligned!"
  })\n`
);

// ── Key candidate generators ──
const FIXED_IV = Buffer.from([
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
  0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
]);
const ZERO_IV = Buffer.alloc(16, 0);

const keyCandidates = [
  { name: "UTF8 bytes (16B → AES-128)", bytes: Buffer.from(keyStr, "utf8") },
  {
    name: "Unicode UTF-16LE (32B → AES-256)",
    bytes: Buffer.from(keyStr, "utf16le"),
  },
  { name: "MD5(key) (16B → AES-128)", bytes: crypto.createHash("md5").update(keyStr, "utf8").digest() },
  {
    name: "SHA256(key) (32B → AES-256)",
    bytes: crypto.createHash("sha256").update(keyStr, "utf8").digest(),
  },
  {
    name: "UTF8 zero-padded to 32B (AES-256)",
    bytes: Buffer.concat([
      Buffer.from(keyStr, "utf8"),
      Buffer.alloc(32 - Buffer.byteLength(keyStr, "utf8"), 0),
    ]).subarray(0, 32),
  },
];

const modeIvCombos = [
  { name: "CBC + fixed IV(00..0f)", mode: "aes-128-cbc", iv: FIXED_IV, mode256: "aes-256-cbc" },
  { name: "CBC + zero IV", mode: "aes-128-cbc", iv: ZERO_IV, mode256: "aes-256-cbc" },
  { name: "ECB (no IV)", mode: "aes-128-ecb", iv: null, mode256: "aes-256-ecb" },
];

const printable = (buf) => {
  if (!buf.length) return null;
  const s = buf.toString("utf8");
  // Bill number wage clean ASCII text da?
  if (/^[\x20-\x7E]{2,40}$/.test(s)) return s;
  return null;
};

const results = [];
for (const kc of keyCandidates) {
  if (![16, 24, 32].includes(kc.bytes.length)) continue;
  for (const combo of modeIvCombos) {
    const algo = kc.bytes.length === 32 ? combo.mode256 : combo.mode;
    try {
      const d = crypto.createDecipheriv(algo, kc.bytes, combo.iv);
      d.setAutoPadding(true);
      const out = Buffer.concat([d.update(cipherBytes), d.final()]);
      const text = printable(out);
      results.push({ combo: combo.name, key: kc.name, algo, ok: true, text });
    } catch {
      results.push({ combo: combo.name, key: kc.name, algo, ok: false });
    }
  }
}

let found = 0;
for (const r of results) {
  if (r.ok && r.text) {
    found++;
    console.log(
      `✅ MATCH!  [${r.algo}]  key=${r.key}  mode=${r.combo}\n   → Bill Number: "${r.text}"\n`
    );
  }
}

if (!found) {
  const anyDecryptOk = results.filter((r) => r.ok).length;
  console.log("❌ Kisi variant ekakin decodable text ekak una naha.\n");
  console.log("   Me key eken me link eka decrypt karanna beri unathe 99% key mismatch.");
  console.log("   Check list:");
  console.log("   1. Windows service eke env/config eke ENCRYPTION_KEY eka exactly mokakda?");
  console.log("      (appsettings.json / app.config / Environment variable balanna)");
  console.log("   2. Eka exactly 16 chars da? Case sensitive — copy/paste karanna");
  console.log("   3. .env.local eke key eka update karala aye run karanna");
  console.log("   4. Key eka hari nam C# encrypt code eka (service eke) mata ewanna —");
  console.log("      algorith eka venas wela da balanna (padding / IV / key derivation)");
  if (anyDecryptOk) {
    console.log(
      "\n   ℹ️ Padding error nathi wela decrypt unath clean text una naha —"
    );
    console.log(
      "      ekiyanne algorithm hari, habai plaintext eka bill number ekak nathuwam welcome."
    );
  }
  process.exit(2);
}
