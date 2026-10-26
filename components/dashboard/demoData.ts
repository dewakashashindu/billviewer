"use client";

// ============================================================
// LOCATION: components/dashboard/demoData.ts     (ALUTH FILE)
//
// Dashboard aluth section 2kata DEMO data generators.
//   • same date range ekata same numbers (deterministic seed)
//   • DB configure wela nathiwa (`isDbConfigured() === false`) action
//     eka meka use karanawa
//   • /preview/ops wage public preview ekakata client-side eketh
//     use karanna puluwan (server action ekak one nathiwa)
//
// ⚠️ Types witharak app/actions/dashboardOps.ts eken import karanawa
//    (type-only → runtime import ekak nathiwa).
// ============================================================
import type {
  DashboardOpsData,
  HeatCell,
  NameAmt,
} from "@/app/actions/dashboardOps";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/* ═══════════════════════════════════════════════════════════
   DEMO fallback (DB configure wela nathi welawata witharai)
   — deterministic: same date range ekata same numbers
   ═══════════════════════════════════════════════════════════ */
export function seeded(seedText: string) {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const f = new Date(`${from}T00:00:00`);
  const t = new Date(`${to}T00:00:00`);
  if (isNaN(f.getTime()) || isNaN(t.getTime())) return [from];
  const d = new Date(f);
  let guard = 0;
  while (d <= t && guard < 120) {
    const p2 = (n: number) => String(n).padStart(2, "0");
    out.push(`${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`);
    d.setDate(d.getDate() + 1);
    guard++;
  }
  return out.length ? out : [from];
}

const DEMO_ITEMS = [
  "LEMON BUTTER KING PRAWNS 300G", "LION STRONG 625ML", "SEA FOOD FRIED RICE",
  "CHICKEN KOTTU", "CARLSBERG 625ML", "LEMON HERB CALAMARI 250G",
  "WARM CHOCOLATE BROWNIE (V)", "ICE CREAM DELIGHT (V)", "CIDER - APPLE 330ML",
  "PRINTED DOCKET - WATER 500ML",
];
const DEMO_PAY = ["CASH", "CARD", "CREDIT", "ROOM CHARGE", "ONLINE"];
const DEMO_MODES = ["DINE IN", "TAKE AWAY", "DELIVERY"];
const DEMO_CASHIERS = ["RASIKA", "NIMAL", "ASANKA", "DILHANI"];

/* Live tab — MAIN locations only (SubLoc = false) */
export const DEMO_LOCATIONS = [
  { code: "01", name: "MILLA MIRISSA" },
  { code: "05", name: "TUANA" },
];

