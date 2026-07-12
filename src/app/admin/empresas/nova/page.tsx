import type { Metadata } from "next";

import { CompanyWizard } from "@/components/admin/company-wizard";

export const metadata: Metadata = { title: "Nova empresa · Console Triagem" };

/** A2–A6 · Nova empresa (wizard de 5 passos). */
export default function NovaEmpresaPage() {
  return <CompanyWizard />;
}
