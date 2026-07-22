import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    proxyClientMaxBodySize: "40mb",
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
