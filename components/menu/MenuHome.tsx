"use client";

// ============================================================
// LOCATION: components/menu/MenuHome.tsx
// Step 2 — promo carousel + category tabs + Level-1 group cards
// (the app's menu_cato "home" screen). Works on mobile and desktop;
// the parent decides the grid width.
// ============================================================

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { categoryLabel, T } from "./theme";
import { groupCircleImage } from "./groupImages";
import type { GroupCard, MenuTab } from "./types";

export interface Promo {
  id: string;
  title: string;
  accent: string;
  subtitle: string;
  note: string;
  emoji: string;
  link?: string;
}

export const PROMOS: Promo[] = [
  {
    id: "1",
    title: "Enjoy",
    accent: "20% OFF",
    subtitle: "on your favourite dishes every Wednesday!",
    note: "(T&C Apply)",
    emoji: "🍛",
  },
  {
    id: "2",
    title: "Get",
    accent: "15% OFF",
    subtitle: "on all rice & noodle bowls today!",
    note: "(T&C Apply)",
    emoji: "🍜",
  },
  {
    id: "3",
    title: "THE BITE,",
    accent: "DOUBLE",
    subtitle: "Buy any Signature Large platter, get one FREE!",
    note: "",
    emoji: "🦐",
  },
];

function PromoCarousel({ compact = false }: { compact?: boolean }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % PROMOS.length), 4000);
    return () => clearInterval(t);
  }, []);

  const promo = PROMOS[i];
  return (
    <div style={{ marginBottom: 16 }}>
      <div key={promo.id} className="mnu-anim-fade" style={{ ...s.promo, height: compact ? 148 : 172 }}>
        <div style={s.promoText}>
          <div style={s.promoTitle}>{promo.title}</div>
          <div style={s.promoAccent}>{promo.accent}</div>
          <div style={s.promoSub}>{promo.subtitle}</div>
          {promo.note ? <div style={s.promoNote}>{promo.note}</div> : null}
        </div>
        <div style={s.promoArt} aria-hidden>
          {promo.emoji}
        </div>
      </div>
      <div style={s.dots}>
        {PROMOS.map((p, idx) => (
          <button
            key={p.id}
            type="button"
            aria-label={`Promo ${idx + 1}`}
            onClick={() => setI(idx)}
            style={{ ...s.dot, ...(idx === i ? s.dotOn : null) }}
          />
        ))}
      </div>
    </div>
  );
}

export default function MenuHome({
  tabs,
  groups,
  activeTab,
  onTab,
  onOpenGroup,
  alreadyOrderedByItem,
  desktop = false,
}: {
  tabs: MenuTab[];
  groups: GroupCard[];
  activeTab: string;
  onTab: (key: string) => void;
  onOpenGroup: (group: GroupCard) => void;
  alreadyOrderedByItem: Map<string, number>;
  desktop?: boolean;
}) {
  const visible = useMemo(
    // compare against the SAME derived label the tab keys use
    () => groups.filter((g) => !activeTab || categoryLabel(g.categoryId) === activeTab),
    [groups, activeTab]
  );

  return (
    <div>
      {!desktop && <PromoCarousel />}

      <div style={s.tabRow} className="mnu-scroll">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTab(tab.key)}
            style={{ ...s.tab, ...(tab.key === activeTab ? s.tabOn : null) }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Desktop gets a slim promo strip too, so the page isn't bare */}
      {desktop && <PromoCarousel compact />}

      <div style={{ ...s.grid, gridTemplateColumns: desktop ? "repeat(3, 1fr)" : "repeat(2, minmax(0,1fr))" }}>
        {visible.map((g) => {
          const ordered = [...g.items, ...g.subGroups.flatMap((sg) => sg.items)].reduce(
            (sum, it) => sum + (alreadyOrderedByItem.get(it.id) ?? 0),
            0
          );
          return (
            <button key={g.key} type="button" onClick={() => onOpenGroup(g)} style={s.cardWrap}>
              <span className="mnu-anim-pop" style={{ ...s.cardInner, height: desktop ? 132 : 122 }}>
                <span style={s.cardName}>{g.name}</span>
                <span style={s.cardCount}>
                  {g.count} <small style={s.cardCountSmall}>Items</small>
                </span>
                {ordered > 0 && <span style={s.cardBadge}>{ordered} in cart</span>}
              </span>
              <span style={s.cardCircle} aria-hidden>
                {/* POS photo first, else the local /public/menu-groups photo */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={groupCircleImage(g.imageUrl, g.name)}
                  alt=""
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  promo: {
    margin: "0 0 14px",
    borderRadius: 20,
    background: T.surface,
    border: `1px solid ${T.line}`,
    display: "flex",
    overflow: "hidden",
  },
  promoText: { flex: 1, padding: 18, display: "flex", flexDirection: "column", justifyContent: "center" },
  promoTitle: { color: T.white, fontSize: 16, fontWeight: 500 },
  promoAccent: { color: T.gold, fontSize: 29, fontWeight: 700, lineHeight: 1.15, marginTop: 2 },
  promoSub: { color: "rgba(255,255,255,0.85)", fontSize: 11.5, lineHeight: 1.45, marginTop: 8 },
  promoNote: { color: T.w55, fontSize: 10, marginTop: 12, alignSelf: "flex-end" },
  promoArt: {
    width: 140,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 58,
    background: "linear-gradient(160deg,#4a3a22 0%,#3a2a19 100%)",
  },
  dots: { display: "flex", gap: 6, justifyContent: "center", marginBottom: 16 },
  dot: { width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.25)", border: "none", padding: 0, cursor: "pointer" },
  dotOn: { width: 18, borderRadius: 3, background: T.gold },
  tabRow: { display: "flex", gap: 10, paddingBottom: 16, overflowX: "auto" },
  tab: {
    padding: "8px 18px",
    borderRadius: 20,
    // longhands (not the `border` shorthand) so tabOn can safely
    // override just the colour — mixing them makes React warn
    borderWidth: 1.5,
    borderStyle: "solid",
    borderColor: "rgba(255,255,255,0.45)",
    background: "transparent",
    color: T.w72,
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: "nowrap",
    cursor: "pointer",
  },
  tabOn: { background: T.gold, borderColor: T.gold, color: T.white },
  grid: { display: "grid", gap: 14, paddingBottom: 8 },
  cardWrap: {
    position: "relative",
    height: 148,
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    textAlign: "left",
  },
  cardInner: {
    background: T.card,
    borderRadius: 18,
    padding: "15px 52px 15px 15px", // circle sits bottom-right
    display: "flex",
    flexDirection: "column",
    border: `1px solid ${T.line}`,
  },
  cardName: { color: T.white, fontSize: 16, fontWeight: 700, letterSpacing: 0.2 },
  cardCount: { marginTop: 5, color: T.gold90, fontSize: 13, fontWeight: 600 },
  cardCountSmall: { fontWeight: 400, opacity: 0.75, fontSize: 11.5 },
  cardBadge: {
    marginTop: "auto",
    alignSelf: "flex-start",
    fontSize: 9.5,
    fontWeight: 700,
    color: T.w55,
    background: "rgba(255,255,255,0.08)",
    padding: "3px 7px",
    borderRadius: 7,
  },
  cardCircle: {
    position: "absolute",
    right: 0,
    bottom: 4,
    width: 86,
    height: 86,
    borderRadius: "50%",
    background: "radial-gradient(circle at 32% 28%, #6b5230, #33261a)",
    border: `1px solid ${T.goldLine}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 34,
    overflow: "hidden",
  },
};
