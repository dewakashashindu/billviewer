"use client";

// ============================================================
// LOCATION: components/menu/BottomBar.tsx
// Mobile floating bar: a glass pill holding the search field and the
// cart FAB. (Desktop uses the sidebar + sticky cart panel instead.)
// The home FAB was removed — guests move with the header logo and the
// "‹" back control, so no button is needed here.
// ============================================================

import type { CSSProperties } from "react";
import { T } from "./theme";

export const SearchGlyph = ({ size = 18, color = "rgba(255,255,255,0.6)" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" aria-hidden>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5 21 21" />
  </svg>
);

export const CartGlyph = ({ size = 24, color = T.white }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9" aria-hidden>
    <path d="M5 8h14l-1.3 9.2a2 2 0 0 1-2 1.8H8.3a2 2 0 0 1-2-1.8z" />
    <path d="M9 8V6.4A3 3 0 0 1 12 3.4a3 3 0 0 1 3 3V8" />
  </svg>
);

export default function BottomBar({
  cartCount,
  onSearch,
  onCart,
  pulse,
}: {
  cartCount: number;
  onSearch: () => void;
  onCart: () => void;
  pulse?: boolean;
}) {
  return (
    <div style={s.wrap} className="mnu-safe-bottom">
      <div style={s.bar} className="mnu-glass">
        <button type="button" style={s.search} className="mnu-tap-soft" onClick={onSearch}>
          <SearchGlyph />
          <span style={s.searchText}>Search your favorite…</span>
        </button>

        <button
          type="button"
          style={{
            ...s.cartFab,
            ...(cartCount > 0 ? s.cartFabOn : null),
            ...(pulse ? { transform: "scale(1.1)" } : null),
          }}
          className="mnu-tap"
          onClick={onCart}
          aria-label="Cart"
        >
          <CartGlyph color={cartCount > 0 ? T.goldInk : T.w72} />
          {cartCount > 0 && <span style={s.badge}>{cartCount}</span>}
        </button>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  wrap: {
    position: "sticky",
    bottom: 0,
    zIndex: 40,
    padding: "10px 14px 14px",
    background: "linear-gradient(180deg, rgba(33,27,21,0) 0%, rgba(33,27,21,0.9) 55%, #14100D 100%)",
  },
  bar: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    padding: 8,
    borderRadius: 27,
    border: `1px solid ${T.line}`,
    boxShadow: "0 14px 34px rgba(0,0,0,0.5)",
  },
  search: {
    flex: 1,
    minWidth: 0,
    height: 48,
    borderRadius: 24,
    background: "rgba(255,255,255,0.05)",
    border: `1px solid ${T.line}`,
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "0 16px",
    cursor: "pointer",
    overflow: "hidden",
  },
  searchText: {
    color: T.w40,
    fontSize: 13.5,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  cartFab: {
    width: 48,
    height: 48,
    borderRadius: "50%",
    background: T.card,
    border: `1px solid ${T.line}`,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    flex: "0 0 auto",
    cursor: "pointer",
    transition: "transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease",
  },
  cartFabOn: {
    background: T.goldGrad,
    border: "1px solid rgba(255,255,255,0.22)",
    boxShadow: T.shadowGold,
  },
  badge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    background: "#E5484D",
    border: "2px solid #14100D",
    color: "#fff",
    fontSize: 10,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 4px",
  },
};
