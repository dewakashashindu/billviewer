import ScreenAccess from '@/components/ScreenAccess';
import VoidApproval from '@/components/VoidApproval';
export const dynamic='force-dynamic';
export default function Page(){return <ScreenAccess permission="void-approval:VIEW"><VoidApproval/></ScreenAccess>}
