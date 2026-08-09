import type { NextConfig } from "next";

const localApiProxy: Pick<NextConfig, "rewrites"> = process.env.NODE_ENV === "development" ? {
  async rewrites() {
    return [{
      source: "/api/:path*",
      destination: "http://127.0.0.1:3000/api/:path*",
    }];
  },
} : {};

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  ...localApiProxy,
};

export default nextConfig;
