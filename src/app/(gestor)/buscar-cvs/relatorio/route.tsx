import { renderToBuffer } from "@react-pdf/renderer";

import { TalentDashboardReport } from "@/components/report/talent-dashboard-report";
import { getTalentDashboardReportForGestor } from "@/server/controllers/gestor.controller";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Endpoint de geração do Dashboard Executivo de Talentos em PDF (nível Michelin).
 * Apresenta demografia (gênero, idade), mercado (empresas, cargos, senioridade) e ranking de candidatos.
 */
export async function GET() {
  const report = await getTalentDashboardReportForGestor();
  if (!report) return new Response("Empresa não encontrada.", { status: 404 });

  const companySlug = report.company.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const buffer = await renderToBuffer(
    <TalentDashboardReport
      data={report.data}
      company={report.company.name}
      brand={report.company.brand || "#7a1f3d"}
    />
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="dashboard-talentos-${companySlug || "recrutamento"}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

