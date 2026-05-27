import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    reactCompiler: true,
  },
  transpilePackages: ["@zenflow/db", "@zenflow/ui", "@zenflow/auth", "@zenflow/trpc"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.minio.zenflow.io" },
      { protocol: "http", hostname: "localhost" },
    ],
  },
};

export default nextConfig;
