import ScreenAccess from '@/components/ScreenAccess';
import AdminTypography from '@/components/AdminTypography';
import UserGroupsWorkspace from '@/components/UserGroupsWorkspace';
export const dynamic='force-dynamic';
export default function UserGroupsPage(){return <ScreenAccess permission="groups:VIEW"><AdminTypography><UserGroupsWorkspace/></AdminTypography></ScreenAccess>}
