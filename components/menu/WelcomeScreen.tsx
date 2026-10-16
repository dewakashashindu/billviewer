"use client";

// ============================================================
// LOCATION: components/menu/WelcomeScreen.tsx
// Step 1 — the app's menu_welcome screen:
//   • large food photo background (slow drift, like the app's
//     animated background image)
//   • MILA MIRISSA logo badge
//   • welcome text + gold divider + description
//   • one full-width "Go to Food Menu" pill (no home circle)
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
  onOpenMenu,
  opening,
}: {
  table: string;
  tableGroup?: string;
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
      </div>

      {/* content column: everything is in normal flow, so short phones scroll */}
      <div className="mnu-welcome-col mnu-min-dvh" style={s.inner}>
        <div style={s.logoWrap} className="mnu-anim-pop">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/millamirissa.png" alt="Mila Mirissa" style={s.logoImg} />
        </div>

        <div style={s.textBlock}>
          <div style={s.welcome}>Welcome to</div>
          <div style={s.brand}>MILA MIRISSA.</div>
          <div style={s.divider} />
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

        <div style={s.tableTag}>
          {table ? (
            <>
              Table&nbsp;<b style={{ color: T.gold }}>{table}</b>
              {tableGroup ? <>&nbsp;·&nbsp;{tableGroup}</> : null}
            </>
          ) : (
            "No table selected"
          )}
        </div>

        <div style={s.bottom}>
          <button type="button" style={s.pill} onClick={onOpenMenu} disabled={opening}>
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
      "linear-gradient(180deg, rgba(12,11,10,0.58) 0%, rgba(14,13,12,0.72) 42%, rgba(17,15,13,0.94) 100%)",
  },
  bgGlow: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(60% 42% at 78% 96%, rgba(171,119,60,0.30) 0%, rgba(12,11,10,0) 70%)",
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
  logoWrap: { display: "flex", justifyContent: "center", marginTop: 46 },
  logoImg: {
    width: 148,
    height: 148,
    display: "block",
    borderRadius: "50%",
    boxShadow: "0 18px 44px rgba(0,0,0,0.55)",
  },

  /* text */
  textBlock: { marginTop: 46 },
  welcome: { color: "rgba(171,119,60,0.92)", fontSize: 20 },
  brand: { color: T.white, fontSize: 34, fontWeight: 600, marginTop: 4 },
  divider: { height: 3, width: 211, background: "rgba(171,119,60,0.79)", borderRadius: 2, marginTop: 8 },
  desc: { color: "rgba(255,255,255,0.92)", fontWeight: 300, fontSize: 12.5, lineHeight: 1.8, marginTop: 16 },

  spacer: { flex: 1, minHeight: 40 },

  tableTag: {
    textAlign: "center",
    color: "rgba(255,255,255,0.42)",
    fontSize: 12,
    paddingBottom: 12,
  },

  bottom: { paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))" },
  pill: {
    width: "100%",
    height: 56,
    borderRadius: 28,
    background: "rgba(171,119,60,0.90)",
    border: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 10px 0 24px",
    cursor: "pointer",
    boxShadow: "0 10px 26px rgba(171,119,60,0.34)",
  },
  pillLabel: { color: T.white, fontWeight: 700, fontSize: 17 },
  arrowCircle: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.15)",
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
};
