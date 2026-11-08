'use client';
import {createContext,useContext,type ReactNode} from 'react';
export const WebPermissionsContext=createContext<string[]>([]);
export function PermissionGate({permission,children}:{permission:string;children:ReactNode}){
 const permissions=useContext(WebPermissionsContext);
 return permissions.includes(permission)?<>{children}</>:null;
}
