import AppShell from "@/components/AppShell";

// Reporting side eke shell — sidebar + white content area.
// (Bill viewer pages me route group eken pitipassa thiyenawa nisa
//  /bill saha / pages walata sidebar pennanne naha)
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
