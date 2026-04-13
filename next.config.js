/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        // ── API routes — never cache ──────────────────────────────────────
        // Prevents browsers from serving stale 304 responses for API calls,
        // which was causing only 24 employees to show instead of all 110.
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma',        value: 'no-cache' },
          { key: 'Expires',       value: '0' },
        ],
      },
      {
        // ── HTML pages — always revalidate ────────────────────────────────
        // Ensures users always load the latest JS bundle after a deployment,
        // preventing "Out of Memory" crashes from stale code being served.
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
