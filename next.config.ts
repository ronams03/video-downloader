import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Hide the floating Next.js dev-tools logo/indicator.
  devIndicators: false,
  // Ship the sample media used by the download engine inside the serverless
  // bundle. Without this, Vercel's file tracing misses `media/samples/` and
  // the stream/download routes would 404 on the deployed site.
  outputFileTracingIncludes: {
    "/api/**": ["./media/samples/**"],
  },
};

export default nextConfig;
