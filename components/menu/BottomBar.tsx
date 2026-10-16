"use client";

// ============================================================
// LOCATION: components/menu/BottomBar.tsx
// Mobile floating bar: gold home FAB · search pill · cart FAB.
// (Desktop uses the sidebar + sticky cart panel instead.)
// ============================================================

import type { CSSProperties } from "react";
import { T } from "./theme";

export const HomeGlyph = ({ size = 22, color = T.white }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
    <path d="M12 3.2 2.6 11.4h2.6V20h5v-5.2h3.6V20h5v-8.6h2.6z" />
  </svg>
);

export const SearchGlyph = ({ size = 18, color = "rgba(255,255,255,0.6)" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" aria-hidden>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5 21 21" />
  </svg>
);

export const CartGlyph = ({ size = 24, color = T.white }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9" aria-hidden>
    <path d="M5 8h14l-1.3 9.2a2 2 0 0 1-2 1.8H8.3a2 2 0 0 1-2-1.8z" />
    <path d="M9 8V6.4A3 3 0 0 1 12 3.4a3 3 0 0 1 3 3V8" />
  </svg>
);

export default function BottomBar({
  cartCount,
  onHome,
  onSearch,
  onCart,
  pulse,
}: {
  cartCount: number;
  onHome: () => void;
  onSearch: () => void;
  onCart: () => void;
  pulse?: boolean;
}) {
  return (
    <div style={s.wrap}>
      <button type="button" style={s.fab} onClick={onHome} aria-label="Home">
        <HomeGlyph />
      </button>

      <button type="button" style={s.search} onClick={onSearch}>
        <SearchGlyph />
        <span style={s.searchText}>Search Your Favorite ...</span>
      </button>

      <button
        type="button"
        style={{ ...s.cartFab, ...(pulse ? { transform: "scale(1.08)" } : null) }}
        onClick={onCart}
        aria-label="Cart"
      >
        <CartGlyph />
        {cartCount > 0 && <span style={s.badge}>{cartCount}</span>}
      </button>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  wrap: {
    position: "sticky",
    bottom: 0,
    display: "flex",
    gap: 10,
    alignItems: "center",
    padding: "12px 18px 18px",
    background: "linear-gradient(180deg, rgba(27,27,27,0) 0%, rgba(27,27,27,0.88) 45%, #1B1B1B 100%)",
  },
  fab: {
    width: 54,
    height: 54,
    borderRadius: "50%",
    background: T.gold,
    border: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: T.shadowGold,
    cursor: "pointer",
    flex: "0 0 auto",
  },
  search: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    background: T.card,
    border: `1px solid ${T.line}`,
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "0 16px",
    color: T.w55,
    fontSize: 14,
    cursor: "pointer",
  },
  searchText: { color: T.w55, fontSize: 14 },
  cartFab: {
    width: 54,
    height: 54,
    borderRadius: "50%",
    background: T.card,
    border: `1px solid ${T.line}`,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    flex: "0 0 auto",
    cursor: "pointer",
    transition: "transform .18s ease",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    background: "#FF3B30",
    color: "#fff",
    fontSize: 10.5,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 4px",
  },
};
