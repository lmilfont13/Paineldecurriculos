import "server-only";

import { cache } from "react";

import { requireAdmin } from "@/server/controllers/guards";
import { getActiveRadioStation } from "@/server/services/message-template.service";
import {
  countCompaniesForAdmin,
  getCompanyForAdmin,
  getCompanyManager,
  listCompaniesForAdmin,
} from "@/server/services/company-admin.service";

export const getAdminShell = cache(async () => {
  const user = await requireAdmin();
  const companyCount = await countCompaniesForAdmin();
  const radioStation = await getActiveRadioStation(null);
  return { user, companyCount, radioStation };
});

export async function getEmpresasPageData() {
  await getAdminShell();
  return { companies: await listCompaniesForAdmin() };
}

export async function getEmpresaDetail(id: string) {
  await getAdminShell();
  // Sequencial: com connection_limit=1 o Promise.all só enfileira na
  // mesma conexão e aumenta o risco de P2024 (pool_timeout).
  const company = await getCompanyForAdmin(id);
  const manager = await getCompanyManager(id);
  return company ? { company, manager } : null;
}
