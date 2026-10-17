import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const nextConfig = {
  output: 'standalone',
  devIndicators:false,
  outputFileTracingRoot: root,
  turbopack:{root},
  transpilePackages: ['@safanoor/shared'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${process.env.API_INTERNAL_URL || 'http://localhost:3001'}/api/:path*` }];
  },
  async headers() {
    return [{ source: '/:path*', headers: [{key:'X-Content-Type-Options',value:'nosniff'}, {key:'Referrer-Policy',value:'same-origin'}, {key:'X-Frame-Options',value:'DENY'}] }];
  },
};
export default nextConfig;
