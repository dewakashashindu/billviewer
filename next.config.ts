import path from 'node:path';
import { createRequire } from 'node:module';

// PDFKit's ESM browser entry in 0.20.x does not register its standard fonts.
// Use the renderer's own PDFKit pre-registered browser bundle, never the
// server-side PDFKit used for inventory/email generation.
const rendererEntry = require.resolve('@react-pdf/renderer');
const rendererDir = path.dirname(rendererEntry);
const rendererRequire = createRequire(rendererEntry);
const browserPdfKit = path.join(path.dirname(rendererRequire.resolve('pdfkit')), 'pdfkit.browser.js');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // HSTS is deliberately enabled only after the public host is verified HTTPS-only.
  async headers() {
    return [{source: '/:path*', headers: [
      {key: 'X-Content-Type-Options', value: 'nosniff'},
      {key: 'X-Frame-Options', value: 'SAMEORIGIN'},
      {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
      {key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), ch-ua-model=(self), ch-ua-platform-version=(self), ch-ua-full-version-list=(self)'},
      // Ask Chrome for high-entropy Client Hints so login audit can record
      // the real device model / OS version (the plain User-Agent hides them).
      {key: 'Accept-CH', value: 'sec-ch-ua-model, sec-ch-ua-platform-version, sec-ch-ua-full-version-list'},
      {key: 'Critical-CH', value: 'sec-ch-ua-model, sec-ch-ua-platform-version, sec-ch-ua-full-version-list'},
      // Report-only while real PDF/print flows are tested; not an enforced XSS control.
      {key: 'Content-Security-Policy-Report-Only', value: "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'"},
      ...(process.env.ENABLE_HSTS === 'true' ? [{key: 'Strict-Transport-Security', value: 'max-age=31536000'}] : []),
    ]}];
  },

  allowedDevOrigins: ['192.168.1.100', '127.0.0.1', 'localhost', '*.e2b.app'],

  // hide the floating Next.js badge (bottom-left) that shows up when
  // the app is opened from a phone against `npm run dev`
  devIndicators: false,

  // Bundle the browser PDF renderer; server PDFKit stays external for Node.
  transpilePackages: ['@react-pdf/renderer'],

  webpack(config: any, { isServer, webpack }: { isServer: boolean; webpack: any }) {
    if (!isServer) {
      // Only the renderer's PDFDocument needs the pre-registered bundle.
      // @react-pdf/font imports the ESM named registerStdFonts export and must
      // keep its own PDFKit module; a global alias breaks that import.
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^pdfkit$/, (resource: any) => {
        if (resource.context === rendererDir) resource.request = browserPdfKit;
      }));
    }
    return config;
  },

  // mssql (tedious) must stay external — don't bundle into server chunks
  serverExternalPackages: ['mssql', 'pdfkit'],

  images: {
    // Avoid platform-specific native `sharp` binary on Windows IIS (SmarterASP.NET)
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

module.exports = nextConfig;
