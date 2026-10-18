"use client";

// ============================================================
// LOCATION: components/menu/MenuHome.tsx
// Step 2 — promo hero carousel + category tab pills + photo-top
// Level-1 group cards (redesigned home screen).
// Works on mobile and desktop; the parent decides the grid width.
// ============================================================

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { categoryLabel, itemEmoji, T } from "./theme";
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

/** Photo with a graceful emoji fallback if the image 404s. */
function GroupPhoto({ src, name, style }: { src: string; name: string; style: CSSProperties }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return (
      <div style={{ ...style, ...s.photoFallback }} aria-hidden>
        <span style={{ fontSize: 40 }}>{itemEmoji(name)}</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ ...style, ...s.photoImg }}
    />
  );
}

function PromoCarousel({ compact = false }: { compact?: boolean }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % PROMOS.length), 4000);
    return () => clearInterval(t);
  }, []);

  const promo = PROMOS[i];
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        key={promo.id}
        className="mnu-anim-fade"
        style={{ ...s.promo, height: compact ? 132 : 168 }}
      >
        {/* decorative glow blobs */}
        <span style={s.promoGlowA} aria-hidden />
        <span style={s.promoGlowB} aria-hidden />
        <div style={s.promoText}>
          <span style={s.promoKicker}>LIMITED TIME</span>
          <div style={s.promoTitleRow}>
            <span style={s.promoTitle}>{promo.title}</span>
            <span style={s.promoAccent}>{promo.accent}</span>
          </div>
          <div style={s.promoSub}>{promo.subtitle}</div>
          {promo.note ? <div style={s.promoNote}>{promo.note}</div> : null}
        </div>
        <div style={s.promoArt} aria-hidden>
          <span style={s.promoArtCircle}>{promo.emoji}</span>
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
    <div className="mnu-anim-up">
      {!desktop && <PromoCarousel />}

      {/* category pills with counts */}
      <div style={s.tabRow} className="mnu-scroll mnu-no-bar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTab(tab.key)}
            className="mnu-tap"
            style={{ ...s.tab, ...(tab.key === activeTab ? s.tabOn : null) }}
          >
            {tab.label}
            <span style={{ ...s.tabCount, ...(tab.key === activeTab ? s.tabCountOn : null) }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Desktop gets a slim promo strip too, so the page isn't bare */}
      {desktop && <PromoCarousel compact />}

      <div
        style={{
          ...s.grid,
          gridTemplateColumns: desktop ? "repeat(3, minmax(0,1fr))" : "repeat(2, minmax(0,1fr))",
        }}
      >
        {visible.map((g) => {
          const ordered = [...g.items, ...g.subGroups.flatMap((sg) => sg.items)].reduce(
            (sum, it) => sum + (alreadyOrderedByItem.get(it.id) ?? 0),
            0
          );
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => onOpenGroup(g)}
              className="mnu-tap"
              style={{ ...s.card, height: desktop ? 208 : 190 }}
            >
              <GroupPhoto
                src={groupCircleImage(g.imageUrl, g.name)}
                name={g.name}
                style={s.cardPhoto}
              />
              <span style={s.cardScrim} aria-hidden />
              {ordered > 0 && (
                <span style={s.cardBadge}>
                  <span style={s.cardBadgeDot} />
                  {ordered} in cart
                </span>
              )}
              <span style={s.cardMeta}>
                <span style={s.cardName} className="mnu-clamp2">
                  {g.name}
                </span>
                <span style={s.cardCount}>
                  {g.count} <small style={s.cardCountSmall}>Items</small>
                </span>
              </span>
              <span style={s.cardGo} aria-hidden>→</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  /* ── promo hero ─────────────────────────────────────────── */
  promo: {
    margin: "0 0 6px",
    borderRadius: 22,
    background:
      "linear-gradient(135deg, #3A2A17 0%, #2A1F12 55%, #1F1810 100%)",
    border: `1px solid ${T.goldLine}`,
    display: "flex",
    overflow: "hidden",
    position: "relative",
    boxShadow: "0 14px 34px rgba(0,0,0,0.35)",
  },
  promoGlowA: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(171,119,60,0.4), transparent 70%)",
    top: -70,
    left: -50,
  },
  promoGlowB: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(171,119,60,0.22), transparent 70%)",
    bottom: -60,
    right: 90,
  },
  promoText: {
    flex: 1,
    padding: "16px 8px 16px 20px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    position: "relative",
    zIndex: 1,
    minWidth: 0,
  },
  promoKicker: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 8.5,
    fontWeight: 700,
    letterSpacing: 2.2,
  },
  promoTitleRow: { display: "flex", alignItems: "baseline", gap: 8, marginTop: 4, flexWrap: "wrap" },
  promoTitle: { color: T.white, fontSize: 17, fontWeight: 500 },
  promoAccent: {
    color: T.gold,
    fontSize: 30,
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: 0.3,
    textShadow: "0 2px 14px rgba(171,119,60,0.5)",
  },
  promoSub: { color: "rgba(255,255,255,0.82)", fontSize: 11.5, lineHeight: 1.5, marginTop: 7 },
  promoNote: { color: T.w40, fontSize: 9.5, marginTop: 8, alignSelf: "flex-start" },
  promoArt: {
    width: 128,
    flex: "0 0 128px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    zIndex: 1,
    background: "linear-gradient(160deg, rgba(171,119,60,0.28) 0%, rgba(171,119,60,0.05) 100%)",
    borderLeft: `1px solid rgba(171,119,60,0.25)`,
  },
  promoArtCircle: {
    width: 84,
    height: 84,
    borderRadius: "50%",
    background: "radial-gradient(circle at 32% 28%, #6b5230, #33261a)",
    border: `1px solid ${T.goldLine}`,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 42,
    boxShadow: "0 10px 24px rgba(0,0,0,0.4)",
  },
  dots: { display: "flex", gap: 6, justifyContent: "center", marginBottom: 14, marginTop: 10 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    background: "rgba(255,255,255,0.22)",
    border: "none",
    padding: 0,
    cursor: "pointer",
    transition: "all 0.25s ease",
  },
  dotOn: { width: 20, background: T.gold },

  /* ── category pills ─────────────────────────────────────── */
  tabRow: { display: "flex", gap: 9, paddingBottom: 16, overflowX: "auto" },
  tab: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    padding: "9px 15px",
    borderRadius: 20,
    // longhands (not the `border` shorthand) so tabOn can safely
    // override just the colour — mixing them makes React warn
    borderWidth: 1.5,
    borderStyle: "solid",
    borderColor: "rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.03)",
    color: T.w72,
    fontSize: 12.5,
    fontWeight: 700,
    letterSpacing: 0.6,
    whiteSpace: "nowrap",
    cursor: "pointer",
    flex: "0 0 auto",
  },
  tabOn: {
    background: "linear-gradient(180deg, rgba(186,131,66,0.98), rgba(171,119,60,0.95))",
    borderColor: "rgba(255,255,255,0.2)",
    color: T.white,
    boxShadow: T.shadowGold,
  },
  tabCount: {
    fontSize: 10,
    fontWeight: 800,
    padding: "2px 7px",
    borderRadius: 9,
    background: "rgba(255,255,255,0.09)",
    color: T.w55,
  },
  tabCountOn: { background: "rgba(255,255,255,0.22)", color: T.white },

  /* ── group cards ────────────────────────────────────────── */
  grid: { display: "grid", gap: 14, paddingBottom: 10 },
  card: {
    position: "relative",
    borderRadius: 20,
    overflow: "hidden",
    background: T.card,
    border: `1px solid ${T.line}`,
    padding: 0,
    cursor: "pointer",
    textAlign: "left",
    boxShadow: "0 8px 22px rgba(0,0,0,0.28)",
  },
  cardPhoto: { position: "absolute", inset: 0 },
  photoImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  photoFallback: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "radial-gradient(circle at 30% 25%, #4a3a22, #241b11 75%)",
  },
  cardScrim: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(180deg, rgba(15,13,11,0.05) 30%, rgba(15,13,11,0.88) 100%)",
  },
  cardBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 9.5,
    fontWeight: 800,
    letterSpacing: 0.4,
    color: T.white,
    background: "rgba(20,17,14,0.72)",
    border: `1px solid ${T.goldLine}`,
    padding: "4px 9px",
    borderRadius: 10,
    backdropFilter: "blur(6px)",
  },
  cardBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: T.gold,
    boxShadow: "0 0 8px rgba(171,119,60,0.9)",
  },
  cardMeta: {
    position: "absolute",
    left: 13,
    right: 40,
    bottom: 11,
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  cardName: { color: T.white, fontSize: 15.5, fontWeight: 700, letterSpacing: 0.2, lineHeight: 1.25 },
  cardCount: { color: "rgba(255,255,255,0.75)", fontSize: 11.5, fontWeight: 600 },
  cardCountSmall: { fontWeight: 400, opacity: 0.8, fontSize: 10.5 },
  cardGo: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 26,
    height: 26,
    borderRadius: "50%",
    background: "rgba(171,119,60,0.9)",
    color: T.white,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 700,
    boxShadow: T.shadowGold,
  },
};
