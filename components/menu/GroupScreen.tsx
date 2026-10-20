"use client";

// ============================================================
// LOCATION: components/menu/GroupScreen.tsx
// Step 3/4 — a Level-1 group (Chinese, Sri Lankan …): photo hero
// with overlay title, breadcrumb chips, Level-2 sub-categories as
// a horizontal chip scroller and the item grid (redesigned).
// When `subGroup` is set it behaves as the app's SubItems screen.
// ============================================================

import { useState, type CSSProperties } from "react";
import { itemEmoji, T } from "./theme";
import { groupCircleImage } from "./groupImages";
import MenuItemCard from "./MenuItemCard";
import type { CartRow } from "./useCustomerCart";
import type { GroupCard, MenuItem, SubGroup } from "./types";

/** Hero photo with an emoji fallback if the image fails. */
function HeroPhoto({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return (
      <div style={s.heroFallback} aria-hidden>
        <span style={{ fontSize: 64 }}>{itemEmoji(name)}</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      style={s.heroImg}
      onError={() => setFailed(true)}
    />
  );
}

/** One titled grid of dishes. */
function ItemSection({
  items,
  label,
  cart,
  onAdd,
  onInc,
  onDec,
  onOpenItem,
  desktop,
  columns,
}: {
  items: MenuItem[];
  label: string;
  cart: { qtyOf: (id: string) => number; existingOf: (id: string) => number };
  onAdd: (id: string) => void;
  onInc: (id: string) => void;
  onDec: (id: string) => void;
  onOpenItem: (id: string) => void;
  desktop?: boolean;
  columns?: number;
}) {
  return (
    <>
      <div style={s.gridLabel}>
        <span>{label}</span>
        <span style={s.gridLabelCount}>{items.length}</span>
      </div>
      <ItemGrid
        items={items}
        cart={cart}
        onAdd={onAdd}
        onInc={onInc}
        onDec={onDec}
        onOpenItem={onOpenItem}
        desktop={desktop}
        columns={columns}
      />
    </>
  );
}

function ItemGrid({
  items,
  cart,
  onAdd,
  onInc,
  onDec,
  onOpenItem,
  desktop,
  columns,
}: {
  items: MenuItem[];
  cart: { qtyOf: (id: string) => number; existingOf: (id: string) => number };
  onAdd: (id: string) => void;
  onInc: (id: string) => void;
  onDec: (id: string) => void;
  onOpenItem: (id: string) => void;
  desktop?: boolean;
  columns?: number;
}) {
  return (
    <div
      style={{
        ...s.itemGrid,
        gridTemplateColumns: `repeat(${columns ?? (desktop ? 3 : 2)}, minmax(0,1fr))`,
      }}
    >
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
  );
}

export default function GroupScreen({
  group,
  subGroup,
  cart,
  onBack,
  onAdd,
  onInc,
  onDec,
  onOpenItem,
  desktop = false,
  columns,
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
  /** kept for call-site compatibility — chips scroll instead of navigating */
  onOpenSub?: (sub: SubGroup) => void;
  onAdd: (itemId: string) => void;
  onInc: (itemId: string) => void;
  onDec: (itemId: string) => void;
  onOpenItem: (itemId: string) => void;
  desktop?: boolean;
  /** cards per row — defaults to 3 on desktop, 2 on phones */
  columns?: number;
}) {
  const items = subGroup ? subGroup.items : group.items;
  const subGroups = group.subGroups.filter((sg) => sg.items.length > 0);
  const title = subGroup ? subGroup.name : group.name;
  const count = subGroup
    ? subGroup.items.length
    : group.items.length + group.subGroups.reduce((sum, sg) => sum + sg.items.length, 0);
  const heroSource = groupCircleImage(
    subGroup ? subGroup.items.find((i) => i.imageUrl)?.imageUrl : group.imageUrl,
    subGroup ? subGroup.name : group.name,
  );

  return (
    <div className="mnu-anim-up">
      {/* hero */}
      <div style={{ ...s.hero, height: desktop ? 200 : 208 }}>
        <HeroPhoto src={heroSource} name={title} />
        <div style={s.heroOverlay} />
        <button type="button" style={s.backBtn} className="mnu-tap" onClick={onBack} aria-label="Back">
          <span style={s.backChev} />
        </button>
        <div style={s.heroMeta}>
          <span style={s.heroKicker}>
            {(subGroup ? group.name : title).toUpperCase()} · {count}{" "}
            {count === 1 ? "ITEM" : "ITEMS"}
          </span>
          <h2 style={s.heroTitle}>{title.toUpperCase()}</h2>
        </div>
      </div>

      {/* breadcrumb (sub-group view) */}
      {subGroup && (
        <div style={s.crumbRow}>
          <button type="button" style={s.crumbBtn} className="mnu-tap" onClick={onBack}>
            {group.name.toUpperCase()}
          </button>
          <span style={s.crumbSep}>›</span>
          <b style={{ color: T.gold }}>{subGroup.name.toUpperCase()}</b>
        </div>
      )}

      <p style={s.desc}>
        {subGroup
          ? `Everything in ${subGroup.name} — prices include taxes.`
          : `Everything in ${group.name} — prices include taxes.`}
      </p>

      {/* sub-categories as a quick-jump chip scroller */}
      {!subGroup && subGroups.length > 0 && (
        <div style={s.chipRow} className="mnu-scroll mnu-no-bar">
          {subGroups.map((sub) => (
            <button
              key={sub.key}
              type="button"
              style={s.chip}
              className="mnu-tap"
              onClick={() =>
                document
                  .getElementById(`mnu-sg-${sub.key}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              <span>{sub.name}</span>
              <span style={s.chipCount}>{sub.items.length}</span>
            </button>
          ))}
        </div>
      )}

      {/* items — every sub-group is laid out inline so a guest never
          lands on an "empty" category that actually has dishes */}
      {items.length > 0 && (
        <ItemSection
          items={items}
          label="All items"
          cart={cart}
          onAdd={onAdd}
          onInc={onInc}
          onDec={onDec}
          onOpenItem={onOpenItem}
          desktop={desktop}
          columns={columns}
        />
      )}

      {!subGroup &&
        subGroups.map((sub) => (
          <div key={sub.key} id={`mnu-sg-${sub.key}`} style={s.sectionAnchor}>
            <div style={s.gridLabel}>
              <span>{sub.name}</span>
              <span style={s.gridLabelCount}>{sub.items.length}</span>
            </div>
            <ItemGrid
              items={sub.items}
              cart={cart}
              onAdd={onAdd}
              onInc={onInc}
              onDec={onDec}
              onOpenItem={onOpenItem}
              desktop={desktop}
              columns={columns}
            />
          </div>
        ))}

      {items.length === 0 && !subGroup && group.subGroups.length === 0 && (
        <div style={s.empty}>
          <span style={{ fontSize: 48 }} aria-hidden>🍽️</span>
          <div style={{ color: T.white, fontSize: 17, fontWeight: 700, marginTop: 12 }}>
            Coming Soon
          </div>
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
    borderRadius: 22,
    overflow: "hidden",
    background: "linear-gradient(150deg,#4c3820,#221a12 70%)",
    marginBottom: 16,
    boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
  },
  heroImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  heroFallback: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  heroOverlay: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(180deg, rgba(10,9,8,0.34) 0%, rgba(10,9,8,0.05) 40%, rgba(10,9,8,0.82) 100%)",
  },
  backBtn: {
    position: "absolute",
    top: 14,
    left: 14,
    width: 40,
    height: 40,
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(15,13,11,0.55)",
    backdropFilter: "blur(8px)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    zIndex: 2,
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
  heroMeta: { position: "absolute", left: 16, right: 16, bottom: 13, zIndex: 1 },
  heroKicker: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.8,
  },
  heroTitle: {
    margin: "4px 0 0",
    color: T.white,
    fontSize: 23,
    fontWeight: 800,
    letterSpacing: 0.4,
    textShadow: "0 2px 12px rgba(0,0,0,0.5)",
  },
  crumbRow: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    color: T.w40,
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  crumbBtn: {
    background: "rgba(255,255,255,0.05)",
    border: `1px solid ${T.line}`,
    borderRadius: 14,
    padding: "6px 12px",
    color: T.w55,
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: 0.6,
    cursor: "pointer",
  },
  crumbSep: { color: T.w25 },
  desc: { color: "rgba(255,255,255,0.5)", fontSize: 12.5, lineHeight: 1.65, margin: "0 0 14px" },
  chipRow: { display: "flex", gap: 9, overflowX: "auto", paddingBottom: 14, marginBottom: 4 },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 14px",
    borderRadius: 18,
    background: T.card,
    border: `1px solid ${T.line}`,
    color: T.w72,
    fontSize: 12.5,
    fontWeight: 700,
    whiteSpace: "nowrap",
    cursor: "pointer",
    flex: "0 0 auto",
  },
  chipCount: {
    fontSize: 10,
    fontWeight: 800,
    padding: "2px 7px",
    borderRadius: 9,
    background: T.goldSoft,
    color: T.gold,
  },
  sectionAnchor: { scrollMarginTop: 88 },
  gridLabel: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    color: "rgba(255,255,255,0.65)",
    fontSize: 11.5,
    fontWeight: 800,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    margin: "6px 0 13px",
  },
  gridLabelCount: {
    fontSize: 10,
    fontWeight: 800,
    color: T.gold,
    background: T.goldSoft,
    borderRadius: 8,
    padding: "2px 8px",
    letterSpacing: 0.5,
  },
  itemGrid: { display: "grid", gap: 14, paddingBottom: 18 },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "64px 0 110px",
    textAlign: "center",
  },
};

export type { CartRow };
