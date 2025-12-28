import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // Static export configuration
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  experimental: {
    // cssChunking: false, // removed as it was causing issues in dev
  },

  // Disable automatic favicon generation
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
};
export default nextConfig;
