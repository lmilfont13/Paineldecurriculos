import { renderToBuffer } from "@react-pdf/renderer";

import { DecisionReport } from "@/components/report/decision-report";
import { getJobReportForGestor } from "@/server/controllers/gestor.controller";

export const runtime = "nodejs";
// Lê os currículos já analisados e, se pedido, chama a IA para o comparativo.
export const maxDuration = 60;

/** Relatório de decisão em PDF para a diretoria. `?ia=0` pula o comparativo da IA (mais rápido). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const withAi = new URL(request.url).searchParams.get("ia") !== "0";
  const report = await getJobReportForGestor(jobId, withAi);
  if (!report) return new Response("Vaga não encontrada.", { status: 404 });

  const buffer = await renderToBuffer(
    <DecisionReport
      data={report.data}
      company={report.company.name}
      brand={report.company.brand}
      notes={report.notes}
    />
  );

  const { title, code } = report.data.job;
  const name = `relatorio-${title}${code ? `-${code}` : ""}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
