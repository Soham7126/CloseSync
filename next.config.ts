import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable experimental features for faster dev
  experimental: {
    // Optimize package imports
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  // Reduce logging in dev
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
};

export default nextConfig;
