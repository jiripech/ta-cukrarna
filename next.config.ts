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
};

export default nextConfig;
