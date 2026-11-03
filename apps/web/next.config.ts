import type { NextConfig } from "next";

const enableSRI = process.env.NEXT_ENABLE_SRI === 'true';

const nextConfig: NextConfig = {
  ...(enableSRI
    ? {
        experimental: {
          sri: {
            algorithm: 'sha256',
          },
        },
      }
    : {}),
  async redirects() {
    return [
      {
        source: '/exams',
        destination: '/exam',
        permanent: true,
      },
      {
        source: '/exams/:path*',
        destination: '/exam/:path*',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data: https://fonts.gstatic.com https://unpkg.com https://*.tldraw.com https:",
              "connect-src 'self' data: blob: http://localhost:3001 http://localhost:3000 http://127.0.0.1:3001 http://127.0.0.1:3000 https://*.educarelearning.in https://educarelearning.in wss://*.educarelearning.in wss://educarelearning.in https://*.r2.cloudflarestorage.com https://*.livekit.cloud wss://*.livekit.cloud https://fonts.googleapis.com https://fonts.gstatic.com https://challenges.cloudflare.com https://unpkg.com https://*.tldraw.com ws: wss: stun: turn: turns: https:",
              "frame-src https://challenges.cloudflare.com",
              "media-src 'self' blob: https:",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
