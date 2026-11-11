import { getSessionUser, isManager } from "@/server/services/auth.service";
import { exportCompanyCandidates } from "@/server/services/candidate-export.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Planilha (.xlsx) com todos os cadastrados da empresa do gestor logado. */
export async function GET() {
  const user = await getSessionUser();
  if (!user || !isManager(user)) return new Response("Não autorizado", { status: 401 });

  const file = await exportCompanyCandidates(user.companyId, user);
  if (!file) return new Response("Empresa não encontrada", { status: 404 });

  return new Response(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${file.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
