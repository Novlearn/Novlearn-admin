import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: 'standalone',
  serverExternalPackages: ['novlearn-exercise-engine'],
  outputFileTracingIncludes: {
    '/api/admin/engine/qualification': [
      './node_modules/novlearn-exercise-engine/**/*',
      './node_modules/@cortex-js/compute-engine/**/*',
      './node_modules/@arnog/colors/**/*',
      './node_modules/complex.js/**/*',
    ],
    '/admin/exercises/*': [
      './scripts/active-version-reader-audit.sql',
      './scripts/active-version-query.sql',
    ],
    '/api/admin/exercises/*/target-version': [
      './scripts/active-version-reader-audit.sql',
      './scripts/active-version-query.sql',
    ],
    '/admin/statistics/pedagogy': [
      './scripts/pedagogy-reader-audit.sql',
      './scripts/pedagogy-statistics-query.sql',
      './scripts/pedagogy-references-query.sql',
    ],
    '/api/admin/statistics/pedagogy{,/**}': [
      './scripts/pedagogy-reader-audit.sql',
      './scripts/pedagogy-statistics-query.sql',
      './scripts/pedagogy-references-query.sql',
    ],
    '/admin/users/*': [
      './scripts/user-detail-reader-audit.sql',
      './scripts/user-detail-query.sql',
    ],
    '/api/admin/users/*': [
      './scripts/user-detail-reader-audit.sql',
      './scripts/user-detail-query.sql',
    ],
    '/admin/users': [
      './scripts/users-reader-audit.sql',
      './scripts/users-list-query.sql',
    ],
    '/api/admin/users': [
      './scripts/users-reader-audit.sql',
      './scripts/users-list-query.sql',
    ],
    '/admin/statistics': [
      './scripts/activity-reader-audit.sql',
      './scripts/activity-statistics-query.sql',
    ],
    '/api/admin/statistics': [
      './scripts/activity-reader-audit.sql',
      './scripts/activity-statistics-query.sql',
    ],
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
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
