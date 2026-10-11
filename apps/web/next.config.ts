import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
