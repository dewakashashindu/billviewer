// ============================================================
// LOCATION: components/order/useOrderCart.ts
// The customer cart for the QR ordering flow (strict 1-Hour TTL).
//
// Rules:
//   • Previous order items (baseline), InvoiceNo, and Guest details
//     persist in localStorage ONLY for 1 hour (60 minutes).
//   • At 1 hour (or for legacy entries without savedAt), localStorage
//     is automatically cleared and subsequent orders go out fresh.
// ============================================================
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  lineKey,
  type CartLine,
  type CartRow,
  type ConfirmResult,
  type ExistingLine,
  type MenuItem,
} from "./types";

const ONE_HOUR_MS = 60 * 60 * 1000;

interface CartStore {
  lines: CartLine[];
  baseline: Record<string, { qty: number; name: string; price: number; remark: string }>;
  invoiceNo: string;
  customerName: string;
  customerPhone: string;
  pax: number;
  savedAt: number;
}

export interface GuestDetails {
  name: string;
  phone: string;
  pax: number;
}

interface Options {
  table: string;
  token: string;
  tableGroup?: string;
  itemsById: Map<string, MenuItem>;
}

const storageKey = (table: string) => `ord-cart:v1:${table}`;

function isExpired(savedAt: unknown): boolean {
  const ts = Number(savedAt);
  if (!Number.isFinite(ts) || ts <= 0) return true;
  return Date.now() - ts >= ONE_HOUR_MS;
}

function readStore(table: string): CartStore | null {
  if (!table) return null;
  const key = storageKey(table);
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
      customerName: typeof parsed.customerName === "string" ? parsed.customerName : "",
      customerPhone: typeof parsed.customerPhone === "string" ? parsed.customerPhone : "",
      pax: Number(parsed.pax) || 2,
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

function writeStore(table: string, store: CartStore | null) {
  if (!table) return;
  const key = storageKey(table);
  try {
    if (!store) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(store));
  } catch {
    /* private mode / quota — the cart still works in memory */
  }
}

