/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.168.1.100', '127.0.0.1', 'localhost', '*.e2b.app'],

  // hide the floating Next.js badge (bottom-left) that shows up when
  // the app is opened from a phone against `npm run dev`
  devIndicators: false,

  // mssql (tedious) must stay external — don't bundle into server chunks
  serverExternalPackages: ['mssql'],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

module.exports = nextConfig;