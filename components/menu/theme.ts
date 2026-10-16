// ============================================================
// LOCATION: components/menu/theme.ts
// Customer menu theme tokens — the SAME dark + gold palette the
// Expo app uses (#1B1B1B / #AB773C) so the web menu looks like
// the app the guests already know.
//
// Want the cream/brown site theme instead? Change these values —
// every menu component reads from here.
// ============================================================

export const T = {
  bg: "#1B1B1B",
  surface: "#242424",
  card: "#2A2A2A",
  card2: "#333333",
  cardDeep: "#1E1E1E",
  line: "rgba(255,255,255,0.08)",

  gold: "#AB773C",
  gold90: "rgba(171,119,60,0.9)",
  goldSoft: "rgba(171,119,60,0.15)",
  goldLine: "rgba(171,119,60,0.40)",

  white: "#FFFFFF",
  w92: "rgba(255,255,255,0.92)",
  w72: "rgba(255,255,255,0.72)",
  w55: "rgba(255,255,255,0.55)",
  w40: "rgba(255,255,255,0.40)",
  w25: "rgba(255,255,255,0.25)",

  green: "#3D8C5E",
  greenSoft: "rgba(61,140,94,0.18)",
  red: "#E05252",
  redSoft: "rgba(224,82,82,0.12)",

  font: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',

  rSm: 10,
  rMd: 14,
  rLg: 18,
  rXl: 24,

  shadowGold: "0 6px 18px rgba(171,119,60,0.45)",
  shadowGreen: "0 6px 18px rgba(61,140,94,0.35)",
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
