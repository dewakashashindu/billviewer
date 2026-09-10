// ============================================================
// LOCATION: app/login/forgot/page.tsx
// ALUTH FILE — mekamama create karanna
// Forgot password — session thiyenawam /dashboard ekata redirect
// ============================================================
import { redirect } from "next/navigation";
import { getSessionFromRequest } from "@/lib/session";
import ForgotForm from "./ForgotForm";

export const dynamic = "force-dynamic";

export default async function ForgotPage() {
  const user = await getSessionFromRequest();
  if (user) redirect("/dashboard");
  return <ForgotForm />;
}
