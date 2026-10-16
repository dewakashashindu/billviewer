"use client";

// ============================================================
// LOCATION: components/menu/MenuItemCard.tsx
// The circular-photo + card design from the app's menu_cato
// (image overlaps the card top), with the ADD / qty stepper.
// ============================================================

import type { CSSProperties } from "react";
import { formatPriceShort, itemEmoji, T } from "./theme";
import type { MenuItem } from "./types";

export function AddQtyButton({
  qty,
  onAdd,
  onInc,
  onDec,
  large = false,
}: {
  qty: number;
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
  large?: boolean;
}) {
  const pad: CSSProperties = large
    ? { padding: "8px 22px", fontSize: 11 }
    : { padding: "6px 16px", fontSize: 9.5 };

  if (qty === 0) {
    return (
      <button type="button" onClick={onAdd} style={{ ...s.addBtn, ...pad }}>
        ADD
      </button>
    );
  }
  return (
    <span style={s.stepper}>
      <button
        type="button"
        aria-label="Decrease"
        style={large ? s.stepBtnLg : s.stepBtn}
        onClick={onDec}
      >
        −
      </button>
      <span style={large ? s.qtyNumLg : s.qtyNum}>{qty}</span>
      <button
        type="button"
        aria-label="Increase"
        style={large ? s.stepBtnLg : s.stepBtn}
        onClick={onInc}
      >
        +
      </button>
    </span>
  );
}

export function ItemPhoto({
  item,
  size,
  radius = "50%",
}: {
  item: Pick<MenuItem, "id" | "name" | "imageUrl">;
  size: number;
  radius?: string | number;
}) {
  const box: CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    background: "radial-gradient(circle at 32% 28%, #6b5230, #2f2418)",
    border: `1px solid ${T.goldLine}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: Math.round(size * 0.42),
    overflow: "hidden",
    flex: "0 0 auto",
  };
  if (item.imageUrl) {
    return (
      <span style={box}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.imageUrl}
          alt={item.name}
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </span>
    );
  }
  return (
    <span style={box} aria-hidden>
      {itemEmoji(item.name)}
    </span>
  );
}

export default function MenuItemCard({
  item,
  qty,
  onAdd,
  onInc,
  onDec,
  onOpen,
  alreadyOrdered = 0,
}: {
  item: MenuItem;
  qty: number;
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
  onOpen: () => void;
  alreadyOrdered?: number;
}) {
  return (
    <div style={s.wrap}>
      <div style={s.circle}>
        <ItemPhoto item={item} size={92} />
      </div>
      <div style={s.card}>
        <button type="button" onClick={onOpen} style={s.openArea}>
          <span style={s.name}>{item.name}</span>
          <span style={s.price}>{formatPriceShort(item.price)}</span>
        </button>
        {alreadyOrdered > 0 && (
          <span style={s.badge}>ALREADY ON BILL ×{alreadyOrdered}</span>
        )}
        <div style={s.row}>
          <span onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex" }}>
            <AddQtyButton qty={qty} onAdd={onAdd} onInc={onInc} onDec={onDec} />
          </span>
          <span style={s.chev} onClick={onOpen} role="button" aria-label="View details" />
        </div>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  wrap: { position: "relative", paddingTop: 46, width: "100%" },
  circle: { position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 2 },
  card: {
    background: T.cardDeep,
    border: "1px solid rgba(201,201,201,0.30)",
    borderRadius: 12,
    padding: "56px 13px 12px",
    display: "flex",
    flexDirection: "column",
  },
  openArea: {
    background: "none",
    border: "none",
    padding: 0,
    textAlign: "left",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    color: "inherit",
    font: "inherit",
  },
  name: { color: T.white, fontSize: 13.5, fontWeight: 500, lineHeight: 1.35 },
  price: { color: T.gold90, fontSize: 12, fontWeight: 600, marginTop: 4 },
  badge: {
    alignSelf: "flex-start",
    marginTop: 7,
    fontSize: 8.5,
    fontWeight: 700,
    letterSpacing: 0.4,
    color: T.w55,
    background: "rgba(255,255,255,0.10)",
    padding: "3px 7px",
    borderRadius: 7,
  },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  chev: {
    width: 11,
    height: 11,
    borderTop: "1.6px solid rgba(255,255,255,0.8)",
    borderRight: "1.6px solid rgba(255,255,255,0.8)",
    transform: "rotate(45deg)",
    cursor: "pointer",
    marginRight: 3,
  },
  addBtn: {
    background: "rgba(171,119,60,0.85)",
    color: T.white,
    fontWeight: 700,
    letterSpacing: 1.1,
    border: "none",
    borderRadius: 11,
    cursor: "pointer",
  },
  stepper: {
    display: "inline-flex",
    alignItems: "center",
    background: "rgba(171,119,60,0.85)",
    borderRadius: 11,
    overflow: "hidden",
  },
  stepBtn: {
    width: 28,
    height: 26,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "none",
    border: "none",
    color: T.white,
    fontSize: 15,
    cursor: "pointer",
  },
  stepBtnLg: {
    width: 34,
    height: 32,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "none",
    border: "none",
    color: T.white,
    fontSize: 17,
    cursor: "pointer",
  },
  qtyNum: { color: T.white, fontSize: 12.5, fontWeight: 700, minWidth: 20, textAlign: "center" },
  qtyNumLg: { color: T.white, fontSize: 14, fontWeight: 700, minWidth: 24, textAlign: "center" },
};
