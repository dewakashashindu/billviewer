#!/usr/bin/env bash
# ============================================================
# LOCATION: scripts/security-smoke.sh
# Auth hardening smoke test — me fixes wada karawanada kiyala
# running server ekakata gahala verify karanawa.
#
#   ./scripts/security-smoke.sh                 # http://localhost:3000
#   BASE=https://my-site.netlify.app ./scripts/security-smoke.sh
#
# NOTE: in-memory rate limiter eka nisa server eka **restart karala**
# run karanna (nathnam kalinda buckets walin results wenas wenawa).
# Mock mode (DB_* blank) eke aththat wada karawa — DB ekak onne naha.
# ============================================================
set -u
BASE="${BASE:-http://localhost:3000}"
KEY="${ENCRYPTION_KEY:-MyLocalDevKey123}"

pass=0; fail=0
check() { # check <label> <expected> <actual>
  if [ "$2" = "$3" ]; then printf "  ✅ %-58s %s\n" "$1" "$3"; pass=$((pass+1));
  else printf "  ❌ %-58s got %s, want %s\n" "$1" "$3" "$2"; fail=$((fail+1)); fi
}
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "BASE=$BASE"
echo
echo "── 1) back office pages (cookie nathuwa) ──────────────────"
for p in /dashboard /reports /reports/sales-summary /orders /table-qr /settings /user-creation; do
  check "$p → /login" "307" "$(code "$BASE$p")"
done

echo
echo "── 2) removed legacy unauthenticated order routes ─────────"
check "POST /api/orders/confirm  (deleted)" "404" \
  "$(code -X POST "$BASE/api/orders/confirm" -H 'Content-Type: application/json' \
      -d '{"tableNo":"VIP-01","customerName":"H","customerPhone":"0771234567","items":[{"itemId":"CFR1","quantity":5}]}')"
