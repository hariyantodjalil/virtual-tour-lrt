import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  experimental: {
    proxyClientMaxBodySize: "40mb",
  },
  // Seed demo panoramas memakai URL pannellum.org
  images: {
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
