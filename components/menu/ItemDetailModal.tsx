"use client";

// ============================================================
// LOCATION: components/menu/ItemDetailModal.tsx
// The app's ItemDetailModal: photo, name + gold price tag,
// description, quantity + line total.
// Mobile → full-screen sheet. Desktop → centred modal.
// ============================================================

import type { CSSProperties } from "react";
import { formatPrice, T } from "./theme";
import { AddQtyButton, ItemPhoto } from "./MenuItemCard";
import type { MenuItem } from "./types";

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
            ? { maxWidth: 560, borderRadius: 22, maxHeight: "86vh", margin: "auto" }
            : { borderRadius: 0, maxWidth: "100%", minHeight: "100%" }),
        }}
        className="mnu-anim-up mnu-scroll"
      >
        <div style={{ ...s.hero, height: desktop ? 240 : 300 }}>
          <ItemPhoto item={item} size={desktop ? 180 : 210} radius={desktop ? 18 : "50%"} />
          <button type="button" style={s.close} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div style={s.body}>
          <div style={s.nameRow}>
            <h3 style={s.name}>{item.name}</h3>
            <span style={s.priceTag}>{formatPrice(item.price)}</span>
          </div>

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

          <button type="button" style={s.done} onClick={onClose}>
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
    background: "rgba(0,0,0,0.72)",
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
    background: "linear-gradient(150deg,#553d22,#241b11)",
    flex: "0 0 auto",
  },
  close: {
    position: "absolute",
    top: 16,
    left: 18,
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "rgba(0,0,0,0.55)",
    border: "1.5px solid rgba(255,255,255,0.28)",
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  body: { padding: "22px 20px 30px" },
  nameRow: { display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" },
  name: { margin: 0, color: T.white, fontSize: 24, fontWeight: 700, lineHeight: 1.25, flex: 1 },
  priceTag: {
    background: T.goldSoft,
    border: `1px solid ${T.goldLine}`,
    borderRadius: 10,
    padding: "6px 11px",
    color: T.gold,
    fontSize: 15,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  divider: { height: 1, background: "rgba(255,255,255,0.12)", margin: "16px 0" },
  label: { color: T.w40, fontSize: 10.5, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 8 },
  desc: { color: "rgba(255,255,255,0.62)", fontSize: 13.5, lineHeight: 1.7, margin: 0 },
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
  totAmt: { color: T.gold, fontSize: 20, fontWeight: 700, marginTop: 4 },
  done: {
    marginTop: 22,
    height: 50,
    width: "100%",
    borderRadius: 14,
    border: "none",
    background: "rgba(171,119,60,0.88)",
    color: T.white,
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
  },
};
