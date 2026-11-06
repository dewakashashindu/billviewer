import {NextResponse} from 'next/server';
// Retired in favour of the permission- and location-scoped print-email endpoint.
export async function POST(){return NextResponse.json({error:'This email endpoint has been retired. Refresh the application.'},{status:410})}
