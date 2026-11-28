// PDF export for the hidden Login Activity screen. Query parameters mirror
// the on-screen filters exactly (same shared query module), so the download
// always contains what the user currently sees. Requires the same UADMIN
// step-up verification as the screen itself; everything else gets 401/404.
import 'server-only';
import {NextRequest, NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import PDFDocument from 'pdfkit';
import {getSessionFromRequest} from '@/lib/session';
import {isUAdmin, verifyLoginActivityToken, LOGIN_ACTIVITY_COOKIE} from '@/lib/loginActivityGuard';
import {cleanIp} from '@/lib/loginAudit';
import {logActivity} from '@/lib/activityLog';
import {
 withTodayDefault, getLoginRows, getActivityRows, getSessionReport,
 ROW_CAP, REPORT_CAP, str, type LoginActivityFilters, type Row,
} from '@/lib/loginActivityData';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const sanitize = (v: string | null, max: number) => (v ?? '').trim().slice(0, max);
const DATE = (v: string | null) => { const s = sanitize(v, 10); return DATE_RE.test(s) ? s : ''; };
const TABS: Record<string, string> = { logins: 'Sign-ins', activity: 'App activity', report: 'Session report' };
// Stored values are Colombo wall-time; render them verbatim (same as the UI).
const fmt = (v: unknown) => {
 if (v instanceof Date) return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(v);
 return str(v).slice(0, 19);
};
const locOf = (r: Row) => [str(r.GeoCity), str(r.GeoRegion), str(r.GeoCountry)].filter(Boolean).join(', ');
const devOf = (r: Row) => `${str(r.DeviceType)}${str(r.DeviceModel) ? ` · ${str(r.DeviceModel)}` : ''}`;
const browserOf = (r: Row) => `${str(r.Browser)} ${str(r.BrowserVersion)}`.trim();
const osOf = (r: Row) => `${str(r.OsName)} ${str(r.OsVersion)}`.trim();

export async function GET(req: NextRequest) {
 const session = await getSessionFromRequest();
 if (!session) return new NextResponse('Please sign in again.', { status: 401 });
 if (!isUAdmin(session)) return new NextResponse('Not found.', { status: 404 });
 const reauth = (await cookies()).get(LOGIN_ACTIVITY_COOKIE)?.value;
 if (!verifyLoginActivityToken(reauth, session)) {
  if (req.headers.get('sec-fetch-dest') === 'document') {
   // Top-level navigation (address bar or the Download link): bounce to the
   // screen, which shows the UADMIN step-up form instead of a dead-end
   // error page. Filters are forwarded so the same view is restored.
   const url = new URL('/login-activity', req.nextUrl.origin);
   for (const k of ['tab', 'q', 'user', 'from', 'to', 'result', 'category']) {
    const v = req.nextUrl.searchParams.get(k);
    if (v) url.searchParams.set(k, v);
   }
   return NextResponse.redirect(url);
  }
  return new NextResponse('Verification expired. Reload the Login Activity page and try again.', { status: 403 });
 }

 const sp = req.nextUrl.searchParams;
 const tab = ['logins', 'activity', 'report'].includes(sp.get('tab') ?? '') ? (sp.get('tab') as string) : 'logins';
 const filters = withTodayDefault<LoginActivityFilters>({
  q: sanitize(sp.get('q'), 200),
  user: sanitize(sp.get('user'), 100),
  from: DATE(sp.get('from')),
  to: DATE(sp.get('to')),
  result: sanitize(sp.get('result'), 10),
  category: sanitize(sp.get('category'), 30),
 });
 const actor = str(session.userName || session.loginName || session.userId);
 await logActivity({actor:session,category:'SECURITY',action:'LOGIN_ACTIVITY_PDF_EXPORTED',targetType:'report',targetId:tab,details:`Login activity PDF exported (tab: ${tab}; filters: ${filters.from} to ${filters.to}${filters.category?`; category ${filters.category}`:''}${filters.user?`; user ${filters.user}`:''}).`});

 let body: Buffer;
 try {
  body = await renderPdf(tab, filters, actor);
 } catch (e) {
  console.error('Login activity PDF failed:', e instanceof Error ? e.message : e);
  return new NextResponse('PDF generation failed. Please try again.', { status: 500 });
 }
 const fileName = `login-activity-${tab}-${filters.from}-to-${filters.to}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '-');
 return new NextResponse(new Uint8Array(body), {
  status: 200,
  headers: {
   'Content-Type': 'application/pdf',
   'Content-Disposition': `attachment; filename="${fileName}"`,
   'Cache-Control': 'no-store',
  },
 });
}

async function renderPdf(tab: string, f: LoginActivityFilters & { from: string; to: string }, actor: string): Promise<Buffer> {
 const ink = '#2f241c', muted = '#6b5d4f', line = '#e5ddd2', accent = '#b46a28', good = '#1e6b34', bad = '#a03222';
 return new Promise<Buffer>((resolve, reject) => {
  // All query/render work happens inside this async IIFE; any failure is
  // caught and rejects the outer promise, which the route turns into a 500.
  (async () => {
   const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true, info: { Title: `Login Activity - ${TABS[tab]}` } });
   const chunks: Buffer[] = [];
   doc.on('data', (c: Buffer) => chunks.push(c));
   doc.on('end', () => resolve(Buffer.concat(chunks)));
   doc.on('error', reject);
   const left = 40, width = doc.page.width - left * 2;
   const generated = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
   const filterBits = [`Range: ${f.from} to ${f.to}`];
   if (f.q) filterBits.push(`Search: "${f.q}"`);
   if (f.user) filterBits.push(`User: ${f.user}`);
   if (tab === 'logins' && f.result) filterBits.push(`Result: ${f.result}`);
   if (tab === 'activity' && f.category) filterBits.push(`Category: ${f.category}`);
   const ensureSpace = (h: number) => { if (doc.y + h > doc.page.height - 56) doc.addPage(); };
   const rule = () => { doc.moveTo(left, doc.y + 2).lineTo(left + width, doc.y + 2).strokeColor(line).lineWidth(0.6).stroke(); doc.moveDown(0.35); };

   // Document header
   doc.font('Helvetica-Bold').fontSize(9).fillColor(muted).text('MILA MIRISSA - LOGIN ACTIVITY', left, doc.y, { width });
   doc.font('Helvetica-Bold').fontSize(19).fillColor(accent).text(TABS[tab].toUpperCase(), left, doc.y + 4, { width });
   doc.font('Helvetica').fontSize(8.5).fillColor(muted).text(`Generated: ${generated}  ·  By: ${actor}`, left, doc.y + 4, { width });
   doc.text(filterBits.join('  ·  '), left, doc.y + 2, { width });
   if (tab !== 'logins') doc.text('Note: activity records older than 3 months are deleted automatically.', left, doc.y + 2, { width });
   doc.moveDown(0.7); rule();

   const body = (text: string, size = 9) => { doc.font('Helvetica').fontSize(size).fillColor(ink).text(text, left, doc.y, { width }); };

   if (tab === 'logins') {
    const { rows, capped } = await getLoginRows(f);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(ink).text(`Sign-ins: ${rows.length}${capped ? `  (first ${ROW_CAP} shown - narrow the date range)` : ''}`, left, doc.y, { width });
    doc.moveDown(0.4);
    for (const r of rows) {
     const ok = !!r.Success, loc = locOf(r), ip = cleanIp(str(r.IpAddress));
     ensureSpace(56);
     doc.font('Helvetica-Bold').fontSize(8).fillColor(ok ? good : bad).text(fmt(r.LoginAt) + '   ' + (ok ? 'SUCCESS' : 'FAILED'), left, doc.y, { width });
     doc.font('Helvetica-Bold').fontSize(10.5).fillColor(ink).text(`${str(r.UserName) || str(r.LoginName)}  (${str(r.LoginName)}${str(r.UserId) ? ` · ID ${str(r.UserId)}` : ''})`, left, doc.y + 1, { width });
     doc.font('Helvetica').fontSize(8).fillColor(muted).text(`IP: ${ip || '-'}   Branch: ${str(r.LocationCode) || '-'}   Location: ${loc || '-'}`, left, doc.y + 1, { width });
     doc.text(`Device: ${devOf(r) || '-'}   Browser: ${browserOf(r) || '-'}   OS: ${osOf(r) || '-'}`, left, doc.y + 1, { width });
     if (!ok && str(r.FailReason)) doc.text(`Reason: ${str(r.FailReason)}`, left, doc.y + 1, { width });
     doc.moveDown(0.3); rule();
    }
    if (!rows.length) body('No sign-ins match the selected filters.');
    finish(doc, left, width, muted);
    return;
   }
   if (tab === 'activity') {
    const { rows, capped, total } = await getActivityRows(f);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(ink).text(`Records in range: ${rows.length}${capped ? `  (first ${ROW_CAP} shown - narrow the date range)` : ''}   ·   Stored (all time): ${total}`, left, doc.y, { width });
    doc.moveDown(0.4);
    for (const a of rows) {
     ensureSpace(42);
     doc.font('Helvetica-Bold').fontSize(8.5).fillColor(ink).text(`${fmt(a.ActivityAt)}   ${str(a.Category)} - ${str(a.Action).replace(/_/g, ' ')}`, left, doc.y, { width });
     doc.font('Helvetica').fontSize(7.5).fillColor(muted).text(`${str(a.UserName) || str(a.LoginName)} (${str(a.LoginName)})${str(a.LocationCode) ? ` · Branch ${str(a.LocationCode)}` : ''}${str(a.IpAddress) ? ` · IP ${cleanIp(str(a.IpAddress))}` : ''}`, left, doc.y + 1, { width });
     const target = [str(a.TargetName) || str(a.TargetId), str(a.TargetType)].filter(Boolean).join(' · ');
     if (target) doc.text(`Target: ${target}`, left, doc.y + 1, { width });
     if (str(a.Details)) doc.text(str(a.Details), left, doc.y + 1, { width });
     if (str(a.BeforeValue) || str(a.AfterValue)) doc.text(`Before: ${str(a.BeforeValue) || '-'}   |   After: ${str(a.AfterValue) || '-'}`, left, doc.y + 1, { width });
     doc.moveDown(0.25); rule();
    }
    if (!rows.length) body('No activity records match the selected filters.');
    finish(doc, left, width, muted);
    return;
   }
   // report tab
   const rep = await getSessionReport(f);
   {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(ink).text(`Sessions: ${rep.logins.length}${rep.capped ? `  (first ${REPORT_CAP} shown - narrow the date range)` : ''}`, left, doc.y, { width });
    doc.moveDown(0.4);
    for (const r of rep.logins) {
     const ref = str(r.SessionRef), acts = rep.activityBySession.get(ref) ?? [];
     const end = acts.find((a) => str(a.Category) === 'SESSION' && ['LOGOUT', 'SESSION_REVOKED'].includes(str(a.Action)));
     const active = rep.activeHashes.has(ref);
     const loc = locOf(r), ip = cleanIp(str(r.IpAddress));
     ensureSpace(80);
     doc.font('Helvetica-Bold').fontSize(9.5).fillColor(ink).text(`${str(r.UserName) || str(r.LoginName)} (${str(r.LoginName)})  -  signed in ${fmt(r.LoginAt)}`, left, doc.y, { width });
     doc.font('Helvetica').fontSize(7.5).fillColor(muted).text(`Branch: ${str(r.LocationCode) || '-'}   Location: ${loc || '-'}   IP: ${ip || '-'}`, left, doc.y + 1, { width });
     doc.text(`Device: ${devOf(r) || '-'}   Browser: ${browserOf(r) || '-'}   OS: ${osOf(r) || '-'}`, left, doc.y + 1, { width });
     doc.moveDown(0.3);
     doc.font('Helvetica-Bold').fontSize(7.5).fillColor(accent).text(`ACTIVITIES (${acts.length})`, left, doc.y, { width });
     for (const a of acts) {
      ensureSpace(16);
      const target = str(a.TargetName) || str(a.TargetId);
      doc.font('Helvetica').fontSize(7.5).fillColor(ink).text(`${fmt(a.ActivityAt).slice(-8)}   ${str(a.Category)} - ${str(a.Action).replace(/_/g, ' ')}${target ? `   -   ${target}` : ''}`, left + 12, doc.y + 1, { width: width - 12 });
      if (str(a.Details)) doc.font('Helvetica').fontSize(7).fillColor(muted).text(str(a.Details), left + 24, doc.y + 1, { width: width - 30 });
     }
     if (!acts.length) doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(muted).text('No linked activity (sessions before session linking was enabled).', left + 12, doc.y + 1, { width: width - 12 });
     doc.moveDown(0.25);
     const endTxt = end
      ? `${str(end!.Action) === 'SESSION_REVOKED' ? 'Session revoked' : 'Signed out'}: ${fmt(end!.ActivityAt)}`
      : active ? 'Status: still active' : 'Signed out: not recorded';
     doc.font('Helvetica-Bold').fontSize(8.5).fillColor(end ? bad : active ? good : muted).text(endTxt, left, doc.y, { width, align: 'right' });
     doc.moveDown(0.3); rule();
    }
    if (rep.activitiesError) { doc.font('Helvetica-Oblique').fontSize(8).fillColor(muted).text('Linked activity records could not be loaded; session headers are shown without their activity lists.', left, doc.y, { width }); }
    if (!rep.logins.length) body('No sessions match the selected filters.');
    finish(doc, left, width, muted);
   }
  })().catch(reject);
 });
}

// Footer on every buffered page, then close the document.
function finish(doc: InstanceType<typeof PDFDocument>, left: number, width: number, muted: string) {
 const range = doc.bufferedPageRange();
 for (let i = 0; i < range.count; i++) {
  doc.switchToPage(i);
  const fy = doc.page.height - 26;
  doc.font('Helvetica').fontSize(6.5).fillColor(muted).text('Confidential - internal use only. Contains personal data (IP address, approximate location, device).', left, fy, { width: width * 0.72, lineBreak: false });
  doc.text(`Page ${i + 1} of ${range.count}`, left + width * 0.72, fy, { width: width * 0.28, align: 'right', lineBreak: false });
 }
 doc.end();
}
