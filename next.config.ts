import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O currículo da demonstração (public/demo) é lido do disco pela IA
  // (ai.service → readDemoResume). Sem isto, a pasta public não vai junto
  // com as funções serverless na Vercel.
  outputFileTracingIncludes: {
    "/*": ["./public/demo/**/*"],
    "/**/*": ["./public/demo/**/*"],
  },
  // Exclui arquivos de áudio pesados de serem incluídos dentro do bundle das Serverless Functions.
  // Eles são servidos diretamente pela CDN estática da Vercel.
  outputFileTracingExcludes: {
    "/*": ["./public/audio/**/*"],
    "/**/*": ["./public/audio/**/*"],
  },
  experimental: {
    serverActions: {
      // Currículo em PDF de até 5 MB via server action (regra 5)
      bodySizeLimit: "6mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
