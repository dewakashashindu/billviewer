// ============================================================
// LOCATION: components/menu/groupImages.ts
// Circle photo for a category / group card.
//
// Order of preference:
//   1. the real POS photo (`ItemPicMob`, comes down as item.imageUrl)
//      — the group card already uses that when it exists
//   2. a local photo in /public/menu-groups/ picked by group name
//   3. /menu-placeholder.png (the house platter) so a card never
//      falls back to a bare emoji
//
// Switching the local set: drop your own square JPGs into
// public/menu-groups/ with the same file names (320×320 looks best)
// and they win automatically — no code change needed.
// ============================================================

export const GROUP_PHOTO_DIR = "/menu-groups";

/** exact group-name → file (name is lower-cased + trimmed) */
const BY_NAME: Record<string, string> = {
  // mains / curries
  mains: "mains",
  main: "mains",
  "main course": "mains",
  curry: "curry",
  curries: "curry",
  indian: "curry",
  "indian food": "curry",
  "sri lankan": "curry",
  "rice and curry": "curry",
  "rice & curry": "curry",
  // rice
  rice: "rice",
  biriyani: "rice",
  biryani: "rice",
  "fried rice": "fried-rice",
  // chinese / kottu / noodles
  chinese: "fried-rice",
  kottu: "fried-rice",
  noodles: "fried-rice",
  noodle: "fried-rice",
  // seafood / grill
  seafood: "seafood",
  "sea food": "seafood",
  fish: "seafood",
  grill: "seafood",
  grills: "seafood",
  bbq: "seafood",
  // starters / short eats
  starters: "starters",
  starter: "starters",
  "short eats": "starters",
  "short eat": "starters",
  hot: "starters",
  spicy: "starters",
  devilled: "starters",
  // breads
  roti: "roti",
  bread: "roti",
  breads: "roti",
  naan: "roti",
  paratha: "roti",
  // sides / veg
  soup: "dal",
  soups: "dal",
  dal: "dal",
  dhal: "dal",
  sides: "dal",
  side: "dal",
  salad: "moju",
  salads: "moju",
  veg: "moju",
  vegetable: "moju",
  vegetables: "moju",
  vegetarian: "moju",
  // drinks
  drinks: "drinks",
  drink: "drinks",
  beverage: "drinks",
  beverages: "drinks",
  juice: "drinks",
  juices: "drinks",
  coffee: "drinks",
  tea: "drinks",
  mocktails: "drinks",
  cocktails: "drinks",
  // desserts
  desserts: "desserts",
  dessert: "desserts",
  sweets: "desserts",
  sweet: "desserts",
  ice: "desserts",
  "ice cream": "desserts",
  pudding: "desserts",
};

/** Dish-level hints — checked BEFORE the group-level ones so
 *  "Chicken Fried Rice" never borrows the plain-rice photo. */
const BY_DISH: Array<[RegExp, string]> = [
  [/fried rice|nasi goreng|biriyani|biryani|kottu|noodle|chop ?suey|mongolian/i, "fried-rice"],
  [/kottu roti|godamba roti/i, "roti"],
  [/devilled|devil|hot butter|chilli|chili|bbq|b\.?b\.?q|grill/i, "starters"],
  [/prawn|crab|squid|cuttle|seafood|fish/i, "seafood"],
  [/watalappan|curd|pudding|ice ?cream|dessert/i, "desserts"],
  [/juice|mojito|lassi|coffee|tea|cola|soda|water/i, "drinks"],
  [/soup|dal|dhal/i, "dal"],
  [/salad|moju|vegetable|veg/i, "moju"],
  [/curry|masala|chicken|beef|pork|lamb|mutton/i, "curry"],
];

/** free-text fallback when the group name is something we don't know */
const BY_KEYWORD: Array<[RegExp, string]> = [
  [/fried rice|nasi goreng|kottu|noodle|chinese|chop ?suey|mongolian/i, "fried-rice"],
  [/rice|biriyani|biryani/i, "rice"],
  [/sea ?food|fish|prawn|cut(t)?le|crab|squid|grill|bbq|b.?b.?q/i, "seafood"],
  [/roti|bread|naan|paratha|godamba/i, "roti"],
  [/dessert|sweet|pudding|ice ?cream|watalappan|curd/i, "desserts"],
  [/drink|beverage|juice|coffee|tea|mocktail|cocktail|lassi|mojito|soda|water/i, "drinks"],
  [/soup|dal|dhal|side/i, "dal"],
  [/veg|veget|salad|green|moju|brinjal|potato/i, "moju"],
  [/starter|short ?eat|hot butter|devil|chilli|chili|spicy|bite/i, "starters"],
  [/curry|mains?|indian|sri ?lanka|mixed rice/i, "curry"],
];

/**
 * Photo for ONE dish. Used when the POS has no image for the item:
 * the dish name is matched first, then the group/sub-group name, and
 * the house platter is the last resort. Never returns "".
 */
export function dishPhoto(
  itemName: string,
  ...groupNames: Array<string | null | undefined>
): string {
  const key = (itemName ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (key) {
    for (const [re, file] of BY_DISH) {
      if (re.test(key)) return `${GROUP_PHOTO_DIR}/${file}.jpg`;
    }
  }
  return groupPhoto(itemName, ...groupNames);
}

/**
 * Local circle photo for a group name, e.g. "Main Dining" → "/menu-groups/….jpg".
 * Never returns an empty string — the generic platter is the last resort.
 */
export function groupPhoto(...names: Array<string | null | undefined>): string {
  for (const raw of names) {
    const name = (raw ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase().replace(/\s+/g, " ");

    const exact = BY_NAME[key];
    if (exact) return `${GROUP_PHOTO_DIR}/${exact}.jpg`;

    for (const [re, file] of BY_KEYWORD) {
      if (re.test(key)) return `${GROUP_PHOTO_DIR}/${file}.jpg`;
    }
  }
  return "/menu-placeholder.png";
}

/** POS photo if the dining room has one, otherwise the local one */
export function groupCircleImage(
  posImage: string | null | undefined,
  ...names: Array<string | null | undefined>
): string {
  return (posImage ?? "").trim() || groupPhoto(...names);
}
