import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  experimental: {
    proxyClientMaxBodySize: "40mb",
  },
  // Cloudflare WAF memblokir /_next/image?url=... (403 di jalur internet).
  // Asset lokal & proxy S3 dilayani langsung tanpa image optimizer.
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pannellum.org",
        pathname: "/images/**",
      },
    ],
  },
  // Pastikan Prisma + pg ikut ter-trace ke bundle standalone (Docker)
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/.prisma/**/*",
      "./node_modules/@prisma/client/**/*",
      "./node_modules/pg/**/*",
      "./node_modules/@prisma/adapter-pg/**/*",
    ],
  },
};

export default nextConfig;
