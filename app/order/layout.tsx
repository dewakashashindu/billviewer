// ============================================================
// LOCATION: app/order/layout.tsx
// The customer QR ordering flow — a phone-first, standalone
// shell (no admin sidebar, no auth guard).
//
//   /order          → welcome (table + greeting)
//   /order/menu     → browse + search + add to cart
//   /order/cart     → review, special requests, place order
//   /order/success  → order received
// ============================================================
import type { Metadata, Viewport } from "next";
import "./order.css";

export const metadata: Metadata = {
  title: "Mila Mirissa — Order",
  description: "Browse the menu and order from your table",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#FBF6F0",
};

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  // Each screen renders its own `.ord-root` shell — no extra
  // wrapper here, or the column height would be doubled.
  return <>{children}</>;
}
