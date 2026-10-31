import { renderToBuffer } from "@react-pdf/renderer";

import { PortfolioReport } from "@/components/report/portfolio-report";
import { getPortfolioReportForGestor } from "@/server/controllers/gestor.controller";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Relatório geral de recrutamento em PDF: todas as vagas e o perfil dos candidatos (sem IA, sai rápido). */
export async function GET() {
  const report = await getPortfolioReportForGestor();
  if (!report) return new Response("Empresa não encontrada.", { status: 404 });

  const buffer = await renderToBuffer(
    <PortfolioReport data={report.data} company={report.company.name} brand={report.company.brand} />
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="relatorio-geral-recrutamento.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
