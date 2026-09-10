"use client";

// ============================================================
// LOCATION: components/reports/ReportIcons.tsx
// ALUTH FILE — mekamama create karanna
//
// Professional stroke SVG icon set (Lucide-style) for report UI.
// Emoji wenuwata meka use wenawa — hariyatama render wenawa
// (font/OS dependency naha), consistent stroke style ekai.
// ============================================================
import type { CSSProperties, ReactNode } from "react";

export interface IconProps {
  size?: number;
  style?: CSSProperties;
  strokeWidth?: number;
  className?: string;
}

function makeIcon(paths: ReactNode, displayName: string) {
  function Icon({
    size = 16,
    style,
    strokeWidth = 2,
    className,
  }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={style}
        className={className}
        aria-hidden="true"
        focusable="false"
      >
        {paths}
      </svg>
    );
  }
  Icon.displayName = displayName;
  return Icon;
}

/* ── Search (magnifier) ── */
export const IconSearch = makeIcon(
  <>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </>,
  "IconSearch"
);

/* ── Calendar ── */
export const IconCalendar = makeIcon(
  <>
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M3 10h18" />
  </>,
  "IconCalendar"
);

/* ── Map pin (location groups) ── */
export const IconPin = makeIcon(
  <>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </>,
  "IconPin"
);

/* ── Minus ── */
export const IconMinus = makeIcon(<path d="M5 12h14" />, "IconMinus");

/* ── Plus ── */
export const IconPlus = makeIcon(
  <>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </>,
  "IconPlus"
);

/* ── Bar chart (chart toggle) ── */
export const IconBarChart = makeIcon(
  <>
    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </>,
  "IconBarChart"
);

/* ── Table (table view) ── */
export const IconTable = makeIcon(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18" />
    <path d="M3 15h18" />
    <path d="M9 3v18" />
  </>,
  "IconTable"
);

/* ── Share (network nodes) ── */
export const IconShare = makeIcon(
  <>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="m8.6 13.5 6.8 4" />
    <path d="m15.4 6.5-6.8 4" />
  </>,
  "IconShare"
);

/* ── Download (arrow into tray) ── */
export const IconDownload = makeIcon(
  <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m7 10 5 5 5-5" />
    <path d="M12 15V3" />
  </>,
  "IconDownload"
);

/* ── File / report ── */
export const IconFileText = makeIcon(
  <>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M10 9H8" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
  </>,
  "IconFileText"
);

/* ── Chat bubble (WhatsApp) ── */
export const IconChat = makeIcon(
  <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
  "IconChat"
);

/* ── Mail ── */
export const IconMail = makeIcon(
  <>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </>,
  "IconMail"
);

/* ── Smartphone (device share) ── */
export const IconPhone = makeIcon(
  <>
    <rect x="5" y="2" width="14" height="20" rx="2" />
    <path d="M12 18h.01" />
  </>,
  "IconPhone"
);

/* ── Link (copy link) ── */
export const IconLink = makeIcon(
  <>
    <path d="M9 17H7A5 5 0 0 1 7 7h2" />
    <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
    <path d="M8 12h8" />
  </>,
  "IconLink"
);

/* ── Check ── */
export const IconCheck = makeIcon(
  <path d="M20 6 9 17l-5-5" />,
  "IconCheck"
);

/* ── Coins (grand total) ── */
export const IconCoins = makeIcon(
  <>
    <circle cx="8" cy="8" r="6" />
    <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
    <path d="M7 6h1v4" />
    <path d="m16.71 13.88.7.71-2.82 2.82" />
  </>,
  "IconCoins"
);

/* ── Receipt (bills) ── */
export const IconReceipt = makeIcon(
  <>
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
    <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
    <path d="M12 17.5v-11" />
  </>,
  "IconReceipt"
);

/* ── Trending up (average) ── */
export const IconTrendingUp = makeIcon(
  <>
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </>,
  "IconTrendingUp"
);

/* ── Trophy (best day) ── */
export const IconTrophy = makeIcon(
  <>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </>,
  "IconTrophy"
);

/* ── Sort indicators ── */
export const IconChevronUp = makeIcon(
  <path d="m18 15-6-6-6 6" />,
  "IconChevronUp"
);
export const IconChevronDown = makeIcon(
  <path d="m6 9 6 6 6-6" />,
  "IconChevronDown"
);
export const IconChevronsUpDown = makeIcon(
  <>
    <path d="m7 15 5 5 5-5" />
    <path d="m7 9 5-5 5 5" />
  </>,
  "IconChevronsUpDown"
);

/* ── Empty state (inbox) ── */
export const IconInbox = makeIcon(
  <>
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </>,
  "IconInbox"
);
