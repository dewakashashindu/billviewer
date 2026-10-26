"use client";

// ============================================================
// LOCATION: components/menu/useCustomerCart.ts
//
// Customer QR Cart with strict 1-Hour (60-minute) TTL:
//   • Previous order items ("Already on bill" baseline), active
//     InvoiceNo, and Guest details remain in localStorage ONLY for
//     1 hour (ONE_HOUR_MS = 60 * 60 * 1000).
//   • Within 1 hour: confirmed lines stay READ-ONLY (baseline) even
//     after POS imports and deletes Tbl_HoldUpsCloudTempQR (~1 min),
//     and newly added lines append to the same InvoiceNo.
//   • At 1 hour (or for legacy entries without a savedAt timestamp):
//     localStorage is automatically cleared and any subsequent order
//     starts completely fresh with a new InvoiceNo.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lineKey, type CartLine, type ConfirmResult, type ExistingLine, type MenuItem } from "./types";

/** Previous order / localStorage retention window: strictly 1 hour. */
const ONE_HOUR_MS = 60 * 60 * 1000;

interface CartStore {
  lines: CartLine[];
  baseline: Record<string, { qty: number; name: string; price: number; remark: string }>;
  invoiceNo: string;
  savedAt: number;
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
  /** Local guests (Tbl_HoldUpsCloudTempQR.LPax) — not used for takeaway. */
  localPax: number;
  /** Foreign guests (Tbl_HoldUpsCloudTempQR.FPax) — not used for takeaway. */
  foreignPax: number;
  /** Customer name (Tbl_HoldUpsCloudTempQR.CusName) — mandatory. */
  cusName: string;
  /** Customer phone (lookup key) — mandatory. */
  cusPhone: string;
  /** Tbl_CustomerMaster.CusCode when the phone is a known customer. */
  cusCode: string;
}

interface GuestStore extends GuestDetails {
  savedAt: number;
}

const EMPTY_GUEST: GuestDetails = {
  localPax: 0,
  foreignPax: 0,
  cusName: "",
  cusPhone: "",
  cusCode: "",
};

const guestStorageKey = (table: string, locCode = "") =>
  locCode ? `mnu-guest:v2:${locCode}:${table}` : `mnu-guest:v2:${table}`;

const storageKey = (table: string, locCode = "") =>
  locCode ? `mnu-cart:v1:${locCode}:${table}` : `mnu-cart:v1:${table}`;

function isExpired(savedAt: unknown): boolean {
  const ts = Number(savedAt);
  if (!Number.isFinite(ts) || ts <= 0) return true;
  return Date.now() - ts >= ONE_HOUR_MS;
}

/** Sweep all QR cart/guest keys in localStorage and delete any expired or legacy entries. */
function purgeExpiredMenuStorage() {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (
        k.startsWith("mnu-cart:") ||
        k.startsWith("mnu-guest:") ||
        k.startsWith("ord-cart:")
      ) {
        const raw = localStorage.getItem(k);
        if (!raw) {
          keysToRemove.push(k);
          continue;
        }
        try {
          const parsed = JSON.parse(raw) as { savedAt?: unknown } | null;
          if (!parsed || typeof parsed !== "object" || isExpired(parsed.savedAt)) {
            keysToRemove.push(k);
          }
        } catch {
          keysToRemove.push(k);
        }
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch {
    /* private mode / SSR */
  }
}

function readStore(table: string, locCode = ""): CartStore | null {
  if (!table) return null;
  const key = storageKey(table, locCode);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CartStore> | null;
    if (!parsed || !Array.isArray(parsed.lines) || isExpired(parsed.savedAt)) {
      localStorage.removeItem(key);
      return null;
    }
    return {
      lines: parsed.lines,
      baseline:
        parsed.baseline && typeof parsed.baseline === "object" ? parsed.baseline : {},
      invoiceNo: typeof parsed.invoiceNo === "string" ? parsed.invoiceNo : "",
      savedAt: Number(parsed.savedAt),
    };
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    return null;
  }
}

function writeStore(table: string, store: CartStore | null, locCode = "") {
  if (!table) return;
  const key = storageKey(table, locCode);
  try {
    if (!store) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(store));
  } catch {
    /* storage full / private mode — cart still works in memory */
  }
}

