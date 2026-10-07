import type { Metadata } from "next";

import { requireManager } from "@/server/controllers/guards";
import { findAuditLogs } from "@/server/repositories/audit.repository";

export const metadata: Metadata = { title: "Auditoria · Triagem" };

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  VAGA_CRIADA:                  { label: "Vaga criada",             color: "bg-[#e4f6ec] text-[#1f7a4d]" },
  VAGA_EDITADA:                 { label: "Vaga editada",            color: "bg-[#eff6ff] text-[#1d4ed8]" },
  VAGA_PUBLICADA:               { label: "Vaga publicada",          color: "bg-[#e4f6ec] text-[#1f7a4d]" },
  VAGA_PAUSADA:                 { label: "Vaga pausada",            color: "bg-[#fef3c7] text-[#92400e]" },
  VAGA_ENCERRADA:               { label: "Vaga encerrada",          color: "bg-[#f1f0ed] text-[#71717a]" },
  CANDIDATURA_STATUS_ALTERADO:  { label: "Status alterado",         color: "bg-[#eff6ff] text-[#1d4ed8]" },
  CANDIDATURA_EXCLUIDA:         { label: "Candidatura excluída",    color: "bg-[#fef2f2] text-[#b91c1c]" },
  ENTREVISTA_AGENDADA:          { label: "Entrevista agendada",     color: "bg-[#f5f3ff] text-[#6d28d9]" },
  RECADO_ENVIADO:               { label: "Recado enviado",          color: "bg-[#fff7ed] text-[#c2410c]" },
  NOTA_SALVA:                   { label: "Nota interna salva",      color: "bg-[#f1f0ed] text-[#71717a]" },
  CONFIGURACOES_ATUALIZADAS:    { label: "Configurações atualizadas", color: "bg-[#fce7f3] text-[#9d174d]" },
  VAGA_COMPARTILHADA_WHATSAPP:  { label: "Compartilhou no WhatsApp", color: "bg-[#dcfce7] text-[#15803d]" },
};

function formatDateTime(date: Date): { date: string; time: string } {
  const d = new Date(date);
  return {
    date: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }),
    time: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  };
}

function metadataDetail(action: string, meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  if (action === "CANDIDATURA_STATUS_ALTERADO" && meta.novoStatus) {
    return `Movido para: ${meta.novoStatus}${meta.jobTitle ? ` · ${meta.jobTitle}` : ""}`;
  }
  if (action === "ENTREVISTA_AGENDADA") {
    const parts: string[] = [];
    if (meta.jobTitle) parts.push(String(meta.jobTitle));
    if (meta.mode) parts.push(String(meta.mode));
    if (meta.at) {
      const d = new Date(String(meta.at));
      parts.push(d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }));
    }
    return parts.join(" · ") || null;
  }
  if (action === "RECADO_ENVIADO" && meta.preview) {
    return `"${meta.preview}${String(meta.preview).length >= 80 ? "…" : ""}"`;
  }
  if ((action === "VAGA_CRIADA" || action === "VAGA_EDITADA" || action === "VAGA_PUBLICADA") && meta.jobTitle) {
    return String(meta.jobTitle);
  }
  if (action === "NOTA_SALVA" && meta.jobTitle) {
    return String(meta.jobTitle);
  }
  if (action === "CONFIGURACOES_ATUALIZADAS") {
    const extra = meta.logoAlterada ? " (logo atualizado)" : "";
    return `Campos atualizados${extra}`;
  }
  return null;
}

export default async function AuditoriaPage() {
  const user = await requireManager();
  const logs = await findAuditLogs(user.companyId, 200);

  return (
    <div className="mx-auto w-full max-w-[980px]">
      <div className="mb-7">
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#0a0a0a]">Auditoria</h1>
        <p className="mt-1 text-[13px] text-[#71717a]">
          Registro de todas as ações realizadas no painel — quem fez, o quê e quando.
          Últimas {logs.length} entradas.
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-xl border border-[#e4e4e7] bg-[#fafaf9] py-16 text-center">
          <p className="text-[13px] text-[#71717a]">
            Nenhuma ação registrada ainda. O log começa a partir de agora.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#e4e4e7] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          {/* Cabeçalho */}
          <div className="hidden md:grid grid-cols-[120px_1fr_160px] gap-4 border-b border-[#e4e4e7] bg-[#fafaf9] px-5 py-3">
            <span className="text-[11px] font-medium uppercase tracking-[0.5px] text-[#a1a1aa]">Data · Hora</span>
            <span className="text-[11px] font-medium uppercase tracking-[0.5px] text-[#a1a1aa]">Ação</span>
            <span className="text-[11px] font-medium uppercase tracking-[0.5px] text-[#a1a1aa]">Quem</span>
          </div>

          {/* Linhas */}
          <ol>
            {logs.map((log, i) => {
              const { date, time } = formatDateTime(log.createdAt);
              const badge = ACTION_LABELS[log.action] ?? { label: log.action, color: "bg-[#f1f0ed] text-[#71717a]" };
              const detail = metadataDetail(log.action, log.metadata as Record<string, unknown> | null);
              const who = log.userName || log.userEmail || "sistema";

              return (
                <li
                  key={log.id}
                  className={
                    "flex flex-col gap-3 px-5 py-4 text-[13px] md:grid md:grid-cols-[120px_1fr_160px] md:items-start md:gap-4 " +
                    (i % 2 === 0 ? "bg-white" : "bg-[#fafaf9]")
                  }
                >
                  {/* Data e hora */}
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-[#0a0a0a]">{date}</span>
                    <span className="text-[11px] text-[#a1a1aa]">{time}</span>
                  </div>

                  {/* Ação + detalhes */}
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium " +
                          badge.color
                        }
                      >
                        {badge.label}
                      </span>
                      {log.entityLabel && (
                        <span className="text-[13px] font-medium text-[#0a0a0a]">
                          {log.entityLabel}
                        </span>
                      )}
                    </div>
                    {detail && (
                      <span className="text-[12px] text-[#71717a]">{detail}</span>
                    )}
                  </div>

                  {/* Quem */}
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-[#0a0a0a] truncate">{who}</span>
                    {log.userEmail && log.userName && (
                      <span className="text-[11px] text-[#a1a1aa] truncate">{log.userEmail}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
