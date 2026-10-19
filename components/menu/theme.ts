// ============================================================
// LOCATION: components/menu/theme.ts
// Customer menu theme tokens — "Midnight": warm near-black
// surfaces stepping up to a bone-white ink and a single brand
// gold. Every menu component reads from this file, so changing
// these values restyles the whole flow at once.
//
// Want the cream/brown site theme instead? Swap the surface + ink
// values below (bg #FBF6EF, surface #FFFFFF, card #F7EFE4,
// ink #2B2117, gold #A46F38) — no component changes needed.
// ============================================================

export const T = {
  /* ── surfaces (Midnight) ────────────────────────────────────
     Depth = steps, not shadows: bg → surface → card → card2 */
  bg: "#14100D",
  surface: "#211B15",
  card: "#2A231B",
  card2: "#332A21",
  cardDeep: "#1B1712",
  line: "rgba(255,246,234,0.10)",
  lineStrong: "rgba(255,246,234,0.18)",

  /* ── brand gold ──────────────────────────────────────────── */
  gold: "#D9A463",
  gold2: "#F2CB95",
  gold90: "rgba(217,164,99,0.90)",
  goldSoft: "rgba(217,164,99,0.14)",
  goldLine: "rgba(217,164,99,0.40)",
  goldGrad: "linear-gradient(160deg, #F2CB95 0%, #D9A463 100%)",
  goldInk: "#1D150D",

  /* ── ink (warm white, not pure #FFF) ─────────────────────── */
  white: "#FFFFFF",
  ink: "#F7EEE3",
  w92: "rgba(247,238,227,0.92)",
  w72: "rgba(247,238,227,0.72)",
  w55: "rgba(247,238,227,0.55)",
  w40: "rgba(247,238,227,0.40)",
  w25: "rgba(247,238,227,0.25)",

  /* ── states ──────────────────────────────────────────────── */
  green: "#6FD39A",
  greenSoft: "rgba(111,211,154,0.14)",
  red: "#FF8F8F",
  redSoft: "rgba(255,143,143,0.12)",

  /* ── hero image scrim ────────────────────────────────────── */
  heroScrim:
    "linear-gradient(90deg, rgba(14,11,8,0.94) 6%, rgba(14,11,8,0.68) 46%, rgba(14,11,8,0.14) 88%), linear-gradient(180deg, rgba(14,11,8,0.25), rgba(14,11,8,0.55))",

  font: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',

  rSm: 10,
  rMd: 14,
  rLg: 18,
  rXl: 24,

  shadowGold: "0 10px 26px rgba(217,164,99,0.30)",
  shadowGreen: "0 6px 18px rgba(111,211,154,0.28)",
  shadowLift: "0 2px 6px rgba(0,0,0,0.18), 0 14px 34px rgba(0,0,0,0.30)",
} as const;

/** Category code → tab label (raw POS categories are codes like "F"). */
export const CATEGORY_LABELS: Record<string, string> = {
  F: "FOOD",
  FOOD: "FOOD",
  B: "BEVERAGE",
  BEVERAGE: "BEVERAGE",
  D: "DESSERT",
  DES: "DESSERT",
  DESSERT: "DESSERT",
  S: "SOUP",
  SOUP: "SOUP",
  O: "OTHER",
  OTHER: "OTHER",
};

const CATEGORY_ORDER = [
  "FOOD", "BEVERAGE", "DESSERT", "SOUP", "OTHER",
];

export function categoryLabel(code: string): string {
  const key = (code || "").trim().toUpperCase();
  return CATEGORY_LABELS[key] ?? (key || "OTHER");
}

export function categoryRank(label: string): number {
  const i = CATEGORY_ORDER.indexOf(label);
  return i === -1 ? CATEGORY_ORDER.length : i;
}

/** No photo in the POS → a friendly emoji instead of a broken image. */
const EMOJI_RULES: { match: RegExp; emoji: string }[] = [
  { match: /kottu|roti/i, emoji: "🍜" },
  { match: /fried rice|biriyani|biryan|nasi|chopsuey|rice/i, emoji: "🍚" },
  { match: /noodle|spaghet|pasta/i, emoji: "🍝" },
  { match: /prawn|cuttle|fish|seafood|platter|crab|squid/i, emoji: "🦐" },
  { match: /chicken|devilled|chilli chicken/i, emoji: "🍗" },
  { match: /beef|pork|lamb|mutton/i, emoji: "🥩" },
  { match: /salad|greens/i, emoji: "🥗" },
  { match: /juice|lime|mango|orange|smoothie/i, emoji: "🍹" },
  { match: /coffee|latte|espresso|cappuccino/i, emoji: "☕" },
  { match: /tea/i, emoji: "🍵" },
  { match: /soda|cola|soft|bottle|water|king coconut|thambili/i, emoji: "🥤" },
  { match: /ice ?cream|kulfi/i, emoji: "🍨" },
  { match: /watalappan|pudding|sweet|cake|dessert/i, emoji: "🍮" },
  { match: /roti|naan|paratha|sandwich|burger/i, emoji: "🥪" },
  { match: /soup/i, emoji: "🍲" },
  { match: /egg|omelette|hoppers|string hopper/i, emoji: "🍳" },
];

export function itemEmoji(name: string): string {
  for (const r of EMOJI_RULES) if (r.match.test(name)) return r.emoji;
  return "🍽️";
}

export const formatPrice = (n: number): string =>
  `Rs. ${Number(n || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** Compact "Rs. 1,600" for tight cards */
export const formatPriceShort = (n: number): string =>
  `Rs. ${Math.round(Number(n || 0)).toLocaleString("en-LK")}`;
