import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server for the container image (see Dockerfile).
  output: "standalone",
  compress: true, // Enable gzip compression
  poweredByHeader: false, // Remove X-Powered-By header for security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Allow embedding in iframes (set frame ancestors as needed)
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: "frame-ancestors *" },
        ],
      },
    ];
  },
};

export default nextConfig;
