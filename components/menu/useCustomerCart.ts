"use client";

// ============================================================
// LOCATION: components/menu/useCustomerCart.ts
//
// The web twin of the Expo app's Menu Cart:
//   • the table's already-ordered lines are READ-ONLY (baseline)
//   • only the items the guest adds now are editable
//   • confirm sends ONLY the additions (additive, same as
//     apiClient.confirmCart in the app) so nothing is billed twice
//   • the confirmed cart becomes the new baseline ("add more items")
//
// Storage: localStorage per table, so a reload never loses the cart.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lineKey, type CartLine, type ConfirmResult, type ExistingLine, type MenuItem } from "./types";

interface CartStore {
  lines: CartLine[];
  baseline: Record<string, { qty: number; name: string; price: number; remark: string }>;
  invoiceNo: string;
}

export interface CartRow {
  rowId: string;
  lineKey: string;
  itemId: string;
  name: string;
  unitPrice: number;
  remark: string;
  /** TOTAL quantity for this line (already-ordered + newly added). */
  qty: number;
  /** How many of `qty` are already on the bill (read-only part). */
  baseQty: number;
  /** true = nothing new on this line, the guest cannot change it. */
  readOnly: boolean;
}

/** Guest details collected on the form between welcome and menu. */
export interface GuestDetails {
  /** Local guests (Tbl_HoldUpsCloud.LPax) — not used for takeaway. */
  localPax: number;
  /** Foreign guests (Tbl_HoldUpsCloud.FPax) — not used for takeaway. */
  foreignPax: number;
  /** Customer name (Tbl_HoldUpsCloud.CusName) — mandatory. */
  cusName: string;
  /** Customer phone (Tbl_HoldUpsCloud.CusCode / lookup key) — mandatory. */
  cusPhone: string;
  /** Tbl_CustomerMaster.CusCode when the phone is a known customer. */
  cusCode: string;
}

const guestStorageKey = (table: string) => `mnu-guest:v2:${table}`;

interface Options {
  table: string;
  tableGroup?: string;
  /** Signed table token from the QR (?t=…) — required by the
   *  guarded /api/order/* endpoints in production. */
  token?: string;
  itemsById: Map<string, MenuItem>;
  /** Takeaway QR — no pax, orders are saved with OrderType TA. */
  takeaway?: boolean;
}

const storageKey = (table: string) => `mnu-cart:v1:${table}`;

