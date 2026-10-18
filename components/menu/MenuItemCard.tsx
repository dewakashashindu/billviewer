"use client";

// ============================================================
// LOCATION: components/menu/MenuItemCard.tsx
// Redesigned dish card: rounded photo header, clamped name,
// gold price and an ADD pill / qty stepper. The circular-photo
// variant (ItemPhoto) is still exported for cart + search rows.
// ============================================================

import { useState, type CSSProperties } from "react";
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
    ? { padding: "9px 24px", fontSize: 11.5 }
    : { padding: "7px 18px", fontSize: 10.5 };

  if (qty === 0) {
    return (
      <button type="button" onClick={onAdd} className="mnu-tap" style={{ ...s.addBtn, ...pad }}>
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

/** Square/round photo with an emoji fallback when the image fails. */
export function ItemPhoto({
  item,
  size,
  radius = "50%",
}: {
  item: Pick<MenuItem, "id" | "name" | "imageUrl">;
  size: number;
  radius?: string | number;
}) {
  const [failed, setFailed] = useState(false);
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
  if (item.imageUrl && !failed) {
    return (
      <span style={box}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.imageUrl}
          alt={item.name}
          loading="lazy"
          onError={() => setFailed(true)}
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

/** Photo that fills its parent (used for the card header). */
function CardPhoto({ item }: { item: Pick<MenuItem, "name" | "imageUrl"> }) {
  const [failed, setFailed] = useState(false);
  if (item.imageUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.imageUrl}
        alt={item.name}
        loading="lazy"
        onError={() => setFailed(true)}
        style={s.cardPhotoImg}
      />
    );
  }
  return (
    <span style={s.cardPhotoFallback} aria-hidden>
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
    <div style={s.card} className="mnu-anim-up">
      {/* photo header */}
      <button type="button" onClick={onOpen} style={s.photoBtn} aria-label={`View ${item.name}`}>
        <CardPhoto item={item} />
        <span style={s.photoScrim} aria-hidden />
        {alreadyOrdered > 0 && (
          <span style={s.badge}>ON BILL ×{alreadyOrdered}</span>
        )}
        {!item.available && <span style={s.soldOut}>Sold out</span>}
      </button>

      {/* body */}
      <div style={s.body}>
        <button type="button" onClick={onOpen} style={s.nameBtn}>
          <span style={s.name} className="mnu-clamp2">
            {item.name}
          </span>
        </button>
        <div style={s.priceRow}>
          <span style={s.price}>{formatPriceShort(item.price)}</span>
          <span onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex" }}>
            <AddQtyButton qty={qty} onAdd={onAdd} onInc={onInc} onDec={onDec} />
          </span>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  card: {
    background: T.cardDeep,
    border: `1px solid ${T.line}`,
    borderRadius: 18,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
  },
  photoBtn: {
    position: "relative",
    display: "block",
    width: "100%",
    aspectRatio: "16 / 11",
    padding: 0,
    border: "none",
    background: "radial-gradient(circle at 32% 28%, #4a3a22, #241b11 75%)",
    cursor: "pointer",
    overflow: "hidden",
  },
  cardPhotoImg: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  cardPhotoFallback: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 52,
  },
  photoScrim: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(20,17,14,0.55) 100%)",
    pointerEvents: "none",
  },
  badge: {
    position: "absolute",
    top: 9,
    left: 9,
    fontSize: 8.5,
    fontWeight: 800,
    letterSpacing: 0.5,
    color: T.w72,
    background: "rgba(20,17,14,0.72)",
    border: "1px solid rgba(255,255,255,0.14)",
    padding: "3px 8px",
    borderRadius: 8,
    backdropFilter: "blur(4px)",
  },
  soldOut: {
    position: "absolute",
    top: 9,
    right: 9,
    fontSize: 8.5,
    fontWeight: 800,
    letterSpacing: 0.5,
    color: "#ffd7d7",
    background: "rgba(224,82,82,0.85)",
    padding: "3px 8px",
    borderRadius: 8,
  },
  body: { padding: "11px 12px 12px", display: "flex", flexDirection: "column", gap: 9, flex: 1 },
  nameBtn: {
    background: "none",
    border: "none",
    padding: 0,
    textAlign: "left",
    cursor: "pointer",
    color: "inherit",
    font: "inherit",
  },
  name: { color: T.w92, fontSize: 13.5, fontWeight: 600, lineHeight: 1.35 },
  priceRow: {
    marginTop: "auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  price: { color: T.gold, fontSize: 13.5, fontWeight: 800, whiteSpace: "nowrap" },
  addBtn: {
    background: "linear-gradient(180deg, rgba(186,131,66,0.98), rgba(171,119,60,0.95))",
    color: T.white,
    fontWeight: 800,
    letterSpacing: 1.4,
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: 11,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(171,119,60,0.35)",
  },
  stepper: {
    display: "inline-flex",
    alignItems: "center",
    background: "linear-gradient(180deg, rgba(186,131,66,0.98), rgba(171,119,60,0.95))",
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: 11,
    overflow: "hidden",
    boxShadow: "0 4px 12px rgba(171,119,60,0.35)",
  },
  stepBtn: {
    width: 30,
    height: 28,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "none",
    border: "none",
    color: T.white,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  stepBtnLg: {
    width: 36,
    height: 34,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "none",
    border: "none",
    color: T.white,
    fontSize: 18,
    fontWeight: 700,
    cursor: "pointer",
  },
  qtyNum: { color: T.white, fontSize: 13, fontWeight: 800, minWidth: 22, textAlign: "center" },
  qtyNumLg: { color: T.white, fontSize: 14.5, fontWeight: 800, minWidth: 26, textAlign: "center" },
};
