import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.openfoodfacts.org' },
      { protocol: 'https', hostname: 'static.openfoodfacts.org' },
      { protocol: 'https', hostname: '**.openfoodfacts.org' },
    ],
  },
  experimental: {
    // Tree-shake lucide-react so Turbopack only compiles the icons actually imported
    // rather than the full ~1500-icon library on every build.
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
