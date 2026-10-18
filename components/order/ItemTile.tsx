// ============================================================
// LOCATION: components/order/ItemTile.tsx
// One dish in the menu grid.
//
// Layout: photo on top (with the add / stepper control floating
// over the bottom-right corner), then name, description and price.
// The grid is `auto-fill minmax(158px, 1fr)` so a small phone
// gets a single column and a bigger one gets two.
// ============================================================
"use client";

import { C, itemEmoji, moneyShort } from "./theme";
import type { MenuItem } from "./types";

export default function ItemTile({
  item,
  qty,
  onAdd,
  onInc,
  onDec,
}: {
  item: MenuItem;
  qty: number;
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
}) {
  return (
    <div
      className="ord-card ord-tap-soft"
      style={{
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        opacity: item.available ? 1 : 0.6,
      }}
    >
      {/* photo */}
      <div
        style={{
          position: "relative",
          aspectRatio: "4 / 3",
          background: C.surfaceWarm,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 34,
          overflow: "hidden",
        }}
      >
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <span aria-hidden>{itemEmoji(item.name)}</span>
        )}

        {/* add / stepper */}
        <div style={{ position: "absolute", right: 8, bottom: 8 }}>
          {qty > 0 ? (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
                padding: "4px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.94)",
                backdropFilter: "blur(6px)",
                boxShadow: C.shadowMd,
                border: `1px solid ${C.line}`,
              }}
            >
              <StepBtn label="−" onClick={onDec} />
              <span
                style={{
                  minWidth: 20,
                  textAlign: "center",
                  fontSize: 13,
                  fontWeight: 750,
                  color: C.primary,
                }}
              >
                {qty}
              </span>
              <StepBtn label="+" onClick={onInc} />
            </div>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              disabled={!item.available}
              aria-label={`Add ${item.name} to the cart`}
              className="ord-tap"
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                border: "none",
                cursor: item.available ? "pointer" : "not-allowed",
                background: C.primary,
                color: "#FFF9F2",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: C.shadowMd,
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>

        {!item.available ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(251,246,240,0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                background: C.ink,
                color: "#fff",
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "4px 10px",
                borderRadius: 999,
              }}
            >
              Sold out
            </span>
          </div>
        ) : null}
      </div>

      {/* body */}
      <div style={{ padding: "10px 11px 12px", display: "flex", flexDirection: "column", flex: 1 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 650,
            color: C.ink,
            lineHeight: 1.3,
            minHeight: 35,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.name}
        </div>

        {item.description ? (
          <div
            style={{
              fontSize: 11,
              color: C.ink3,
              marginTop: 2,
              lineHeight: 1.35,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {item.description}
          </div>
        ) : null}

        <div style={{ flex: 1 }} />

        <div
          style={{
            fontSize: 13.5,
            fontWeight: 750,
            color: C.primary,
            marginTop: 6,
          }}
        >
          {moneyShort(item.price)}
        </div>
      </div>
    </div>
  );
}

function StepBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label === "+" ? "Increase quantity" : "Decrease quantity"}
      className="ord-tap"
      style={{
        width: 26,
        height: 26,
        borderRadius: 999,
        border: "none",
        background: C.primary,
        color: "#FFF9F2",
        fontSize: 15,
        lineHeight: 1,
        fontWeight: 700,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: C.font,
      }}
    >
      {label}
    </button>
  );
}
