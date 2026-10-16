"use client";

// ============================================================
// LOCATION: components/menu/GroupScreen.tsx
// Step 3/4 — a Level-1 group (Chinese, Sri Lankan …): hero,
// breadcrumb, Level-2 sub-category cards and the item grid.
// When `subGroup` is set it behaves as the app's SubItems screen.
// ============================================================

import type { CSSProperties } from "react";
import { T } from "./theme";
import { groupCircleImage } from "./groupImages";
import MenuItemCard from "./MenuItemCard";
import type { CartRow } from "./useCustomerCart";
import type { GroupCard, SubGroup } from "./types";

export default function GroupScreen({
  group,
  subGroup,
  cart,
  onBack,
  onOpenSub,
  onAdd,
  onInc,
  onDec,
  onOpenItem,
  desktop = false,
}: {
  group: GroupCard;
  subGroup?: SubGroup | null;
  cart: {
    qtyOf: (itemId: string) => number;
    existingOf: (itemId: string) => number;
    add: (itemId: string) => void;
    inc: (itemId: string) => void;
    dec: (itemId: string) => void;
  };
  onBack: () => void;
  onOpenSub: (sub: SubGroup) => void;
  onAdd: (itemId: string) => void;
  onInc: (itemId: string) => void;
  onDec: (itemId: string) => void;
  onOpenItem: (itemId: string) => void;
  desktop?: boolean;
}) {
  const items = subGroup ? subGroup.items : group.items;
  const title = subGroup ? subGroup.name : group.name;
  const count = subGroup ? subGroup.items.length : group.count;
  const heroSource = groupCircleImage(
    subGroup ? subGroup.items.find((i) => i.imageUrl)?.imageUrl : group.imageUrl,
    subGroup ? subGroup.name : group.name,
  );

  return (
    <div className="mnu-anim-up">
      {/* hero */}
      <div style={{ ...s.hero, height: desktop ? 220 : 232 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={heroSource} alt="" style={s.heroImg} />
        <div style={s.heroOverlay} />
        <button type="button" style={s.backBtn} onClick={onBack} aria-label="Back">
          <span style={s.backChev} />
        </button>
        <div style={s.heroLabel}>
          {(subGroup ? group.name : title).toUpperCase()} · {count} ITEMS
        </div>
      </div>

      {/* header */}
      <div style={s.head}>
        {subGroup && (
          <div style={s.crumb}>
            <button type="button" style={s.crumbBtn} onClick={onBack}>
              {group.name.toUpperCase()}
            </button>
            <span style={s.crumbSep}>›</span>
            <b style={{ color: T.gold }}>{subGroup.name.toUpperCase()}</b>
          </div>
        )}
        <div style={s.titleRow}>
          <h2 style={s.title}>{title.toUpperCase()}</h2>
          <span style={s.count}>{count} Items</span>
        </div>
        <p style={s.desc}>
          {subGroup
            ? `Browse ${subGroup.name} items from the current Dining menu.`
            : `Browse ${group.name} items from the current Dining menu.`}
        </p>
      </div>

      <div style={s.divider} />

      {/* sub-categories */}
      {!subGroup && group.subGroups.length > 0 && (
        <div style={{ ...s.subGrid, gridTemplateColumns: desktop ? "repeat(3, minmax(0,1fr))" : "repeat(2, minmax(0,1fr))" }}>
          {group.subGroups.map((sub) => (
            <button key={sub.key} type="button" style={s.subCard} onClick={() => onOpenSub(sub)}>
              <span style={s.subName}>{sub.name}</span>
              <span style={s.subCount}>
                {sub.items.length}&nbsp;{sub.items.length === 1 ? "Item" : "Items"}
              </span>
              <span style={s.subView}>View →</span>
              <span style={s.subCircle} aria-hidden>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={groupCircleImage(sub.items.find((i) => i.imageUrl)?.imageUrl, sub.name)}
                  alt=""
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* items */}
      {items.length > 0 && (
        <>
          <div style={s.gridLabel}>All Items</div>
          <div style={{ ...s.itemGrid, gridTemplateColumns: desktop ? "repeat(3, minmax(0,1fr))" : "repeat(2, minmax(0,1fr))" }}>
            {items.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                qty={cart.qtyOf(item.id)}
                alreadyOrdered={cart.existingOf(item.id)}
                onAdd={() => onAdd(item.id)}
                onInc={() => onInc(item.id)}
                onDec={() => onDec(item.id)}
                onOpen={() => onOpenItem(item.id)}
              />
            ))}
          </div>
        </>
      )}

      {items.length === 0 && !subGroup && group.subGroups.length === 0 && (
        <div style={s.empty}>
          <span style={{ fontSize: 44 }}>🍽️</span>
          <div style={{ color: T.white, fontSize: 17, fontWeight: 700, marginTop: 10 }}>Coming Soon</div>
          <div style={{ color: T.w40, fontSize: 13, marginTop: 6 }}>
            {title} items will be available soon.
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  hero: {
    position: "relative",
    borderRadius: "0 0 42px 42px",
    overflow: "hidden",
    background: "linear-gradient(150deg,#4c3820,#221a12 70%)",
    marginBottom: 18,
  },
  heroImg: { width: "100%", height: "100%", objectFit: "cover" },
  heroOverlay: { position: "absolute", inset: 0, background: "rgba(0,0,0,0.28)" },
  backBtn: {
    position: "absolute",
    top: 16,
    left: 18,
    width: 40,
    height: 40,
    borderRadius: "50%",
    border: "1.5px solid rgba(255,255,255,0.6)",
    background: "rgba(0,0,0,0.4)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  backChev: {
    width: 10,
    height: 10,
    borderLeft: "2px solid #fff",
    borderBottom: "2px solid #fff",
    transform: "rotate(45deg)",
    marginLeft: 2,
    display: "block",
  },
  heroLabel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 14,
    textAlign: "center",
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    letterSpacing: 1.6,
  },
  head: { padding: "0 0 4px" },
  crumb: { display: "flex", alignItems: "center", gap: 6, color: T.w40, fontSize: 12.5, fontWeight: 500, marginBottom: 8 },
  crumbBtn: {
    background: "none",
    border: "none",
    padding: 0,
    color: T.w40,
    fontSize: 12.5,
    fontWeight: 500,
    cursor: "pointer",
  },
  crumbSep: { color: T.w25 },
  titleRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  title: { margin: 0, color: T.white, fontSize: 24, fontWeight: 700, letterSpacing: 0.2 },
  count: { color: T.gold, fontSize: 13, fontWeight: 600, marginTop: 6, whiteSpace: "nowrap" },
  desc: { color: "rgba(255,255,255,0.5)", fontSize: 12.5, lineHeight: 1.65, margin: "8px 0 0" },
  divider: { height: 1, background: "rgba(255,255,255,0.13)", margin: "18px 0 16px" },
  subGrid: { display: "grid", gap: 12, marginBottom: 18 },
  subCard: {
    position: "relative",
    height: 116,
    borderRadius: 14,
    background: T.card2,
    border: `1px solid ${T.line}`,
    padding: "14px 74px 14px 14px",
    textAlign: "left",
    cursor: "pointer",
    overflow: "hidden",
  },
  subName: { display: "block", color: T.white, fontSize: 15, fontWeight: 600 },
  subCount: { display: "block", marginTop: 4, color: T.gold90, fontSize: 12.5, fontWeight: 600 },
  subView: { position: "absolute", bottom: 9, left: 14, color: "rgba(171,119,60,0.75)", fontSize: 10.5, fontWeight: 600 },
  subCircle: {
    position: "absolute",
    right: 4,
    bottom: 6,
    width: 62,
    height: 62,
    borderRadius: "50%",
    background: "radial-gradient(circle at 34% 30%, #5d4728, #2c2117)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 25,
    overflow: "hidden",
  },
  gridLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  itemGrid: { display: "grid", gap: 16, paddingBottom: 12 },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 0 80px" },
};

export type { CartRow };
