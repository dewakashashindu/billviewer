"use client";

// ============================================================
// LOCATION: components/menu/MenuHome.tsx
// Step 2 — promo hero carousel + category tab pills + photo-top
// Level-1 group cards (redesigned home screen).
// Works on mobile and desktop; the parent decides the grid width.
// ============================================================

import { useMemo, useState, type CSSProperties } from "react";
import { categoryLabel, itemEmoji, T } from "./theme";
import { groupCircleImage } from "./groupImages";

const HOUSEPHOTO = "/menu-food-bg.jpg";
import type { GroupCard, MenuTab } from "./types";

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

/** Home hero — brand line + a real photo from the menu + live
    counts. Replaces the old fake "20% OFF" carousel: no invented
    offers ever reach a paying guest, and nothing auto-rotates. */
function MenuHero({
  groups,
  totalItems,
  categories,
  compact = false,
}: {
  groups: GroupCard[];
  totalItems: number;
  categories: number;
  compact?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const lead = groups.find((g) => Boolean(g.imageUrl)) ?? groups[0];
  const photo = lead ? groupCircleImage(lead.imageUrl, lead.name) : HOUSEPHOTO;

  return (
    <div className="mnu-anim-fade" style={{ ...s.hero, height: compact ? 178 : 220 }}>
      {/* the house platter paints instantly; the real photo fades over it */}
      <span style={{ ...s.heroImg, backgroundImage: `url(${HOUSEPHOTO})`, backgroundSize: "cover", backgroundPosition: "center" }} aria-hidden />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo}
        alt=""
        onLoad={() => setReady(true)}
        style={{ ...s.heroImg, opacity: ready ? 1 : 0, transition: "opacity .45s ease" }}
      />
      <span style={s.heroScrim} aria-hidden />

      <div style={s.heroBody}>
        <span style={s.heroKicker}>MILA MIRISSA · KITCHEN OPEN</span>
        <h2 style={{ ...s.heroTitle, fontSize: compact ? 20 : 28 }}>
          Every dish,
          <br />
          made to order.
        </h2>
        <p style={s.heroSub}>
          Add from the menu below and we start cooking the moment you confirm.
        </p>

        <div style={s.heroStats}>
          <span style={s.heroStat}>
            <b style={s.heroStatNum}>{totalItems}</b>
            <span style={s.heroStatLbl}>dishes</span>
          </span>
          <span style={s.heroStatRule} aria-hidden />
          <span style={s.heroStat}>
            <b style={s.heroStatNum}>{categories}</b>
            <span style={s.heroStatLbl}>categories</span>
          </span>
        </div>
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
  columns,
  heroCompact,
}: {
  tabs: MenuTab[];
  groups: GroupCard[];
  activeTab: string;
  onTab: (key: string) => void;
  onOpenGroup: (group: GroupCard) => void;
  alreadyOrderedByItem: Map<string, number>;
  desktop?: boolean;
  /** cards per row — defaults to 3 on desktop, 2 on phones */
  columns?: number;
  /** shorter hero on laptop heights; full-size on big screens */
  heroCompact?: boolean;
}) {
  const visible = useMemo(
    // compare against the SAME derived label the tab keys use
    () => groups.filter((g) => !activeTab || categoryLabel(g.categoryId) === activeTab),
    [groups, activeTab]
  );

  return (
    <div className="mnu-anim-up">
      <MenuHero
        groups={visible.length ? visible : groups}
        totalItems={tabs.reduce((sum, t) => sum + t.count, 0)}
        categories={groups.length}
        compact={heroCompact ?? desktop}
      />

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

      <div
        style={{
          ...s.grid,
          gridTemplateColumns: `repeat(${columns ?? (desktop ? 3 : 2)}, minmax(0,1fr))`,
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
              className="mnu-tap mnu-card"
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

      <div style={s.homeFoot}>
        All prices are in LKR and include taxes · Please tell your steward about any allergies.
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  /* ── home hero ──────────────────────────────────────────── */
  hero: {
    margin: "0 0 20px",
    borderRadius: 22,
    overflow: "hidden",
    position: "relative",
    background: T.card,
    border: `1px solid ${T.line}`,
    boxShadow: "0 14px 34px rgba(0,0,0,0.34)",
    isolation: "isolate",
  },
  heroImg: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  heroFallback: {
    position: "absolute",
    right: -10,
    bottom: -14,
    fontSize: 132,
    opacity: 0.85,
    transform: "rotate(-8deg)",
  },
  heroScrim: {
    position: "absolute",
    inset: 0,
    background: T.heroScrim,
  },
  heroBody: {
    position: "relative",
    zIndex: 1,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    padding: "0 20px",
    maxWidth: 340,
  },
  heroKicker: {
    color: T.gold,
    fontSize: 8.5,
    fontWeight: 800,
    letterSpacing: 2.4,
  },
  heroTitle: {
    margin: "7px 0 0",
    color: "#FFF8EE",
    fontWeight: 700,
    lineHeight: 1.12,
    letterSpacing: -0.6,
    textShadow: "0 2px 18px rgba(0,0,0,0.45)",
  },
  heroSub: {
    color: "rgba(255,246,234,0.78)",
    fontSize: 11.5,
    lineHeight: 1.55,
    marginTop: 9,
    maxWidth: 250,
  },
  heroStats: {
    alignSelf: "flex-start",
    marginTop: 13,
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    background: "rgba(20,16,13,0.72)",
    border: `1px solid ${T.goldLine}`,
    borderRadius: 14,
    padding: "7px 12px",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  },
  heroStat: { display: "inline-flex", alignItems: "baseline", gap: 4 },
  heroStatNum: { color: T.gold, fontSize: 14, fontWeight: 800, fontVariantNumeric: "tabular-nums" },
  heroStatLbl: { color: T.w55, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" },
  heroStatRule: { width: 1, height: 14, background: T.lineStrong },

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
    background: T.goldGrad,
    borderColor: "rgba(255,255,255,0.22)",
    color: T.goldInk,
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
  tabCountOn: { background: "rgba(29,21,13,0.20)", color: T.goldInk },

  /* ── group cards ────────────────────────────────────────── */
  grid: { display: "grid", gap: 14, paddingBottom: 10 },
  homeFoot: {
    color: T.w25,
    fontSize: 11,
    lineHeight: 1.7,
    textAlign: "center",
    padding: "22px 10px 8px",
  },
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
    background: "radial-gradient(circle at 30% 25%, #4a3a22, #1B1712 75%)",
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
    boxShadow: "0 0 8px rgba(217,164,99,0.9)",
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
    background: T.goldGrad,
    color: T.goldInk,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 700,
    boxShadow: T.shadowGold,
  },
};
