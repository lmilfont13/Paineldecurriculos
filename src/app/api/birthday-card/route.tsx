import type { NextRequest } from "next/server";

import { parseCardParams } from "@/server/models/birthday-card.model";
import { getSessionUser, isManager } from "@/server/services/auth.service";
import { renderBirthdayCard } from "@/server/services/birthday-card.service";
import { getCompanyById } from "@/server/services/company.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cartão de aniversário (PNG 1080×1080) da empresa do gestor logado.
 * Nome da empresa, cor e logo vêm da sessão, nunca do pedido (regra 1).
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !isManager(user)) return new Response("Não autorizado", { status: 401 });

  const company = await getCompanyById(user.companyId);
  if (!company) return new Response("Empresa não encontrada", { status: 404 });

  const image = await renderBirthdayCard(parseCardParams(new URL(request.url).searchParams), {
    name: company.name,
    primaryColor: company.primaryColor,
    logoUrl: company.logoUrl,
  });
  // O nome do aniversariante vai na URL: guarda só no navegador de quem pediu.
  image.headers.set("Cache-Control", "private, max-age=600");
  return image;
}
