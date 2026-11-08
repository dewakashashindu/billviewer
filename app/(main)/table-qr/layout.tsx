import ScreenAccess from '@/components/ScreenAccess';
import type {ReactNode} from 'react';
export const dynamic='force-dynamic';
export default function Layout({children}:{children:ReactNode}){return <ScreenAccess permission="tableqr:VIEW">{children}</ScreenAccess>}
