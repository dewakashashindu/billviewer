// ============================================================
// LOCATION: app/(main)/layout.tsx
// Auth guard — /dashboard, /reports/*, /settings okkoma
// login nokaralu → /login?next=<path> ekata redirect.
// NOTE: middleware eken karanna beri (edge runtime eke node:crypto
// nathi nisa) server-component guard eka methanama.
// /bill SAHA / PAGES ME LAYOUT EKEN PITA — PUBLIC.
// ============================================================
import { redirect } from "next/navigation";
import { getSessionFromRequest } from "@/lib/session";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionFromRequest();
  if (!session) {
    // (middleware nathi nisa layout ekenma redirect — next param eka
    //  login wenikam pase yanawa)
    redirect("/login");
  }
  return <AppShell>{children}</AppShell>;
}
