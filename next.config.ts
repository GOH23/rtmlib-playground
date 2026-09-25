import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: false,
  turbopack: {},
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
  // Ship the fixture media with the `/examples/[...path]` route handler when
  // deployed (Vercel / `next start`), so the videos and photos are readable
  // from the serverless function at runtime. Only the fixtures the UI links
  // to are traced — the `.webm` copies in `examples/.webm/` stay local.
  outputFileTracingIncludes: {
    '/examples/[...path]': ['./examples/*.png', './examples/*.mp4'],
  },
  experimental: {

  }


};

export default nextConfig;
