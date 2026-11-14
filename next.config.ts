import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/test",
        permanent: false,
      },
      {
        source: "/student",
        destination: "/test",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
