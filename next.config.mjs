/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 16 blocks cross-origin requests to /_next/webpack-hmr by default.
  // When the dev server is reached via 127.0.0.1 or the LAN IP (instead of
  // exactly "localhost") the HMR socket fails, which in turn prevents the
  // React client bundle from hydrating — the page renders but nothing is
  // interactive. Allowing common local origins fixes that without exposing
  // anything beyond the local machine.
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "admin.tail35e0ce.ts.net",
  ],
  // Native module used by the box-only admin/evals backend.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
