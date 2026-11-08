"use server";

import { requireManager } from "@/server/controllers/guards";
import { getCompanyBirthdays } from "@/server/services/birthday.service";
import type { CompanyBirthdaysData } from "@/server/models/birthday.model";

/**
 * Retorna os aniversariantes do dia, da semana e do mês da empresa do gestor logado.
 */
export async function getCompanyBirthdaysAction(): Promise<CompanyBirthdaysData | null> {
  const user = await requireManager();
  return getCompanyBirthdays(user.companyId);
}

