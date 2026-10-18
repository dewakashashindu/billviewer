"use client";

// ============================================================
// LOCATION: components/menu/ItemDetailModal.tsx
// The app's ItemDetailModal (redesigned): photo hero, name + gold
// price tag, description, quantity + line total.
// Mobile → full-screen sheet. Desktop → centred modal.
// ============================================================

import { useState, type CSSProperties } from "react";
import { formatPrice, itemEmoji, T } from "./theme";
import { AddQtyButton } from "./MenuItemCard";
import type { MenuItem } from "./types";

/** Hero photo with an emoji fallback if the image fails. */
function DetailPhoto({ item, desktop }: { item: MenuItem; desktop: boolean }) {
  const [failed, setFailed] = useState(false);
  const size = desktop ? 170 : 200;
  if (item.imageUrl && !failed) {
    return (
      <span style={{ ...s.photoRing, width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.imageUrl}
          alt={item.name}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: desktop ? 20 : "50%" }}
        />
      </span>
    );
  }
  return (
    <span style={{ ...s.photoRing, width: size, height: size, borderRadius: desktop ? 20 : "50%" }} aria-hidden>
      <span style={{ fontSize: Math.round(size * 0.44) }}>{itemEmoji(item.name)}</span>
    </span>
  );
}

export default function ItemDetailModal({
  item,
  qty,
  onClose,
  onAdd,
  onInc,
  onDec,
  desktop = false,
}: {
  item: MenuItem | null;
  qty: number;
  onClose: () => void;
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
  desktop?: boolean;
}) {
  if (!item) return null;
  const lineTotal = item.price * qty;

  return (
    <div style={s.overlay} className="mnu-anim-fade" role="dialog" aria-modal="true">
      <div
        style={{
          ...s.card,
          ...(desktop
            ? { maxWidth: 560, borderRadius: 24, maxHeight: "86vh", margin: "auto" }
            : { borderRadius: 0, maxWidth: "100%", minHeight: "100%" }),
        }}
        className="mnu-anim-up mnu-scroll"
      >
        <div style={{ ...s.hero, height: desktop ? 230 : 280 }}>
          <DetailPhoto item={item} desktop={desktop} />
          <button type="button" style={s.close} className="mnu-tap" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div style={s.body}>
          <div style={s.nameRow}>
            <h3 style={s.name}>{item.name}</h3>
            <span style={s.priceTag}>{formatPrice(item.price)}</span>
          </div>

          {item.groupName || item.subGroupName ? (
            <div style={s.metaRow}>
              {item.groupName ? <span style={s.metaChip}>{item.groupName}</span> : null}
              {item.subGroupName ? <span style={s.metaChip}>{item.subGroupName}</span> : null}
            </div>
          ) : null}

          {item.description ? (
            <>
              <div style={s.divider} />
              <div style={s.label}>Description</div>
              <p style={s.desc}>{item.description}</p>
            </>
          ) : null}

          <div style={s.foot}>
            <div>
              <div style={s.totLabel}>
                {qty > 0 ? `${qty} × ${formatPrice(item.price)}` : "Choose quantity"}
              </div>
              {qty > 0 && <div style={s.totAmt}>{formatPrice(lineTotal)}</div>}
            </div>
            <AddQtyButton qty={qty} onAdd={onAdd} onInc={onInc} onDec={onDec} large />
          </div>

          <button type="button" style={s.done} className="mnu-tap" onClick={onClose}>
            Done — back to menu
          </button>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 90,
    background: "rgba(0,0,0,0.74)",
    backdropFilter: "blur(3px)",
    display: "flex",
    alignItems: "stretch",
    justifyContent: "center",
    padding: 0,
    overflow: "auto",
  },
  card: {
    width: "100%",
    background: T.bg,
    border: `1px solid ${T.line}`,
    display: "flex",
    flexDirection: "column",
    overflow: "auto",
  },
  hero: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "radial-gradient(circle at 50% 0%, #4c3820, #241b11 80%)",
    flex: "0 0 auto",
  },
  photoRing: {
    borderRadius: "50%",
    background: "radial-gradient(circle at 32% 28%, #6b5230, #2f2418)",
    border: `2px solid ${T.goldLine}`,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    boxShadow: "0 18px 44px rgba(0,0,0,0.5)",
    flex: "0 0 auto",
  },
  close: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "rgba(15,13,11,0.6)",
    border: "1px solid rgba(255,255,255,0.25)",
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    backdropFilter: "blur(6px)",
  },
  body: { padding: "22px 20px 30px" },
  nameRow: { display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" },
  name: { margin: 0, color: T.white, fontSize: 24, fontWeight: 800, lineHeight: 1.25, flex: 1 },
  priceTag: {
    background: T.goldSoft,
    border: `1px solid ${T.goldLine}`,
    borderRadius: 11,
    padding: "7px 12px",
    color: T.gold,
    fontSize: 15,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  metaRow: { display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" },
  metaChip: {
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: 0.6,
    color: T.w55,
    background: T.card,
    border: `1px solid ${T.line}`,
    borderRadius: 14,
    padding: "5px 11px",
  },
  divider: { height: 1, background: "rgba(255,255,255,0.12)", margin: "18px 0" },
  label: { color: T.w40, fontSize: 10.5, fontWeight: 800, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 8 },
  desc: { color: "rgba(255,255,255,0.62)", fontSize: 13.5, lineHeight: 1.75, margin: 0 },
  foot: {
    marginTop: 26,
    borderTop: "1px solid rgba(255,255,255,0.12)",
    paddingTop: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  totLabel: { color: T.w40, fontSize: 11.5 },
  totAmt: { color: T.gold, fontSize: 21, fontWeight: 800, marginTop: 4 },
  done: {
    marginTop: 22,
    height: 52,
    width: "100%",
    borderRadius: 15,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(180deg, rgba(186,131,66,0.92), rgba(171,119,60,0.88))",
    color: T.white,
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
    boxShadow: T.shadowGold,
  },
};
