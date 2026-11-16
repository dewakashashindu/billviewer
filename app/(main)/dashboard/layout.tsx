import {renderScreenAccess} from '@/lib/screenAccess';
export const dynamic = 'force-dynamic';
export default async function DashboardAccessLayout({children}:{children:React.ReactNode}) {
  return renderScreenAccess('dashboard:VIEW', children);
}
