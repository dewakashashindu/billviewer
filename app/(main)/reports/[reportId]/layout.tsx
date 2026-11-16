import {renderScreenAccess} from '@/lib/screenAccess';
export const dynamic='force-dynamic';
export default async function ReportAccessLayout({children,params}:{children:React.ReactNode;params:Promise<{reportId:string}>}){
  const {reportId}=await params;
  return renderScreenAccess(`report-${reportId}:VIEW`, children);
}
