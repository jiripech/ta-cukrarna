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

  // Disable automatic favicon generation
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },

  // Empty turbopack config to silence warning
  turbopack: {},
};
export default nextConfig;
