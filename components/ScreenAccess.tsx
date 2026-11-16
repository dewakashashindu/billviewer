import type {ReactNode} from 'react';
import {renderScreenAccess} from '@/lib/screenAccess';
export default async function ScreenAccess({permission,children}:{permission:string;children:ReactNode}){
  return renderScreenAccess(permission, children);
}
