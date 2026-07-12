import "server-only";

import { cache } from "react";

import { requireAdmin } from "@/server/controllers/guards";
import {
  countCompaniesForAdmin,
  getCompanyForAdmin,
  listCompaniesForAdmin,
} from "@/server/services/company-admin.service";

export const getAdminShell = cache(async () => {
  const user = await requireAdmin();
  const companyCount = await countCompaniesForAdmin();
  return { user, companyCount };
});

export async function getEmpresasPageData() {
  await getAdminShell();
  return { companies: await listCompaniesForAdmin() };
}

export async function getEmpresaDetail(id: string) {
  await getAdminShell();
  return getCompanyForAdmin(id);
}
