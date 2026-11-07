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
};

export default nextConfig;
