// Demo links generator — dev/mock mode eke app eka test karanna.
// Usage: node scripts/demo-links.mjs
import crypto from "node:crypto";
import fs from "node:fs";

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const KEY = (env.match(/^ENCRYPTION_KEY=(.*)$/m)?.[1] ?? "").trim();
if (KEY.length !== 16) { console.error("ENCRYPTION_KEY must be 16 chars"); process.exit(1); }

const IV = Buffer.from([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]);
const enc = (plain) => {
  const c = crypto.createCipheriv("aes-128-cbc", Buffer.from(KEY, "utf8"), IV);
  return Buffer.concat([c.update(plain, "utf8"), c.final()])
    .toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const b64url = (b) => b.toString("base64url");
const token = (t) => {
  const exp = Date.now() + 14 * 24 * 3600_000;
  const p = `${t}|${exp}`;
  return `${b64url(Buffer.from(p))}.${b64url(crypto.createHmac("sha256", KEY).update(p).digest())}`;
};

console.log("── Bill links (mock bills: MC-8492 / 8493 / 8494) ──");
for (const b of ["MC-8492", "MC-8493", "MC-8494"]) console.log(`/${"bill"}?id=${enc(b)}`);

console.log("\n── Customer menu QR links ──");
console.log(`/menu?id=${enc(`TBL:Main Dining Area\u001fT-01`)}`);
console.log(`/menu?id=${enc(`TBL:VIP Room\u001fVIP-01`)}`);
console.log(`/menu?id=${enc("TAK:TA")}   (takeaway)`);

console.log("\n── Legacy /order link ──");
console.log(`/order?table=T-05&t=${token("T-05")}`);
