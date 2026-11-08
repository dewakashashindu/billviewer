import ScreenAccess from '@/components/ScreenAccess';
import UserCreationPanel from "@/components/UserCreationPanel";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return <ScreenAccess permission="users:VIEW"><UserCreationPanel /></ScreenAccess>;
}
