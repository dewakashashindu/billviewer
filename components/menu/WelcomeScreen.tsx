"use client";

// ============================================================
// LOCATION: components/menu/WelcomeScreen.tsx
// Step 1 — the app's menu_welcome screen (redesigned):
//   • large food photo background (slow drift, like the app's
//     animated background image)
//   • MILA MIRISSA logo badge with a gold ring
//   • welcome text + gold divider + description
//   • table chip + one full-width "Go to Food Menu" pill
//
// Layout note (phone): the screen is 100dvh tall so the pill sits
// inside the *visible* area — no scrolling needed. If a phone is so
// short that the content can't fit, the column simply grows and the
// page scrolls, and the pill is the last item in that flow.
// ============================================================

import type { CSSProperties } from "react";
import { T } from "./theme";

export default function WelcomeScreen({
  table,
  tableGroup,
  takeaway = false,
  onOpenMenu,
  opening,
}: {
  table: string;
  tableGroup?: string;
  /** Takeaway QR — show "Takeaway" instead of a table number. */
  takeaway?: boolean;
  onOpenMenu: () => void;
  opening: boolean;
}) {
  return (
    <div style={s.root}>
      {/* ── big food background + dark overlay (app: BG_IMAGE + 0.72 black) ── */}
      <div style={s.bgWrap} aria-hidden>
        <div style={s.bgImg} className="mnu-bg-drift" />
        <div style={s.bgOverlay} />
        <div style={s.bgGlow} />
        <div style={s.bgGlow2} />
      </div>

      {/* content column: everything is in normal flow, so short phones scroll */}
      <div className="mnu-welcome-col mnu-min-dvh" style={s.inner}>
        <div style={{ ...s.logoWrap, animationDelay: "0.05s" }} className="mnu-anim-up">
          <span style={s.logoRing}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/millamirissa.png" alt="Mila Mirissa" style={s.logoImg} />
          </span>
          <span style={s.logoCaption}>EST. MIRISSA · SRI LANKA</span>
        </div>

        <div style={{ ...s.textBlock, animationDelay: "0.16s" }} className="mnu-anim-up">
          <div style={s.welcome}>Welcome to</div>
          <div style={s.brand}>MILA MIRISSA.</div>
          <div style={s.divider}>
            <span style={s.dividerDot} />
          </div>
          <p style={s.desc}>
            We are delighted to have you here.
            <br />
            Enjoy our freshly prepared dishes crafted with love
            <br />
            and quality ingredients.
            <br />
            <br />
            Sit back, relax, and enjoy your meal!
          </p>
        </div>

        {/* pushes everything below to the bottom of the screen */}
        <div style={s.spacer} />

        <div style={{ ...s.tableTag, animationDelay: "0.26s" }} className="mnu-anim-up">
          {takeaway ? (
            <span style={s.tableChip}>
              <span style={s.tableDot} />
              <b style={{ color: T.gold }}>Takeaway</b>&nbsp;·&nbsp;no table needed
            </span>
          ) : table ? (
            <span style={s.tableChip}>
              <span style={s.tableDot} />
              Table&nbsp;<b style={{ color: T.gold }}>{table}</b>
              {tableGroup ? <>&nbsp;·&nbsp;{tableGroup}</> : null}
            </span>
          ) : (
            <span style={s.tableChip}>No table selected</span>
          )}
        </div>

        <div style={{ ...s.bottom, animationDelay: "0.34s" }} className="mnu-anim-up">
          <button
            type="button"
            style={s.pill}
            className="mnu-tap"
            onClick={onOpenMenu}
            disabled={opening}
          >
            <span style={s.pillLabel}>{opening ? "Loading Menu..." : "Go to Food Menu"}</span>
            <span style={s.arrowCircle}>
              {opening ? (
                <span className="mnu-spinner" style={s.spinner} />
              ) : (
                <span style={s.arrow}>
                  <span style={s.arrowHeadTop} />
                  <span style={s.arrowHeadBottom} />
                </span>
              )}
            </span>
          </button>
          <div style={s.hint}>
            {takeaway
              ? "Browse the menu · pick up your order at the counter"
              : "Browse the menu · order straight from your table"}
          </div>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  root: {
    position: "relative",
    width: "100%",
    background: "#121110",
    overflowX: "hidden",
    display: "flex",
    flexDirection: "column",
  },

  /* background */
  bgWrap: { position: "fixed", inset: 0, overflow: "hidden", zIndex: 0 },
  bgImg: {
    position: "absolute",
    inset: "-5%",
    backgroundImage: "url('/menu-food-bg.jpg')",
    backgroundSize: "cover",
    backgroundPosition: "center 45%",
    backgroundRepeat: "no-repeat",
  },
  bgOverlay: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(180deg, rgba(12,11,10,0.62) 0%, rgba(14,13,12,0.74) 42%, rgba(17,15,13,0.96) 100%)",
  },
  bgGlow: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(60% 42% at 78% 96%, rgba(171,119,60,0.32) 0%, rgba(12,11,10,0) 70%)",
  },
  bgGlow2: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(45% 34% at 12% 6%, rgba(171,119,60,0.16) 0%, rgba(12,11,10,0) 70%)",
  },

  inner: {
    position: "relative",
    zIndex: 1,
    flex: 1,
    width: "100%",
    maxWidth: 760,
    margin: "0 auto",
    padding: "0 24px",
    display: "flex",
    flexDirection: "column",
    /* .mnu-min-dvh = 100dvh, i.e. the height the phone actually shows */
  },

  /* logo */
  logoWrap: { display: "flex", flexDirection: "column", alignItems: "center", marginTop: 52, gap: 14 },
  logoRing: {
    width: 164,
    height: 164,
    borderRadius: "50%",
    padding: 5,
    background: "conic-gradient(from 210deg, rgba(171,119,60,0.95), rgba(171,119,60,0.15), rgba(171,119,60,0.95))",
    boxShadow: "0 22px 50px rgba(0,0,0,0.55), 0 0 0 1px rgba(171,119,60,0.25)",
    display: "inline-flex",
  },
  logoImg: {
    width: "100%",
    height: "100%",
    display: "block",
    borderRadius: "50%",
    border: "4px solid #121110",
    objectFit: "cover",
  },
  logoCaption: { fontSize: 9, letterSpacing: 4, color: "rgba(255,255,255,0.4)", fontWeight: 600 },

  /* text */
  textBlock: { marginTop: 40, textAlign: "center" },
  welcome: { color: "rgba(171,119,60,0.95)", fontSize: 19, fontWeight: 600, letterSpacing: 0.4 },
  brand: { color: T.white, fontSize: 36, fontWeight: 700, marginTop: 6, letterSpacing: 0.5 },
  divider: {
    height: 3,
    width: 211,
    background: "linear-gradient(90deg, rgba(171,119,60,0), rgba(171,119,60,0.85), rgba(171,119,60,0))",
    borderRadius: 2,
    margin: "12px auto 0",
    position: "relative",
  },
  dividerDot: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 9,
    height: 9,
    borderRadius: "50%",
    background: T.gold,
    transform: "translate(-50%, -50%)",
    boxShadow: "0 0 10px rgba(171,119,60,0.9)",
  },
  desc: { color: "rgba(255,255,255,0.9)", fontWeight: 300, fontSize: 13, lineHeight: 1.85, marginTop: 18 },

  spacer: { flex: 1, minHeight: 36 },

  tableTag: { display: "flex", justifyContent: "center", paddingBottom: 14 },
  tableChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 16px",
    borderRadius: 20,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.55)",
    fontSize: 12.5,
    backdropFilter: "blur(6px)",
  },
  tableDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: T.green,
    boxShadow: "0 0 8px rgba(61,140,94,0.9)",
  },

  bottom: { paddingBottom: "calc(22px + env(safe-area-inset-bottom, 0px))" },
  pill: {
    width: "100%",
    height: 58,
    borderRadius: 29,
    background: "linear-gradient(180deg, rgba(186,131,66,0.98) 0%, rgba(171,119,60,0.94) 100%)",
    border: "1px solid rgba(255,255,255,0.14)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 10px 0 26px",
    cursor: "pointer",
    boxShadow: "0 12px 30px rgba(171,119,60,0.38), inset 0 1px 0 rgba(255,255,255,0.18)",
  },
  pillLabel: { color: T.white, fontWeight: 700, fontSize: 17, letterSpacing: 0.2 },
  arrowCircle: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.16)",
    border: "1px solid rgba(255,255,255,0.18)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  arrow: { position: "relative", width: 16, height: 2, background: T.white, borderRadius: 1 },
  arrowHeadTop: {
    position: "absolute",
    right: 0,
    top: -4,
    width: 9,
    height: 2,
    background: T.white,
    borderRadius: 1,
    transform: "rotate(40deg)",
  },
  arrowHeadBottom: {
    position: "absolute",
    right: 0,
    bottom: -4,
    width: 9,
    height: 2,
    background: T.white,
    borderRadius: 1,
    transform: "rotate(-40deg)",
  },
  spinner: {
    width: 16,
    height: 16,
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.35)",
    borderTopColor: T.white,
    display: "inline-block",
  },
  hint: { textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 12, letterSpacing: 0.3 },
};
