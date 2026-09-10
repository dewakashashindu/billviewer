// ============================================================
// LOCATION: app/login/page.tsx
// ALUTH FILE — mekamama create karanna
// Login page — session thiyenawam /dashboard ekata redirect
// ============================================================
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSessionFromRequest } from "@/lib/session";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getSessionFromRequest();
  if (user) redirect("/dashboard");
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
