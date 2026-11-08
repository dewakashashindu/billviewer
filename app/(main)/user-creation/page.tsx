import ScreenAccess from '@/components/ScreenAccess';
import AdminTypography from '@/components/AdminTypography';
import UserCreationPanel from "@/components/UserCreationPanel";

export const dynamic = "force-dynamic";

export default function UserCreationPage() {
  return <ScreenAccess permission="users:VIEW"><AdminTypography><UserCreationPanel /></AdminTypography></ScreenAccess>;
}
