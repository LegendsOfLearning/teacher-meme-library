/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 16 blocks cross-origin requests to /_next/webpack-hmr by default.
  // When the dev server is reached via 127.0.0.1 or the LAN IP (instead of
  // exactly "localhost") the HMR socket fails, which in turn prevents the
  // React client bundle from hydrating — the page renders but nothing is
  // interactive. Allowing common local origins fixes that without exposing
  // anything beyond the local machine.
  allowedDevOrigins: ["localhost", "127.0.0.1", "0.0.0.0"],

  // Keep serverless bundles under Vercel's size limit. Gallery/memes are
  // served as static assets; API routes only need templates + fonts.
  outputFileTracingExcludes: {
    "*": [
      "./scripts/**",
      "./docs/**",
      "./tmp-smoke/**",
      "./public/memes/**",
      "./data/memes/**",
      "./.git/**",
      "./new feedback vadim.txt",
    ],
  },
};

export default nextConfig;
