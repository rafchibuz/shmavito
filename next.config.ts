import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "static-cdn.jtvnw.net" },
      { protocol: "https", hostname: "**.avito.st" },
      { protocol: "https", hostname: "**.avito.ru" },
    ],
  },
  poweredByHeader: false,
};

export default nextConfig;