export function demoOps(from: string, to: string, loc = ""): DashboardOpsData {
  const days = daysBetween(from, to);
  const rnd = seeded(`ops|${from}|${to}|${loc}`);
  const hourNets: number[] = new Array(24).fill(0);
  const hourBills: number[] = new Array(24).fill(0);
  const hourPax: number[] = new Array(24).fill(0);
  const pay: NameAmt[] = DEMO_PAY.map((n) => ({ name: n, amt: 0 }));
  const modes: NameAmt[] = DEMO_MODES.map((n) => ({ name: n, amt: 0 }));
  const types: NameAmt[] = [
    { name: "FOOD", amt: 0 }, { name: "BEVERAGE", amt: 0 }, { name: "LIQUOR", amt: 0 },
  ];
  const cash: NameAmt[] = DEMO_CASHIERS.map((n) => ({ name: n, amt: 0 }));
  const itemsRev: NameAmt[] = DEMO_ITEMS.map((n) => ({ name: n, amt: 0 }));
  const itemsQty: NameAmt[] = DEMO_ITEMS.map((n) => ({ name: n, amt: 0 }));
  const heat: HeatCell[] = [];

  let gross = 0, discount = 0, sc = 0, vat = 0, tdl = 0, net = 0, bills = 0, pax = 0;

  days.forEach((day) => {
    const weekend = [0, 6].includes(new Date(`${day}T00:00:00`).getDay());
    const dayFactor = (weekend ? 1.35 : 1) * (0.9 + rnd() * 0.25);
    let dayNet = 0;
    for (let hr = 11; hr <= 23; hr++) {
      const shape = hr >= 19 && hr <= 21 ? 1.6 : hr >= 13 && hr <= 14 ? 1.1 : hr >= 17 ? 0.9 : 0.55;
      const hNet = Math.round(28000 * shape * dayFactor * (0.75 + rnd() * 0.5));
      const hBills = Math.max(1, Math.round(hNet / 2700));
      const hPax = Math.round(hBills * (2.4 + rnd() * 2.2));
      hourNets[hr] += hNet;
      hourBills[hr] += hBills;
      hourPax[hr] += hPax;
      heat.push({ day, hour: hr, net: hNet });
      net += hNet;
      bills += hBills;
      pax += hPax;
      dayNet += hNet;
    }
    gross += Math.round(dayNet * 1.15);
    discount += Math.round(dayNet * 0.04);
    sc += Math.round(dayNet * 0.11);
    vat += Math.round(dayNet * 0.15);
    tdl += Math.round(dayNet * 0.015);
  });

  const share = [0.46, 0.5, 0.03, 0.005];
  const modeShare = [0.58, 0.25, 0.17];
  const typeShare = [0.72, 0.19, 0.09];
  const cashShare = [0.36, 0.28, 0.22, 0.14];
  pay.forEach((p, i) => { p.amt = Math.round(net * (share[i] ?? 0.02)); });
  modes.forEach((m, i) => { m.amt = Math.round(net * (modeShare[i] ?? 0)); });
  types.forEach((t, i) => { t.amt = Math.round(net * (typeShare[i] ?? 0)); });
  cash.forEach((c, i) => { c.amt = Math.round(net * (cashShare[i] ?? 0)); });
  itemsRev.forEach((it, i) => {
    it.amt = Math.round(net * (0.12 / (i + 1)) + rnd() * 4000);
    itemsQty[i].amt = Math.round(it.amt / (900 + rnd() * 1600));
  });
  itemsRev.sort((a, b) => b.amt - a.amt);
  itemsQty.sort((a, b) => b.amt - a.amt);

  /* location eken filter kalahama numbers poddk wenas wenawa (real feel ekata) */
  const locFactor = !loc || loc.toUpperCase() === "ALL" ? 1 : loc === "01" ? 0.62 : 0.38;
  if (locFactor !== 1) {
    const scale = (n: number) => Math.round(n * locFactor);
    net = scale(net); gross = scale(gross); discount = scale(discount);
    sc = scale(sc); vat = scale(vat); tdl = scale(tdl);
    bills = scale(bills); pax = scale(pax);
    pay.forEach((x) => (x.amt = scale(x.amt)));
    modes.forEach((x) => (x.amt = scale(x.amt)));
    types.forEach((x) => (x.amt = scale(x.amt)));
    cash.forEach((x) => (x.amt = scale(x.amt)));
    itemsRev.forEach((x) => (x.amt = scale(x.amt)));
    itemsQty.forEach((x) => (x.amt = scale(x.amt)));
    heat.forEach((x) => (x.net = scale(x.net)));
  }

  return {
    from, to,
    loc,
    locations: DEMO_LOCATIONS,
    totals: {
      net, gross, discount, serviceCharge: sc, vat, tdl, bills, pax,
      avgBill: bills ? round2(net / bills) : 0,
      avgPax: bills ? round2(pax / bills) : 0,
    },
    hourly: hourNets
      .map((n, hr) => ({ hour: hr, net: n, bills: hourBills[hr], pax: hourPax[hr] }))
      .filter((p) => p.net > 0 || p.bills > 0),
    payModes: pay,
    orderModes: modes,
    billTypes: types,
    topItemsRev: itemsRev.slice(0, 10),
    topItemsQty: itemsQty.slice(0, 10),
    cashiers: cash,
    heat,
    days,
  };
}
