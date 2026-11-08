import ScreenAccess from '@/components/ScreenAccess';
import AdminTypography from '@/components/AdminTypography';
import WebAccessWorkspace from '@/components/WebAccessWorkspace';
export const dynamic='force-dynamic';
export default function Page(){return <ScreenAccess permission="assign:VIEW"><AdminTypography><WebAccessWorkspace mode="assign"/></AdminTypography></ScreenAccess>}