function readStore(table: string): CartStore | null {
  try {
    const raw = localStorage.getItem(storageKey(table));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CartStore;
    if (!parsed || !Array.isArray(parsed.lines)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStore(table: string, store: CartStore | null) {
  try {
    if (!store) localStorage.removeItem(storageKey(table));
    else localStorage.setItem(storageKey(table), JSON.stringify(store));
  } catch {
    /* storage full / private mode — cart still works in memory */
  }
}

export function useCustomerCart({ table, tableGroup, token, itemsById, takeaway = false }: Options) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [baseline, setBaseline] = useState<CartStore["baseline"]>({});
  const [invoiceNo, setInvoiceNo] = useState("");
  // storage must not be written until the saved cart + the table's current
  // bill have been read, otherwise the first render wipes the saved cart.
  const [hydrated, setHydrated] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ConfirmResult | null>(null);
  const inFlightRef = useRef(false); // double-tap guard (like confirmInFlightRef)

  /* ── 0. guest details (pax + customer name), persisted per table ── */
  const [guest, setGuest] = useState<GuestDetails>({
    localPax: 0,
    foreignPax: 0,
    cusName: "",
    cusPhone: "",
    cusCode: "",
  });
  const [guestHydrated, setGuestHydrated] = useState(false);

  useEffect(() => {
    if (!table) return;
    let alive = true;
    (async () => {
      try {
        const raw = localStorage.getItem(guestStorageKey(table));
        if (raw && alive) {
          const g = JSON.parse(raw) as Partial<GuestDetails>;
          setGuest({
            localPax: Math.max(0, Number(g.localPax) || 0),
            foreignPax: Math.max(0, Number(g.foreignPax) || 0),
            cusName: String(g.cusName ?? "").slice(0, 100),
            cusPhone: String(g.cusPhone ?? "").slice(0, 30),
            cusCode: String(g.cusCode ?? "").slice(0, 10),
          });
        }
      } catch {
        /* corrupted save — start fresh */
      }
      if (alive) setGuestHydrated(true);
    })();
    return () => {
      alive = false;
    };
  }, [table]);

  useEffect(() => {
    if (!table || !guestHydrated) return;
    try {
      localStorage.setItem(guestStorageKey(table), JSON.stringify(guest));
    } catch {
      /* storage full / private mode — guest details still work in memory */
    }
  }, [table, guest, guestHydrated]);

  const setGuestDetails = useCallback((patch: Partial<GuestDetails>) => {
    setGuest((prev) => ({
      localPax:
        patch.localPax === undefined
          ? prev.localPax
          : Math.max(0, Math.min(50, Math.floor(Number(patch.localPax) || 0))),
      foreignPax:
        patch.foreignPax === undefined
          ? prev.foreignPax
          : Math.max(0, Math.min(50, Math.floor(Number(patch.foreignPax) || 0))),
      cusName:
        patch.cusName === undefined ? prev.cusName : String(patch.cusName).slice(0, 100),
      cusPhone:
        patch.cusPhone === undefined ? prev.cusPhone : String(patch.cusPhone).slice(0, 30),
      cusCode:
        patch.cusCode === undefined ? prev.cusCode : String(patch.cusCode).slice(0, 10),
    }));
  }, []);

  /** Form already filled in → skip it next time.
   *  Dine-in: pax + phone + name · Takeaway: phone + name. */
  const hasGuest =
    guestHydrated &&
    guest.cusName.trim().length > 0 &&
    guest.cusPhone.trim().length >= 9 &&
    (takeaway || guest.localPax + guest.foreignPax >= 1);

  /* ── 1. load the table's current unpaid bill ─────────────── */
  useEffect(() => {
    if (!table) return;
    let alive = true;

    /* Takeaway has no table bill — every confirm is its own TA order. */
    if (takeaway) {
      void Promise.resolve().then(() => {
        if (!alive) return;
        setLines([]);
        setBaseline({});
        setInvoiceNo("");
        writeStore(table, null);
        setHydrated(true);
      });
      return () => {
        alive = false;
      };
    }

    (async () => {
      let serverLines: ExistingLine[] = [];
      let serverInvoice = "";
      try {
        // Guarded endpoint — the table token proves the guest scanned
        // this table's QR (required in production).
        const qs = new URLSearchParams({ table });
        if (token) qs.set("t", token);
        const res = await fetch(`/api/order/existing?${qs.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.ok) {
          serverLines = (json.data?.lines ?? []) as ExistingLine[];
          serverInvoice = String(json.data?.invoiceNo ?? "");
        }
      } catch {
        /* offline / API error → treat as no existing bill */
      }

      if (!alive) return;

      const base: CartStore["baseline"] = {};
      for (const l of serverLines) {
        const key = lineKey(l.itemCode, l.remark);
        const prev = base[key];
        base[key] = {
          qty: (prev?.qty ?? 0) + Number(l.qty || 0),
          name: l.name || l.itemCode,
          price: Number(l.price || 0),
          remark: l.remark ?? "",
        };
      }

      const baseLines: CartLine[] = Object.entries(base).map(([key, v]) => ({
        key,
        itemId: key.split("|")[0],
        name: v.name,
        unitPrice: v.price,
        qty: v.qty,
        remark: v.remark,
      }));

      const saved = readStore(table);
      // A saved cart from a previous (already settled) bill must not survive.
      const usable = saved && (!serverInvoice || !saved.invoiceNo || saved.invoiceNo === serverInvoice);

      const merged: CartLine[] = [];
      const pushers = usable ? [...saved!.lines] : [];
      for (const bl of baseLines) {
        const hit = pushers.find((l) => l.key === bl.key);
        if (hit) hit.qty = Math.max(hit.qty, bl.qty);
        else pushers.push({ ...bl });
      }
      for (const l of pushers) {
        const b = base[l.key]?.qty ?? 0;
        if (l.qty < b) l.qty = b; // POS line grew → trust the POS
        if (l.qty > 0) merged.push(l);
      }

      setBaseline(base);
      setInvoiceNo(serverInvoice || (usable ? saved!.invoiceNo : "") || "");
      setLines(merged);
      setHydrated(true);
    })();

    return () => {
      alive = false;
    };
  }, [table, token, takeaway]);

  /* ── 2. persist on every change ──────────────────────────── */
  useEffect(() => {
    if (!table || !hydrated) return;
    writeStore(table, { lines, baseline, invoiceNo });
  }, [table, lines, baseline, invoiceNo, hydrated]);

  const baselineQtyOf = useCallback((key: string) => baseline[key]?.qty ?? 0, [baseline]);

  /* ── 3. mutations (guarded like the app: baseline is untouchable) ── */
  const add = useCallback(
    (item: MenuItem, remark = "") => {
      const key = lineKey(item.id, remark);
      setLines((prev) => {
        const hit = prev.find((l) => l.key === key);
        if (hit) {
          return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
        }
        const base = baseline[key];
        return [
          ...prev,
          {
            key,
            itemId: item.id,
            name: base?.name || item.name,
            unitPrice: base?.price ?? item.price,
            qty: (base?.qty ?? 0) + 1,
            remark,
          },
        ];
      });
    },
    [baseline]
  );

  const inc = useCallback(
    (key: string) => {
      setLines((prev) => prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l)));
    },
    []
  );

  const dec = useCallback(
    (key: string) => {
      setLines((prev) =>
        prev
          .map((l) =>
            l.key === key && l.qty > baselineQtyOf(key) ? { ...l, qty: l.qty - 1 } : l
          )
          .filter((l) => l.qty > 0)
      );
    },
    [baselineQtyOf]
  );

  /** Remove a whole NEW line (keeps the read-only baseline part). */
  const removeNew = useCallback(
    (key: string) => {
      setLines((prev) => {
        const b = baselineQtyOf(key);
        return prev
          .map((l) => (l.key === key ? { ...l, qty: b } : l))
          .filter((l) => l.qty > 0);
      });
    },
    [baselineQtyOf]
  );

  const setRemark = useCallback((oldKey: string, remark: string) => {
    setLines((prev) => {
      const line = prev.find((l) => l.key === oldKey);
      if (!line) return prev;
      const trimmed = remark.trim().slice(0, 160);
      const newKey = lineKey(line.itemId, trimmed);
      if (newKey === oldKey) {
        return prev.map((l) => (l.key === oldKey ? { ...l, remark: trimmed } : l));
      }
      const existing = prev.find((l) => l.key === newKey && l.key !== oldKey);
      if (existing) {
        // merge into the row that already has this remark
        return prev
          .map((l) => (l.key === newKey ? { ...l, qty: l.qty + line.qty } : l))
          .filter((l) => l.key !== oldKey);
      }
      return prev.map((l) =>
        l.key === oldKey ? { ...l, key: newKey, remark: trimmed } : l
      );
    });
  }, []);

  /** "Clear all" → keep the already-ordered baseline, drop new items. */
  const clearNew = useCallback(() => {
    setLines((prev) => prev.filter((l) => baselineQtyOf(l.key) > 0));
  }, [baselineQtyOf]);

  /* ── 4. derived rows + totals ───────────────────────────── */
  /* ONE row per line — the already-ordered quantity and the newly
     added quantity are merged, so a guest never sees the same dish
     twice ("Pepsi ×1 on bill" + "Pepsi ×2 new" confused everyone).
     `baseQty` keeps the read-only part; the stepper can only move
     the difference above it. */
  const rows = useMemo<CartRow[]>(() => {
    const out: CartRow[] = [];
    for (const l of lines) {
      const base = baselineQtyOf(l.key);
      const added = l.qty - base;
      if (l.qty <= 0) continue;
      out.push({
        rowId: l.key,
        lineKey: l.key,
        itemId: l.itemId,
        name: (base > 0 ? baseline[l.key]?.name : "") || l.name,
        unitPrice: base > 0 ? baseline[l.key]?.price ?? l.unitPrice : l.unitPrice,
        remark: base > 0 ? baseline[l.key]?.remark ?? "" : l.remark,
        qty: l.qty,
        baseQty: base,
        readOnly: base > 0 && added <= 0,
      });
    }
    return out;
  }, [lines, baseline, baselineQtyOf]);

  const existingTotal = useMemo(
    () =>
      Object.values(baseline).reduce((sum, b) => sum + b.qty * (b.price || 0), 0),
    [baseline]
  );

  const newLines = useMemo(
    () =>
      lines
        .map((l) => ({ ...l, qty: l.qty - baselineQtyOf(l.key) }))
        .filter((l) => l.qty > 0),
    [lines, baselineQtyOf]
  );

  const newTotal = useMemo(
    () => newLines.reduce((sum, l) => sum + l.qty * (l.unitPrice || 0), 0),
    [newLines]
  );

  const newCount = useMemo(() => newLines.reduce((s, l) => s + l.qty, 0), [newLines]);

  const unitPriceOf = useCallback(
    (itemId: string, fallback: number) => itemsById.get(itemId)?.price ?? fallback,
    [itemsById]
  );

  /* ── 5. confirm (additive) ──────────────────────────────── */
  const confirm = useCallback(async (): Promise<ConfirmResult | null> => {
    if (inFlightRef.current || confirming) return null;
    setConfirmError(null);
    if (!table) {
      setConfirmError("Table number is missing — please scan the table QR again.");
      return null;
    }
    const payloadItems = newLines.map((l) => ({
      itemId: l.itemId,
      quantity: l.qty,
      remark: l.remark || undefined,
    }));
    if (payloadItems.length === 0) {
      setConfirmError("Add at least one new item before confirming.");
      return null;
    }

    inFlightRef.current = true;
    setConfirming(true);
    try {
      // Guarded endpoint — token check + rate limits + server-side
      // price resolution (same as the /order flow).
      const res = await fetch("/api/order/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNo: table,
          tableGroup: tableGroup || undefined,
          t: token || undefined,
          orderType: takeaway ? "TA" : "DI",
          localPax: takeaway ? undefined : guest.localPax || undefined,
          foreignPax: takeaway ? undefined : guest.foreignPax || undefined,
          customerName: guest.cusName || undefined,
          customerPhone: guest.cusPhone || undefined,
          customerCode: guest.cusCode || undefined,
          items: payloadItems,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Order could not be saved. Please try again.");
      }
      const data = json.data as ConfirmResult & { invoiceNo?: string };
      const result: ConfirmResult = {
        tableNo: data.tableNo ?? table,
        tableGroup: data.tableGroup ?? tableGroup ?? "",
        invoiceNo: data.invoiceNo ?? "",
        itemCount: data.itemCount ?? 0,
        source: data.source ?? "database",
        orderType: data.orderType ?? (takeaway ? "TA" : "DI"),
      };

      if (takeaway) {
        // Takeaway creates a standalone TA serial each time — clear cart
        // & baseline immediately so previous items never linger.
        setLines([]);
        setBaseline({});
        setInvoiceNo("");
        writeStore(table, null);
      } else {
        // Dine-in → confirmed cart becomes the table's read-only baseline.
        const nextBaseline: CartStore["baseline"] = { ...baseline };
        for (const l of lines) {
          nextBaseline[l.key] = {
            qty: l.qty,
            name: l.name,
            price: l.unitPrice,
            remark: l.remark,
          };
        }
        setBaseline(nextBaseline);
        if (result.invoiceNo) setInvoiceNo(result.invoiceNo);
      }
      setLastResult(result);
      return result;
    } catch (e) {
      setConfirmError((e as Error)?.message ?? "Order could not be saved. Please try again.");
      return null;
    } finally {
      inFlightRef.current = false;
      setConfirming(false);
    }
  }, [baseline, confirming, guest, lines, newLines, table, tableGroup, token, takeaway]);

  const resetAll = useCallback(
    (clearGuest = false) => {
      setLines([]);
      setBaseline({});
      setInvoiceNo("");
      setLastResult(null);
      setConfirmError(null);
      writeStore(table, null);
      if (clearGuest) {
        setGuest({
          localPax: 0,
          foreignPax: 0,
          cusName: "",
          cusPhone: "",
          cusCode: "",
        });
        try {
          if (table) localStorage.removeItem(guestStorageKey(table));
        } catch {
          /* ignore storage errors */
        }
      }
    },
    [table]
  );

  return {
    // not hydrated yet (and we do have a table) → the cart is still loading
    loadingBaseline: Boolean(table) && !hydrated,
    hydrated,
    guest,
    guestHydrated,
    hasGuest,
    setGuestDetails,
    invoiceNo,
    rows,
    lines,
    baseline,
    existingTotal,
    newTotal,
    newCount,
    newLines,
    confirming,
    confirmError,
    lastResult,
    add,
    inc,
    dec,
    removeNew,
    setRemark,
    clearNew,
    confirm,
    resetAll,
    unitPriceOf,
  };
}
