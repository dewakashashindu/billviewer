import {NextResponse} from 'next/server';
// The old endpoint updated POS users by UserId without the location key and
// wrote the legacy Password column. It is retired for the web-credentials flow.
export async function POST(){return NextResponse.json({error:'This endpoint is retired. Select an existing POS user to update web credentials.'},{status:410})}
