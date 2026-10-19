// ============================================================
// LOCATION: config/qr.config.ts
// Table QR cards — fixed settings.
//
// The customer-menu base URL is HARDCODED here on purpose:
//   • the QR screen must never show (or let staff edit) the URL
//   • every printed card points at the same deployed menu
// Deploying to a new domain = edit QR_MENU_BASE_URL + redeploy.
//
// The scanned link looks like:  <QR_MENU_BASE_URL>?id=<encrypted>
// Nothing readable (no table number, no group) is in the URL.
// ============================================================

/** Deployed customer menu page (QR scans land here). */
export const QR_MENU_BASE_URL =
  "https://milamirissa-001-site1.htempurl.com/menu";

/** Card size limits / defaults, in inches. */
export const QR_CARD_SIZE = {
  min: 1.5,
  max: 10,
  defaultWidth: 3.5,
  defaultHeight: 2.2,
} as const;

/** One-click card sizes, in inches. */
export const QR_CARD_PRESETS = [
  { label: "Badge 3.5 × 2.2", width: 3.5, height: 2.2 },
  { label: "Square 3 × 3", width: 3, height: 3 },
  { label: "Tent 4 × 3", width: 4, height: 3 },
  { label: "A6 5.8 × 4.1", width: 5.8, height: 4.1 },
] as const;

/** Print resolution used for PNG / PDF export. */
export const QR_EXPORT_DPI = 300;