function readGuestStore(table: string, locCode = ""): GuestStore | null {
  if (!table) return null;
  const key = guestStorageKey(table, locCode);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GuestStore> | null;
    if (!parsed || typeof parsed !== "object" || isExpired(parsed.savedAt)) {
      localStorage.removeItem(key);
      return null;
    }
    return {
      localPax: Math.max(0, Number(parsed.localPax) || 0),
      foreignPax: Math.max(0, Number(parsed.foreignPax) || 0),
      cusName: String(parsed.cusName ?? "").slice(0, 100),
      cusPhone: String(parsed.cusPhone ?? "").slice(0, 30),
      cusCode: String(parsed.cusCode ?? "").slice(0, 10),
      savedAt: Number(parsed.savedAt),
    };
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    return null;
  }
}

function writeGuestStore(table: string, store: GuestStore | null, locCode = "") {
  if (!table) return;
  const key = guestStorageKey(table, locCode);
  try {
    if (!store) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(store));
  } catch {
    /* storage full / private mode */
  }
}

interface Options {
  table: string;
  tableGroup?: string;
  /** Location code from the scanned QR (Tbl_LocationMaster.LocCode). */
  locCode?: string;
  /** Signed table token from the QR (?t=…) — required by the
   *  guarded /api/order/* endpoints in production. */
  token?: string;
  itemsById: Map<string, MenuItem>;
  /** Takeaway QR — no pax, orders are saved with OrderType TA. */
  takeaway?: boolean;
}

