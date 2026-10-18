// ============================================================
// LOCATION: components/order/OrderShell.tsx
// The chrome shared by every screen of the ordering flow:
//   • a slim sticky top bar (back / title / cart pill)
//   • a centred phone-width column
//   • an optional sticky bottom bar (the cart summary)
// ============================================================
"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { C } from "./theme";

export function CartPill({
  count,
  total,
  onClick,
}: {
  count: number;
  total: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ord-tap"
      aria-label={`Open cart, ${count} items`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 38,
        padding: "0 14px 0 10px",
        borderRadius: 999,
        border: `1px solid ${C.line}`,
        background: C.surface,
        boxShadow: C.shadowSm,
        cursor: "pointer",
        fontFamily: C.font,
      }}
    >
      <span
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 24,
          height: 24,
          borderRadius: 999,
          background: count > 0 ? C.primary : C.surfaceWarm,
          color: count > 0 ? "#FFF9F2" : C.ink3,
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {count}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 2 }}>
          <path
            d="M4 5h2l2.2 9.5a2 2 0 0 0 2 1.6h7.3a2 2 0 0 0 2-1.5L21 8H7"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="10.5" cy="19.5" r="1.5" fill="currentColor" />
          <circle cx="17.5" cy="19.5" r="1.5" fill="currentColor" />
        </svg>
      </span>
      <span style={{ fontSize: 13, fontWeight: 650, color: C.ink }}>
        Rs. {Math.round(total).toLocaleString("en-LK")}
      </span>
    </button>
  );
}

export function BackButton({ onClick, label = "Back" }: { onClick?: () => void; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => (onClick ? onClick() : router.back())}
      className="ord-tap"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 38,
        height: 38,
        borderRadius: 999,
        border: `1px solid ${C.line}`,
        background: C.surface,
        boxShadow: C.shadowSm,
        cursor: "pointer",
        color: C.primary,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M15 5l-7 7 7 7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export function OrderShell({
  title,
  subtitle,
  onBack,
  right,
  children,
  bottom,
  tone = "light",
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  children: ReactNode;
  bottom?: ReactNode;
  tone?: "light" | "plain";
}) {
  return (
    <div className="ord-root">
      <div className="ord-col">
        {title ? (
          <header className="ord-topbar ord-safe-top">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 16px",
              }}
            >
              {onBack ? <BackButton onClick={onBack} /> : <span style={{ width: 6 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: C.ink,
                    letterSpacing: "-0.01em",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {title}
                </div>
                {subtitle ? (
                  <div style={{ fontSize: 11.5, color: C.ink3, marginTop: 1 }}>{subtitle}</div>
                ) : null}
              </div>
              {right}
            </div>
          </header>
        ) : null}

        <main
          className={tone === "light" ? "ord-scroll" : undefined}
          style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
        >
          {children}
        </main>

        {bottom}
      </div>
    </div>
  );
}

/** Full-screen panel used for the welcome / success screens. */
export function FullBleed({ children }: { children: ReactNode }) {
  return (
    <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column" }}>
      {children}
    </div>
  );
}
