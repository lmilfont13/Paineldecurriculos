import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Currículo em PDF de até 5 MB via server action (regra 5)
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
