import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['novlearn-exercise-engine'],
  outputFileTracingIncludes: {
    '/api/admin/preview': [
      './node_modules/novlearn-exercise-engine/**/*',
      './node_modules/@cortex-js/compute-engine/**/*',
      './node_modules/@arnog/colors/**/*',
      './node_modules/complex.js/**/*',
    ],
    '/api/admin/engine': [
      './node_modules/novlearn-exercise-engine/**/*',
      './node_modules/@cortex-js/compute-engine/**/*',
      './node_modules/@arnog/colors/**/*',
      './node_modules/complex.js/**/*',
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