export function useCustomerCart({
  table,
  tableGroup,
  locCode = "",
  token,
  itemsById,
  takeaway = false,
}: Options) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [baseline, setBaseline] = useState<CartStore["baseline"]>({});
  const [invoiceNo, setInvoiceNo] = useState("");
  const [takeawayNo, setTakeawayNo] = useState("");
  const [savedAt, setSavedAt] = useState<number>(0);
  // storage must not be written until the saved cart + the table's current
  // bill have been read, otherwise the first render wipes the saved cart.
  const [hydrated, setHydrated] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ConfirmResult | null>(null);
  const inFlightRef = useRef(false);

  /* ── 0. guest details (pax + customer name), persisted for 1 hour ── */
  const [guest, setGuest] = useState<GuestDetails>(EMPTY_GUEST);
  const [guestSavedAt, setGuestSavedAt] = useState<number>(0);
  const [guestHydrated, setGuestHydrated] = useState(false);

  useEffect(() => {
    if (!table) return;
    let alive = true;
    purgeExpiredMenuStorage();
    const g = takeaway ? null : readGuestStore(table, locCode);
    if (alive) {
      if (g) {
        setGuest({
          localPax: g.localPax,
          foreignPax: g.foreignPax,
          cusName: g.cusName,
          cusPhone: g.cusPhone,
          cusCode: g.cusCode,
        });
        setGuestSavedAt(g.savedAt);
      } else {
        setGuest(EMPTY_GUEST);
        setGuestSavedAt(0);
      }
      setGuestHydrated(true);
    }
    return () => {
      alive = false;
    };
  }, [table, locCode, takeaway]);

  useEffect(() => {
    if (!table || !guestHydrated || takeaway) return;
    const isEmpty =
      !guest.cusName.trim() &&
      !guest.cusPhone.trim() &&
      guest.localPax === 0 &&
      guest.foreignPax === 0;
    if (isEmpty) {
      writeGuestStore(table, null, locCode);
      return;
    }
    const ts = guestSavedAt > 0 && !isExpired(guestSavedAt) ? guestSavedAt : Date.now();
    if (ts !== guestSavedAt) setGuestSavedAt(ts);
    writeGuestStore(table, { ...guest, savedAt: ts }, locCode);
  }, [table, locCode, guest, guestSavedAt, guestHydrated, takeaway]);

  const setGuestDetails = useCallback((patch: Partial<GuestDetails>) => {
    setGuestSavedAt((prevTs) => (prevTs > 0 && !isExpired(prevTs) ? prevTs : Date.now()));
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

  /** Form already filled in (and within 1h) → skip it next time. */
  const hasGuest =
    guestHydrated &&
    guest.cusName.trim().length > 0 &&
    guest.cusPhone.trim().length >= 9 &&
    (takeaway || guest.localPax + guest.foreignPax >= 1);

  /* ── 1. load the table's current unpaid bill (within last 1 hour) ── */
  useEffect(() => {
    if (!table) return;
    let alive = true;

    purgeExpiredMenuStorage();

    /* Takeaway has no table bill — every session starts clean. */
    if (takeaway) {
      void Promise.resolve().then(() => {
        if (!alive) return;
        setLines([]);
        setBaseline({});
        setInvoiceNo("");
        setTakeawayNo("");
        setSavedAt(0);
        writeStore(table, null, locCode);
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
        const qs = new URLSearchParams({ table });
        if (locCode) qs.set("loc", locCode);
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
        /* offline / API error → treat as no existing server bill */
      }

      if (!alive) return;

      const serverBase: CartStore["baseline"] = {};
      for (const l of serverLines) {
        const key = lineKey(l.itemCode, l.remark);
        const prev = serverBase[key];
        serverBase[key] = {
          qty: (prev?.qty ?? 0) + Number(l.qty || 0),
          name: l.name || l.itemCode,
          price: Number(l.price || 0),
          remark: l.remark ?? "",
        };
      }

      const saved = readStore(table, locCode); // returns null & clears if >= 1 hour old
      const usable = Boolean(
        saved && (!serverInvoice || !saved.invoiceNo || saved.invoiceNo === serverInvoice)
      );
      if (saved && !usable) {
        // Server has a different active invoice for this table -> drop local store
        writeStore(table, null, locCode);
      }

      // Preserve confirmed baseline from localStorage within the 1-hour window
      // (because POS imports and deletes Tbl_HoldUpsCloudTempQR within ~1 minute).
      const mergedBase: CartStore["baseline"] = usable && saved ? { ...saved.baseline } : {};
      for (const [key, sb] of Object.entries(serverBase)) {
        const existing = mergedBase[key];
        if (!existing || sb.qty > existing.qty) {
          mergedBase[key] = { ...sb };
        }
      }

      const baseLines: CartLine[] = Object.entries(mergedBase).map(([key, v]) => ({
        key,
        itemId: key.split("|")[0],
        name: v.name,
        unitPrice: v.price,
        qty: v.qty,
        remark: v.remark,
      }));

      const pushers = usable && saved ? saved.lines.map((l) => ({ ...l })) : [];
      for (const bl of baseLines) {
        const hit = pushers.find((l) => l.key === bl.key);
        if (hit) hit.qty = Math.max(hit.qty, bl.qty);
        else pushers.push({ ...bl });
      }
      const merged: CartLine[] = [];
      for (const l of pushers) {
        const b = mergedBase[l.key]?.qty ?? 0;
        if (l.qty < b) l.qty = b;
        if (l.qty > 0) merged.push(l);
      }

      const resolvedInvoice =
        serverInvoice || (usable && saved ? saved.invoiceNo : "") || "";
      const hasAnyData =
        merged.length > 0 || Object.keys(mergedBase).length > 0 || Boolean(resolvedInvoice);
      const resolvedSavedAt =
        usable && saved?.savedAt
          ? saved.savedAt
          : hasAnyData
            ? Date.now()
            : 0;

      setBaseline(mergedBase);
      setInvoiceNo(resolvedInvoice);
      setLines(merged);
      setSavedAt(resolvedSavedAt);
      setHydrated(true);
    })();

    return () => {
      alive = false;
    };
  }, [table, locCode, token, takeaway]);

  /* ── 2. persist on every change (dine-in only, with 1-hour timestamp) ── */
  useEffect(() => {
    if (!table || !hydrated || takeaway) return;
    const isEmpty =
      lines.length === 0 && Object.keys(baseline).length === 0 && !invoiceNo;
    if (isEmpty) {
      writeStore(table, null, locCode);
      return;
    }
    const ts = savedAt > 0 && !isExpired(savedAt) ? savedAt : Date.now();
    if (ts !== savedAt) setSavedAt(ts);
    writeStore(table, { lines, baseline, invoiceNo, savedAt: ts }, locCode);
  }, [table, locCode, lines, baseline, invoiceNo, savedAt, hydrated, takeaway]);

  const resetAll = useCallback(
    (clearGuest = false) => {
      setLines([]);
      setBaseline({});
      setInvoiceNo("");
      setTakeawayNo("");
      setSavedAt(0);
      setLastResult(null);
      setConfirmError(null);
      writeStore(table, null, locCode);
      if (clearGuest) {
        setGuest(EMPTY_GUEST);
        setGuestSavedAt(0);
        writeGuestStore(table, null, locCode);
      }
    },
    [table, locCode]
  );

  /* ── 2b. Auto-clear localStorage & memory when 1 hour elapses ── */
  useEffect(() => {
    const timestamps = [savedAt, guestSavedAt].filter((t) => t > 0);
    if (timestamps.length === 0) return;

    const earliest = Math.min(...timestamps);
    const checkAndExpire = () => {
      purgeExpiredMenuStorage();
      if (savedAt > 0 && isExpired(savedAt)) {
        resetAll(true);
        return;
      }
      if (guestSavedAt > 0 && isExpired(guestSavedAt)) {
        setGuest(EMPTY_GUEST);
        setGuestSavedAt(0);
        writeGuestStore(table, null, locCode);
      }
    };

    const remaining = ONE_HOUR_MS - (Date.now() - earliest);
    if (remaining <= 0) {
      checkAndExpire();
      return;
    }

    const timer = window.setTimeout(checkAndExpire, remaining + 50);
    const onVisible = () => {
      if (document.visibilityState === "visible") checkAndExpire();
    };
    window.addEventListener("focus", checkAndExpire);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", checkAndExpire);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [savedAt, guestSavedAt, resetAll, table, locCode]);

  const baselineQtyOf = useCallback((key: string) => baseline[key]?.qty ?? 0, [baseline]);

  /* ── 3. mutations (guarded: baseline is untouchable within 1h) ── */
  const add = useCallback(
    (item: MenuItem, remark = "") => {
      setSavedAt((prevTs) => (prevTs > 0 && !isExpired(prevTs) ? prevTs : Date.now()));
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

  const inc = useCallback((key: string) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l)));
  }, []);

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

  /* ── 5. confirm (additive within 1h; fresh after 1h) ─────── */
  const confirm = useCallback(async (): Promise<ConfirmResult | null> => {
    if (inFlightRef.current || confirming) return null;
    setConfirmError(null);
    if (!table) {
      setConfirmError("Table number is missing — please scan the table QR again.");
      return null;
    }

    // If the 1-hour window expired right before Confirm was tapped,
    // drop the old baseline/invoice and send ONLY newLines as a fresh order.
    const sessionExpired = savedAt > 0 && isExpired(savedAt);
    const activeInvoiceNo = sessionExpired ? "" : invoiceNo;
    const activeTakeawayNo = sessionExpired ? "" : takeawayNo;
    const activeBaseline = sessionExpired ? {} : baseline;

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
      const res = await fetch("/api/order/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNo: table,
          tableGroup: tableGroup || undefined,
          locCode: locCode || undefined,
          existingInvoiceNo: activeInvoiceNo || undefined,
          existingTakeawayNo: takeaway && activeTakeawayNo ? activeTakeawayNo : undefined,
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
      const data = json.data as ConfirmResult & {
        invoiceNo?: string;
        orderNo?: string;
        locCode?: string;
      };
      const result: ConfirmResult = {
        tableNo: data.tableNo ?? (takeaway && activeTakeawayNo ? activeTakeawayNo : table),
        tableGroup: data.tableGroup ?? tableGroup ?? "",
        invoiceNo: data.invoiceNo ?? "",
        orderNo: data.orderNo ?? "",
        locCode: data.locCode ?? locCode,
        itemCount: data.itemCount ?? 0,
        source: data.source ?? "database",
        orderType: data.orderType ?? (takeaway ? "TA" : "DI"),
      };

      // Anchor the 1-hour expiry timer when a new invoice starts;
      // preserve the anchor when adding items to the same invoice within 1h.
      const now = Date.now();
      const nextSavedAt =
        !activeInvoiceNo || sessionExpired
          ? now
          : savedAt > 0 && !isExpired(savedAt)
            ? savedAt
            : now;

      const updatedLines = sessionExpired ? [...newLines] : lines;
      const nextBaseline: CartStore["baseline"] = { ...activeBaseline };
      for (const l of updatedLines) {
        nextBaseline[l.key] = {
          qty: l.qty,
          name: l.name,
          price: l.unitPrice,
          remark: l.remark,
        };
      }

      if (sessionExpired) {
        setLines(updatedLines);
      }
      setBaseline(nextBaseline);
      setSavedAt(nextSavedAt);
      setGuestSavedAt(nextSavedAt);
      if (result.invoiceNo) setInvoiceNo(result.invoiceNo);
      if (takeaway && result.tableNo) setTakeawayNo(result.tableNo);
      setLastResult(result);
      return result;
    } catch (e) {
      setConfirmError((e as Error)?.message ?? "Order could not be saved. Please try again.");
      return null;
    } finally {
      inFlightRef.current = false;
      setConfirming(false);
    }
  }, [
    baseline,
    confirming,
    guest,
    invoiceNo,
    lines,
    locCode,
    newLines,
    savedAt,
    table,
    tableGroup,
    takeaway,
    takeawayNo,
    token,
  ]);

  return {
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
