import {NextResponse} from 'next/server';
// Retired endpoint: its old admin-only draft path used Tbl_MenuItems and bypassed web permissions.
// PurchasingWorkspace now uses the location-scoped po-master and grn-master endpoints.
export async function GET(){return NextResponse.json({error:'This purchasing endpoint has been retired. Refresh the application.'},{status:410})}
export async function POST(){return NextResponse.json({error:'This purchasing endpoint has been retired. Refresh the application.'},{status:410})}
