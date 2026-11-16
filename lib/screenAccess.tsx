import 'server-only';
import type {ReactNode} from 'react';
import {redirect} from 'next/navigation';
import {getSessionFromRequest} from '@/lib/session';
import {loadWebAuthorization} from '@/lib/webAuthorization';
import {REPORT_ACCESS_SCREENS} from '@/lib/reportAccessCatalog';

// Only fixed, server-controlled destinations may be selected. Each destination
// corresponds to the same VIEW permission enforced by its own page.
const destinations: readonly [string,string][] = [
  ['dashboard:VIEW','/dashboard'], ['void-approval:VIEW','/billing-control/void-approval'],
  ['locations:VIEW','/inventory/locations'], ['categories:VIEW','/inventory/categories'],
  ['items:VIEW','/inventory/items'], ['units:VIEW','/inventory/units'], ['suppliers:VIEW','/inventory/suppliers'],
  ['po:VIEW','/inventory/po'], ['grn:VIEW','/inventory/grn'], ['srn:VIEW','/inventory/srn'],
  ['damage:VIEW','/inventory/damage'], ['trq:VIEW','/inventory/transfer-requisition'],
  ['tn:VIEW','/inventory/transfer-note'], ['tr:VIEW','/inventory/transfer-return'],
  ['irq:VIEW','/inventory/issue-requisition'], ['inn:VIEW','/inventory/issue-note'],
  ['recon:VIEW','/inventory/stock-reconciliation'],
  ...REPORT_ACCESS_SCREENS.map(report => [`${report.id}:VIEW`, `/reports/${report.id.slice('report-'.length)}`] as [string,string]),
  ['groups:VIEW','/settings/user-groups'], ['users:VIEW','/user-creation'],
  ['profiles:VIEW','/settings/access-profiles'], ['assign:VIEW','/settings/assign-profiles'],
  ['tableqr:VIEW','/table-qr'],
];
export function firstAccessiblePage(permissions:Set<string>):string|null {
  return destinations.find(([permission]) => permissions.has(permission))?.[1] ?? null;
}
export async function renderScreenAccess(permission:string, children:ReactNode) {
  const session = await getSessionFromRequest();
  if (!session) redirect('/login');
  let permissions:Set<string>;
  try { permissions = (await loadWebAuthorization(session)).permissions; }
  catch (error) {
    console.error('Screen authorization unavailable:', error);
    return <main style={{padding:32}}><h1>Access unavailable</h1><p>Unable to verify access. Please contact your administrator or try again later.</p></main>;
  }
  if (permissions.has(permission)) return <>{children}</>;
  const destination = firstAccessiblePage(permissions);
  if (destination) redirect(destination);
  return <main style={{padding:32}}><h1>No access assigned</h1><p>No screens are assigned to your account. Please contact your administrator.</p></main>;
}
