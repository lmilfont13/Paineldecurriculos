import type { MetadataRoute } from "next";

import { appUrl } from "@/lib/env";

/**
 * robots.txt: buscadores leem só a vitrine pública (lista e detalhe das
 * vagas). Painel do gestor, console admin, área do candidato e formulário de
 * candidatura ficam de fora — além de exigirem login, não têm o que indexar.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/login",
        "/recuperar-senha",
        "/redefinir-senha",
        "/apresentacao",
        // Painel do gestor (rotas na raiz, sem slug)
        "/painel",
        "/vagas",
        "/candidaturas",
        "/buscar-cvs",
        "/talentos",
        "/agentes",
        "/auditoria",
        "/configuracoes",
        "/formulario",
        // Área do candidato e formulário (por empresa)
        "/*/entrar",
        "/*/perfil",
        "/*/minhas-candidaturas",
        "/*/notificacoes",
        "/*/vagas/*/candidatar",
      ],
    },
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
