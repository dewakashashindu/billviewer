# billviewer 🧾

Restaurant bill viewer — QR / link ekak hinda customer ta digital bill eka pennanna.
Next.js + React + MSSQL (SmarterASP.NET).

**Production flow:**

```
Windows Service (POS)  →  BillNo encrypt karala link eka yawana (SMS/email/QR)
        https://microechefbillviewer.netlify.app/bill?id=<encrypted>
                                    │
                                    ▼
        Netlify (me app eka)  →  /api/bill decrypt karanawa (ENCRYPTION_KEY)
                                    │
                                    ▼
        SmarterASP MSSQL  →  Tbl_BillHeader + Tbl_BillDetails + Tbl_MenuItems
                             + Tbl_BillPayTxn → bill UI + PDF download
```

⚠️ **`ENCRYPTION_KEY` eka Windows service eke key ekama wenna one** — ehema nattam
links decrypt wenne naha. Verify karanna: `node scripts/decrypt-link.mjs <link>`

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

### `.env.local` values

| Variable | Description |
|---|---|
| `ENCRYPTION_KEY` | **Exactly 16 chars.** Must match the key used to generate links |
| `DB_SERVER` | SmarterASP MSSQL host (e.g. `sql6020.site4now.net`) |
| `DB_PORT` | Usually `1433` |
| `DB_DATABASE` | Database name |
| `DB_USER` / `DB_PASSWORD` | DB credentials |

> DB vars empty nattan app eka **mock data** ekata fallback wenawa (dev mode).

## Generate a bill link (QR ekata / SMS ekata)

```bash
node scripts/generate-link.mjs MC-8492
# → http://localhost:3000/bill?id=4bmCGzt...
```

Production eke `PUBLIC_BASE_URL` env eka set karanna (e.g. `https://bills.yourdomain.lk`).

## How it works

- `lib/db.ts` — MSSQL pool singleton (`mssql` / tedious)
- `lib/billService.ts` — 3-table query + `Bill` object ekata mapping
- `lib/billFormat.ts` — shared types + totals breakdown helper (client-safe)
- `app/api/bill/route.ts` — decrypt → DB fetch (mock fallback)
- `app/api/decrypt/route.ts` — standalone decrypt API (testing)
- `app/bill/page.tsx` — bill UI (totals breakdown, status badge, promo popup, PDF download)

### Bill totals mapping

| On-screen | DB field(s) |
|---|---|
| Subtotal | `Tbl_BillHeader.Gross` |
| Discount | `DisVal` |
| Service Charge | `SerChg + OtherSerChg` |
| VAT | `VAT + OtherVAT` |
| TDL | `TDL` |
| Packing / Delivery | `PackChg` / `DelChg + DeleveryAreaChg` |
| Grand Total | `NetTotal` |
| Status | `Tbl_BillPayTxn.ActAmt` sum ≥ `NetTotal` → PAID; `DoNotShowInSales=1` → CANCELLED |

Empty charges (0) UI eke pennanne naha. Item names `Tbl_MenuItems.MenuItmDes`
enenanne (fallback: `PrintDes` → `SubItmId`).

## Deploy (Netlify) — production flow

1. **Meka push karanna GitHub ekata** → Netlify eka auto-deploy wenawa (repo already linked)

2. **Netlify → Site configuration → Environment variables** eke meka daanna:

   | Variable | Value | Note |
   |---|---|---|
   | `ENCRYPTION_KEY` | *(already set ✓)* | **Change karanna epa** — Windows service eke key ekama |
   | `DB_SERVER` | `sqlXXXX.site4now.net` | SmarterASP Control Panel → Databases |
   | `DB_PORT` | `1433` | |
   | `DB_DATABASE` | DB name | |
   | `DB_USER` / `DB_PASSWORD` | DB credentials | |

3. Deploy una passe **real link ekak** (Windows service eken ena) open karala balanna

> **DB access:** Netlify functions AWS idan connect wenawa. Windows service eka
> local POS machine eken SmarterASP DB ekata connect wenawa nisa remote access
> already ON — SmarterASP eka specific IP walata limit kaloth witharak Netlify
> IPs add karanna wenawa.

## Local testing (deploy karanna kalin)

```bash
cp .env.example .env.local    # real DB credentials + Windows service key eka daanna
npm run dev

node scripts/check-db.mjs <realBillNo>        # DB eken data enawada balanna
node scripts/decrypt-link.mjs "<real link>"   # Windows service link eka decrypt wenna one
```

Dekama ✅ nam app eka 100% ready.

## Deploy alternative: SmarterASP.NET Node.js hosting

1. Control Panel → **Node.js APP** → create app (Node 20+), map domain
2. Application root eke repo eka upload karanna (`node_modules` omit karala — panel eken `npm install`)
3. Application startup file: `node_modules/next/dist/bin/next` args `start` — or build karala `npm start`
4. Env variables (.env.local content) panel eken set karanna / `.env.local` upload karanna
5. First deploy eke `npm run build` run karanna (SSH/terminal available nam)
