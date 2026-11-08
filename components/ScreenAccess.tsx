import {getSessionFromRequest} from '@/lib/session';
import {requireWebPermission,AccessDeniedError} from '@/lib/webAuthorization';
import type {ReactNode} from 'react';
export default async function ScreenAccess({permission,children}:{permission:string;children:ReactNode}){
 try {const session=await getSessionFromRequest();if(!session)throw new AccessDeniedError();await requireWebPermission(session,permission);return <>{children}</>}
 catch(error){if(!(error instanceof AccessDeniedError))console.error('Screen authorization unavailable:',error);return <main style={{padding:32}}><h1>Access denied</h1><p>Access to this screen is not assigned, or authorization is unavailable.</p></main>}
}