check "GET  /api/orders/existing (deleted)" "404" "$(code "$BASE/api/orders/existing?table=VIP-01")"
# T-05 ta sign kara token ekak VIP-01 ta use karala → mismatch.
# Meka dev + production DEKENMA 403 (dev bypass eka missing-token ekata witharak).
T05_TOKEN=$(KEY="$KEY" node -e '
const c=require("crypto");const K=process.env.KEY;
const exp=Date.now()+14*24*3600e3;const p=`T-05|${exp}`;
process.stdout.write(Buffer.from(p).toString("base64url")+"."+c.createHmac("sha256",K).update(p).digest("base64url"));')
check "POST /api/order/confirm wrong-table token → 403" "403" \
  "$(code -X POST "$BASE/api/order/confirm" -H 'Content-Type: application/json' \
      -d "{\"tableNo\":\"VIP-01\",\"t\":\"$T05_TOKEN\",\"customerName\":\"Test Guest\",\"customerPhone\":\"0771234567\",\"localPax\":1,\"items\":[{\"itemId\":\"CFR1\",\"quantity\":1}]}")"
check "POST /api/order/confirm valid token+table → 200" "200" \
  "$(code -X POST "$BASE/api/order/confirm" -H 'Content-Type: application/json' \
      -d "{\"tableNo\":\"T-05\",\"t\":\"$T05_TOKEN\",\"customerName\":\"Test Guest\",\"customerPhone\":\"0771234567\",\"localPax\":1,\"items\":[{\"itemId\":\"CFR1\",\"quantity\":1}]}")"

echo
echo "── 3) admin / protected APIs ──────────────────────────────"
check "GET  /api/auth/me"        "401" "$(code "$BASE/api/auth/me")"
check "GET  /api/admin/users"    "401" "$(code "$BASE/api/admin/users")"
check "POST /api/order/qr"       "401" \
  "$(code -X POST "$BASE/api/order/qr" -H 'Content-Type: application/json' -d '{"tables":[{"tableNo":"T-01"}]}')"

echo
echo "── 4) /api/auth/forgot — uniform response, no enumeration ─"
# 3 requests: same login name → per-user limit (2/hour) 3rd eke 429 denawa.
# Body eka account eka thiyeda nadda kiyala EKAMA wenna one.
B1=$(curl -s -X POST "$BASE/api/auth/forgot" -H 'Content-Type: application/json' -d '{"loginName":"does-not-exist-xyz"}')
B2=$(curl -s -X POST "$BASE/api/auth/forgot" -H 'Content-Type: application/json' -d '{"loginName":"admin"}')
check "unknown login name → uniform 200 body" "yes" \
  "$(echo "$B1" | grep -q '"success":true' && echo yes || echo no)"
check "known login name   → SAME body" "yes" "$([ "$B1" = "$B2" ] && echo yes || echo no)"
check "no maskedPhone / 404 / 'no mobile number' leak" "yes" \
  "$(echo "$B1$B2" | grep -qi 'maskedPhone\|No active account\|No mobile number' && echo no || echo yes)"
C3=$(code -X POST "$BASE/api/auth/forgot" -H 'Content-Type: application/json' -d '{"loginName":"admin"}')
C4=$(code -X POST "$BASE/api/auth/forgot" -H 'Content-Type: application/json' -d '{"loginName":"admin"}')
check "2nd request for same login name → 200 (limit 2)" "200" "$C3"
check "3rd request for same login name → 429" "429" "$C4"

echo
echo "── 5) /api/auth/reset — OTP brute force + replay ──────────"
BOGUS="9999999999999.bogussig"
for i in 1 2 3 4 5; do
  check "wrong code #$i → 401" "401" \
    "$(code -X POST "$BASE/api/auth/reset" -H 'Content-Type: application/json' \
        -H "Cookie: mcf_otp=$BOGUS" \
        -d '{"loginName":"brutevictim","code":"111111","password":"NewPass123"}')"
done
check "wrong code #6 → 429 (guess limit)" "429" \
  "$(code -X POST "$BASE/api/auth/reset" -H 'Content-Type: application/json' \
      -H "Cookie: mcf_otp=$BOGUS" \
      -d '{"loginName":"brutevictim","code":"111111","password":"NewPass123"}')"

# Valid OTP token ekak server eke secret ekenma mint karala replay test eka
OTP=$(KEY="$KEY" node -e '
const c=require("crypto");const K=process.env.KEY;
const exp=Math.floor(Date.now()/1000)+600;const code="246810";const login="replayuser";
const sig=c.createHmac("sha256",K).update(`otp|${login}|${code}|${exp}`).digest("base64url");
process.stdout.write(`${exp}.${sig}`);')
R1=$(code -X POST "$BASE/api/auth/reset" -H 'Content-Type: application/json' -H "Cookie: mcf_otp=$OTP" \
      -d '{"loginName":"replayuser","code":"246810","password":"NewPass123"}')
R2=$(code -X POST "$BASE/api/auth/reset" -H 'Content-Type: application/json' -H "Cookie: mcf_otp=$OTP" \
      -d '{"loginName":"replayuser","code":"246810","password":"NewPass123"}')
M2=$(curl -s -X POST "$BASE/api/auth/reset" -H 'Content-Type: application/json' -H "Cookie: mcf_otp=$OTP" \
      -d '{"loginName":"replayuser","code":"246810","password":"NewPass123"}')
# mock mode eke DB nathi nisa 1st call eka 500 (DB not configured) — OTP eka verify + consume unaa
check "valid OTP 1st use → passes verification (mock: 500 DB)" "500" "$R1"
check "valid OTP REPLAY → 401 (consumed)" "401" "$R2"
check "replay message says 'already been used'" "yes" \
  "$(echo "$M2" | grep -qi 'already been used' && echo yes || echo no)"

echo
echo "── 6) /api/auth/login per-IP limit (30 / 15 min) ──────────"
LAST=""
for i in $(seq 1 31); do
  LAST=$(code -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
    -d '{"loginName":"admin","password":"wrong"}')
done
check "31st login attempt → 429" "429" "$LAST"

echo
echo "── 6b) production-only guards (EXPECT_PROD=1 nam strict) ──"
# Dev eke me protections OFF (NODE_ENV check) — production eke ON.
DEC=$(code "$BASE/api/decrypt?id=gg8hfSzb5MsVqkihX0xBaQ")
NOTOK=$(code -X POST "$BASE/api/order/confirm" -H 'Content-Type: application/json' \
  -d '{"tableNo":"T-05","customerName":"Test Guest","customerPhone":"0771234567","localPax":1,"items":[{"itemId":"CFR1","quantity":1}]}')
if [ "${EXPECT_PROD:-0}" = "1" ]; then
  check "GET /api/decrypt (no session) → 401" "401" "$DEC"
  check "POST /api/order/confirm (no token) → 403" "403" "$NOTOK"
else
  printf "  ℹ️  /api/decrypt no-session = %s · no-token order = %s  (dev eke open — production eke 401/403)\n" "$DEC" "$NOTOK"
fi

echo
echo "── 7) customer routes still public (regression) ───────────"
check "GET /bill?id=<demo> 200" "200" "$(code "$BASE/bill?id=gg8hfSzb5MsVqkihX0xBaQ")"
check "GET /menu?id=<demo> 200" "200" "$(code "$BASE/menu?id=38XeezWFhHhoQpIST7qz-TzOweZ9ylwy5NfwPvP-n0k")"
check "GET /api/menu/items 200"  "200" "$(code "$BASE/api/menu/items?limit=2")"
check "GET /login 200"           "200" "$(code "$BASE/login")"

echo
echo "────────────────────────────────────────────"
echo "  PASS: $pass   FAIL: $fail"
[ "$fail" -eq 0 ] && echo "  ✅ all checks passed" || echo "  ❌ some checks failed"
exit "$fail"
