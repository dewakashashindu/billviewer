// ============================================================
// LOCATION: components/order/theme.ts
// Design tokens for the customer QR ordering flow (/order).
//
// The palette is the Mila Mirissa "Cream Classic" identity that
// the rest of the site uses (bill page, table-QR screen):
//   cream paper + deep coffee brown + warm gold.
// Everything is mobile-first — the phone is the target device,
// the desktop just centres the column.
// ============================================================

export const C = {
  /* surfaces */
  bg: "#FBF6F0",
  bgDeep: "#F3E8DA",
  surface: "#FFFFFF",
  surfaceAlt: "#FDF8F2",
  surfaceWarm: "#F7EFE3",

  /* lines */
  line: "#EFE3D4",
  lineSoft: "#F6EEE3",
  lineStrong: "#DFCDB4",

  /* brand */
  primary: "#5E3D26",
  primarySoft: "#7B5436",
  primaryTint: "rgba(94,61,38,0.07)",
  gold: "#C08A4E",
  goldDeep: "#A9743C",
  goldTint: "rgba(192,138,78,0.13)",
  goldLine: "rgba(192,138,78,0.35)",

  /* text */
  ink: "#2A1D14",
  ink2: "#6E5B4B",
  ink3: "#A38F7C",
  inkOnDark: "#FFF9F2",
  inkOnDarkSoft: "rgba(255,249,242,0.72)",

  /* feedback */
  green: "#3E7A55",
  greenTint: "rgba(62,122,85,0.12)",
  red: "#C2503F",
  redTint: "rgba(194,80,63,0.10)",
  amber: "#B5822E",

  /* effects */
  shadowSm: "0 2px 8px rgba(94,61,38,0.06)",
  shadowMd: "0 8px 24px rgba(94,61,38,0.10)",
  shadowLg: "0 18px 44px rgba(94,61,38,0.16)",
  shadowGold: "0 10px 26px rgba(169,116,60,0.28)",

  /* radii */
  rSm: 10,
  rMd: 14,
  rLg: 20,
  rXl: 28,
  rPill: 999,

  font: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
} as const;

/** Money format — "Rs. 1,600.00" */
export const money = (n: number): string =>
  `Rs. ${Number(n || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** Compact money format for tight cards — "Rs. 1,600" */
export const moneyShort = (n: number): string =>
  `Rs. ${Math.round(Number(n || 0)).toLocaleString("en-LK")}`;

/**
 * Time-of-day greeting for the welcome screen.
 * The browser clock is used (the guest's own timezone), which is
 * what feels natural to them.
 */
export function greeting(date = new Date()): {
  title: string;
  line: string;
} {
  const h = date.getHours();
  if (h < 5)
    return {
      title: "Good night",
      line: "We are open late — take your time.",
    };
  if (h < 12)
    return {
      title: "Good morning",
      line: "Freshly brewed, freshly cooked.",
    };
  if (h < 17)
    return {
      title: "Good afternoon",
      line: "A little treat goes a long way.",
    };
  if (h < 21)
    return {
      title: "Good evening",
      line: "Dinner is served — sit back and relax.",
    };
  return {
    title: "Good night",
    line: "One last plate before we close.",
  };
}

/** Small emoji for items without a photo in the POS. */
const EMOJI_RULES: { match: RegExp; emoji: string }[] = [
  { match: /kottu|roti|naan|paratha/i, emoji: "🍜" },
  { match: /fried rice|biriyani|biryan|nasi|chopsuey|rice/i, emoji: "🍚" },
  { match: /noodle|spaghet|pasta/i, emoji: "🍝" },
  { match: /prawn|cuttle|fish|seafood|platter|crab|squid/i, emoji: "🦐" },
  { match: /chicken|devilled/i, emoji: "🍗" },
  { match: /beef|pork|lamb|mutton/i, emoji: "🥩" },
  { match: /salad|greens/i, emoji: "🥗" },
  { match: /juice|lime|mango|orange|smoothie/i, emoji: "🍹" },
  { match: /coffee|latte|espresso|cappuccino/i, emoji: "☕" },
  { match: /tea/i, emoji: "🍵" },
  { match: /soda|cola|soft|bottle|water|coconut|thambili/i, emoji: "🥤" },
  { match: /ice ?cream|kulfi/i, emoji: "🍨" },
  { match: /watalappan|pudding|sweet|cake|dessert/i, emoji: "🍮" },
  { match: /curry|dhal|daal/i, emoji: "🍛" },
  { match: /soup/i, emoji: "🍲" },
  { match: /egg|omelette|hopper/i, emoji: "🍳" },
  { match: /juice|lassi|milk/i, emoji: "🥛" },
];

export function itemEmoji(name: string): string {
  for (const r of EMOJI_RULES) if (r.match.test(name)) return r.emoji;
  return "🍽️";
}
