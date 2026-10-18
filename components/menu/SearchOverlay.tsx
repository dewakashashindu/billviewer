"use client";

// ============================================================
// LOCATION: components/menu/SearchOverlay.tsx
// Search by dish name, category or sub-category (the app's
// SearchOverlay, redesigned). Results can be added to the cart
// directly.
// ============================================================

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { formatPriceShort, T } from "./theme";
import { AddQtyButton, ItemPhoto } from "./MenuItemCard";
import type { SearchableItem } from "./types";

export default function SearchOverlay({
  items,
  onClose,
  qtyOf,
  onAdd,
  onInc,
  onDec,
  onOpenItem,
}: {
  items: SearchableItem[];
  onClose: () => void;
  qtyOf: (itemId: string) => number;
  onAdd: (itemId: string) => void;
  onInc: (itemId: string) => void;
  onDec: (itemId: string) => void;
  onOpenItem: (itemId: string) => void;
}) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return items
      .filter(
        (i) =>
          i.name.toLowerCase().includes(needle) ||
          i.groupName.toLowerCase().includes(needle) ||
          i.subGroupName.toLowerCase().includes(needle) ||
          i.categoryLabel.toLowerCase().includes(needle)
      )
      .slice(0, 60);
  }, [items, q]);

  return (
    <div style={s.overlay} className="mnu-anim-fade" role="dialog" aria-modal="true">
      <div style={s.barRow} className="mnu-anim-up">
        <div style={s.bar}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.gold} strokeWidth="2.2" aria-hidden>
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M15.5 15.5 21 21" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your favorite..."
            style={s.input}
            autoCorrect="off"
            autoCapitalize="none"
          />
          {q && (
            <button type="button" style={s.clear} onClick={() => setQ("")} aria-label="Clear">
              ✕
            </button>
          )}
        </div>
        <button type="button" style={s.cancel} onClick={onClose}>
          Cancel
        </button>
      </div>

      <div style={s.body} className="mnu-scroll">
        {q.trim().length === 0 ? (
          <div style={s.empty}>
            <span style={s.emptyArt} aria-hidden>🍽️</span>
            <div style={s.emptyTitle}>Find Your Favorite</div>
            <div style={s.emptySub}>Search by dish name, cuisine, or category</div>
          </div>
        ) : results.length === 0 ? (
          <div style={s.empty}>
            <span style={s.emptyArt} aria-hidden>😔</span>
            <div style={s.emptyTitle}>No Results Found</div>
            <div style={s.emptySub}>Try searching with a different keyword</div>
          </div>
        ) : (
          <>
            <div style={s.count}>
              {results.length} result{results.length === 1 ? "" : "s"} for{" "}
              <b style={{ color: T.gold }}>&quot;{q.trim()}&quot;</b>
            </div>
            {results.map((item) => (
              <div key={item.id} style={s.row} className="mnu-anim-up">
                <button type="button" style={s.rowBtn} onClick={() => onOpenItem(item.id)}>
                  <ItemPhoto item={item} size={54} radius={14} />
                  <span style={s.det}>
                    <span style={s.name}>{item.name}</span>
                    <span style={s.meta}>
                      {item.groupName}
                      {item.subGroupName ? ` · ${item.subGroupName}` : ""}
                    </span>
                    <span style={s.price}>{formatPriceShort(item.price)}</span>
                  </span>
                </button>
                <span onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex" }}>
                  <AddQtyButton
                    qty={qtyOf(item.id)}
                    onAdd={() => onAdd(item.id)}
                    onInc={() => onInc(item.id)}
                    onDec={() => onDec(item.id)}
                  />
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 95,
    background: T.bg,
    display: "flex",
    flexDirection: "column",
    padding: "18px 18px 0",
  },
  barRow: { display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" },
  bar: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: T.card,
    border: `1px solid ${T.goldLine}`,
    borderRadius: 15,
    padding: "13px 15px",
    boxShadow: "0 10px 26px rgba(0,0,0,0.35)",
  },
  input: {
    flex: 1,
    background: "none",
    border: "none",
    outline: "none",
    color: T.white,
    fontSize: 14,
    fontFamily: "inherit",
  },
  clear: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.14)",
    border: "none",
    color: T.w55,
    fontSize: 10,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cancel: {
    background: "none",
    border: "none",
    color: T.gold,
    fontSize: 13.5,
    fontWeight: 700,
    cursor: "pointer",
    padding: "8px 2px",
  },
  body: { flex: 1, overflowY: "auto", paddingBottom: 90, maxWidth: 900, width: "100%", margin: "0 auto" },
  count: { color: T.w40, fontSize: 12, padding: "18px 0 12px" },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: T.card,
    borderRadius: 16,
    padding: 11,
    marginBottom: 11,
    border: `1px solid ${T.line}`,
    boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
  },
  rowBtn: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    textAlign: "left",
  },
  det: { display: "flex", flexDirection: "column", gap: 3, minWidth: 0 },
  name: { color: T.white, fontSize: 13.5, fontWeight: 700 },
  meta: { color: T.w40, fontSize: 11 },
  price: { color: T.gold, fontSize: 12, fontWeight: 800 },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 110, gap: 8 },
  emptyArt: {
    width: 96,
    height: 96,
    borderRadius: "50%",
    background: T.card,
    border: `1px solid ${T.line}`,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 42,
    marginBottom: 8,
  },
  emptyTitle: { color: T.white, fontSize: 20, fontWeight: 800 },
  emptySub: { color: "rgba(255,255,255,0.45)", fontSize: 13, textAlign: "center", lineHeight: 1.6 },
};
