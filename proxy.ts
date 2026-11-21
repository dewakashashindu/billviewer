import {NextRequest, NextResponse} from 'next/server';

/** Guard browser state-changing staff APIs. Public ordering APIs are deliberately out of scope. */
export function proxy(req: NextRequest) {
  if (['GET','HEAD','OPTIONS'].includes(req.method)) return NextResponse.next();
  const configured = (process.env.APP_ORIGIN ?? '').trim();
  let trusted: string;
  try {
    if (process.env.NODE_ENV === 'production') {
      const url = new URL(configured);
      if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.origin !== configured) throw Error('Invalid APP_ORIGIN');
      trusted = url.origin;
    } else {
      trusted = configured ? new URL(configured).origin : req.nextUrl.origin;
    }
  } catch {
    console.error('APP_ORIGIN must be an exact HTTPS origin in production');
    return NextResponse.json({error:'Service temporarily unavailable.'},{status:503});
  }
  const origin = req.headers.get('origin');
  const site = req.headers.get('sec-fetch-site');
  if (!origin || origin !== trusted || (site && site !== 'same-origin' && site !== 'none')) {
    return NextResponse.json({error:'Request origin is not allowed.'},{status:403});
  }
  return NextResponse.next();
}

export const config = {matcher: ['/api/auth/:path*','/api/admin/:path*','/api/inventory/:path*','/api/billing-control/:path*','/api/ai-assistant/:path*']};
