import AdminTypography from '@/components/AdminTypography';
import UserCreationPanel from "@/components/UserCreationPanel";

export const dynamic = "force-dynamic";

export default function UserCreationPage() {
  return <AdminTypography><UserCreationPanel /></AdminTypography>;
}