export function useOrderCart({ table, token, tableGroup, itemsById }: Options) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [baseline, setBaseline] = useState<CartStore["baseline"]>({});
  const [invoiceNo, setInvoiceNo] = useState("");
  const [savedAt, setSavedAt] = useState<number>(0);
  const [guest, setGuest] = useState<GuestDetails>({ name: "", phone: "", pax: 2 });
  const [hydrated, setHydrated] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ConfirmResult | null>(null);
  const inFlight = useRef(false);

  /* ── 1. load the table's current unpaid bill (within last 1 hour) ── */
  useEffect(() => {
    if (!table) return;
    let alive = true;

    (async () => {
      let serverLines: ExistingLine[] = [];
      let serverInvoice = "";
      try {
        const res = await fetch(
          `/api/order/existing?table=${encodeURIComponent(table)}&t=${encodeURIComponent(token)}`,
          { cache: "no-store" }
        );
        const json = await res.json().catch(() => null);
        if (res.ok && json?.ok) {
          serverLines = (json.data?.lines ?? []) as ExistingLine[];
          serverInvoice = String(json.data?.invoiceNo ?? "");
        }
      } catch {
        /* offline → treat as no existing bill */
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

      const saved = readStore(table);
      const usable = Boolean(
        saved && (!serverInvoice || !saved.invoiceNo || saved.invoiceNo === serverInvoice)
      );
      if (saved && !usable) {
        writeStore(table, null);
      }

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
      if (usable && saved) {
        setGuest({
          name: saved.customerName ?? "",
          phone: saved.customerPhone ?? "",
          pax: saved.pax || 2,
        });
      }
      setLines(merged);
      setSavedAt(resolvedSavedAt);
      setHydrated(true);
    })();

    return () => {
      alive = false;
    };
  }, [table, token]);

  /* ── 2. persist with 1-hour timestamp ──────────────────────────── */
  useEffect(() => {
    if (!table || !hydrated) return;
    const isEmpty =
      lines.length === 0 &&
      Object.keys(baseline).length === 0 &&
      !invoiceNo &&
      !guest.name.trim() &&
      !guest.phone.trim();
    if (isEmpty) {
      writeStore(table, null);
      return;
    }
    const ts = savedAt > 0 && !isExpired(savedAt) ? savedAt : Date.now();
    if (ts !== savedAt) setSavedAt(ts);
    writeStore(table, {
      lines,
      baseline,
      invoiceNo,
      customerName: guest.name,
      customerPhone: guest.phone,
      pax: guest.pax,
      savedAt: ts,
    });
  }, [table, lines, baseline, invoiceNo, guest, savedAt, hydrated]);

  const resetAll = useCallback(() => {
    setLines([]);
    setBaseline({});
    setInvoiceNo("");
    setSavedAt(0);
    setGuest({ name: "", phone: "", pax: 2 });
    setLastResult(null);
    writeStore(table, null);
  }, [table]);

  /* ── 2b. Auto-clear localStorage when 1 hour elapses ───────────── */
  useEffect(() => {
    if (savedAt <= 0) return;
    const checkAndExpire = () => {
      if (isExpired(savedAt)) {
        resetAll();
      }
    };
    const remaining = ONE_HOUR_MS - (Date.now() - savedAt);
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
  }, [savedAt, resetAll]);

  const baselineQtyOf = useCallback((key: string) => baseline[key]?.qty ?? 0, [baseline]);

  /* ── 3. mutations ──────────────────────────────────────────────── */
  const add = useCallback(
    (item: MenuItem, remark = "") => {
      setSavedAt((prevTs) => (prevTs > 0 && !isExpired(prevTs) ? prevTs : Date.now()));
      const key = lineKey(item.id, remark);
      setLines((prev) => {
        const hit = prev.find((l) => l.key === key);
        if (hit) return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
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

  const removeNew = useCallback(
    (key: string) => {
      setLines((prev) => {
        const b = baselineQtyOf(key);
        return prev.map((l) => (l.key === key ? { ...l, qty: b } : l)).filter((l) => l.qty > 0);
      });
    },
    [baselineQtyOf]
  );

  const incItem = useCallback((itemId: string) => {
    setLines((prev) => {
      let idx = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].itemId === itemId) {
          idx = i;
          break;
        }
      }
      if (idx === -1) return prev;
      return prev.map((l, i) => (i === idx ? { ...l, qty: l.qty + 1 } : l));
    });
  }, []);

  const decItem = useCallback(
    (itemId: string) => {
      setLines((prev) => {
        let idx = -1;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].itemId === itemId) {
            idx = i;
            break;
          }
        }
        if (idx === -1) return prev;
        const target = prev[idx];
        if (target.qty <= baselineQtyOf(target.key)) return prev;
        return prev
          .map((l, i) => (i === idx ? { ...l, qty: l.qty - 1 } : l))
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

  const clearNew = useCallback(() => {
    setLines((prev) => prev.filter((l) => baselineQtyOf(l.key) > 0));
  }, [baselineQtyOf]);

  const setGuestDetails = useCallback((patch: Partial<GuestDetails>) => {
    setGuest((prev) => ({ ...prev, ...patch }));
  }, []);

  /* ── 4. derived rows + totals ──────────────────────────────────── */
  const rows = useMemo<CartRow[]>(() => {
    const out: CartRow[] = [];
    for (const l of lines) {
      const base = baselineQtyOf(l.key);
      if (base > 0) {
        out.push({
          rowId: `${l.key}|existing`,
          lineKey: l.key,
          itemId: l.itemId,
          name: baseline[l.key]?.name || l.name,
          unitPrice: baseline[l.key]?.price ?? l.unitPrice,
          remark: baseline[l.key]?.remark ?? "",
          qty: base,
          readOnly: true,
        });
      }
      const added = l.qty - base;
      if (added > 0) {
        out.push({
          rowId: `${l.key}|new`,
          lineKey: l.key,
          itemId: l.itemId,
          name: l.name,
          unitPrice: l.unitPrice,
          remark: l.remark,
          qty: added,
          readOnly: false,
        });
      }
    }
    return out;
  }, [lines, baseline, baselineQtyOf]);

  const existingTotal = useMemo(
    () => Object.values(baseline).reduce((sum, b) => sum + b.qty * (b.price || 0), 0),
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
  const grandTotal = Math.round((existingTotal + newTotal) * 100) / 100;

  const qtyOf = useCallback(
    (itemId: string) =>
      lines
        .filter((l) => l.itemId === itemId)
        .reduce((s, l) => s + Math.max(0, l.qty - baselineQtyOf(l.key)), 0),
    [lines, baselineQtyOf]
  );

  const unitPriceOf = useCallback(
    (itemId: string, fallback: number) => itemsById.get(itemId)?.price ?? fallback,
    [itemsById]
  );

  /* ── 5. confirm ────────────────────────────────────────────────── */
  const confirm = useCallback(async (): Promise<ConfirmResult | null> => {
    if (inFlight.current || confirming) return null;
    setConfirmError(null);

    if (!table) {
      setConfirmError("Table number is missing — please scan the table QR again.");
      return null;
    }
    if (newLines.length === 0) {
      setConfirmError("Add at least one item before placing the order.");
      return null;
    }

    const sessionExpired = savedAt > 0 && isExpired(savedAt);
    const activeInvoiceNo = sessionExpired ? "" : invoiceNo;
    const activeBaseline = sessionExpired ? {} : baseline;

    const payloadItems = newLines.map((l) => ({
      itemId: l.itemId,
      quantity: l.qty,
      remark: l.remark || undefined,
    }));

    inFlight.current = true;
    setConfirming(true);
    try {
      const res = await fetch("/api/order/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNo: table,
          tableGroup: tableGroup || undefined,
          existingInvoiceNo: activeInvoiceNo || undefined,
          t: token || undefined,
          pax: guest.pax || undefined,
          customerName: guest.name || undefined,
          customerPhone: guest.phone || undefined,
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
      };

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
      if (sessionExpired) setLines(updatedLines);
      setBaseline(nextBaseline);
      setSavedAt(nextSavedAt);
      if (result.invoiceNo) setInvoiceNo(result.invoiceNo);
      setLastResult(result);
      return result;
    } catch (e) {
      setConfirmError((e as Error)?.message ?? "Order could not be saved. Please try again.");
      return null;
    } finally {
      inFlight.current = false;
      setConfirming(false);
    }
  }, [baseline, confirming, guest, invoiceNo, lines, newLines, savedAt, table, tableGroup, token]);

  return {
    loadingBaseline: Boolean(table) && !hydrated,
    hydrated,
    invoiceNo,
    rows,
    lines,
    baseline,
    guest,
    existingTotal,
    newTotal,
    newCount,
    newLines,
    grandTotal,
    confirming,
    confirmError,
    lastResult,
    add,
    inc,
    dec,
    incItem,
    decItem,
    removeNew,
    setRemark,
    clearNew,
    setGuestDetails,
    confirm,
    resetAll,
    qtyOf,
    unitPriceOf,
  };
}
