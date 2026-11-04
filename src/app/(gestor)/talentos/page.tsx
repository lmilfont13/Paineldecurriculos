import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen, Users } from "lucide-react";

import { TalentBackfillButton } from "@/components/gestor/talent-backfill-button";
import { TalentFolderActions } from "@/components/gestor/talent-folder-actions";
import { TalentBankLink } from "@/components/gestor/talent-bank-link";
import { loadTalentBankLink, loadTalentFolders } from "@/server/controllers/talent.controller";

export const metadata: Metadata = { title: "Banco de talentos · Triagem" };

/** Cor de fundo suave por área, para diferenciar visualmente os cards. */
const AREA_COLORS: Record<string, string> = {
  Vendas: "#f0fdf4",
  "Trade Marketing": "#eff6ff",
  Atendimento: "#fefce8",
  Beleza: "#fdf2f8",
  Gestão: "#f5f3ff",
  Logística: "#fff7ed",
  Administrativo: "#f0f9ff",
  Saúde: "#ecfdf5",
  TI: "#f8fafc",
  Indústria: "#fafaf9",
  "Cadastros espontâneos": "#fafafa",
  Outros: "#fafafa",
};

function areaColor(name: string): string {
  return AREA_COLORS[name] ?? "#fafafa";
}

export default async function TalentosPage() {
  const folders = await loadTalentFolders();
  const bankLink = await loadTalentBankLink();
  const total = folders.reduce((sum, f) => sum + f.count, 0);

  // Ordena: "Cadastros espontâneos" e "Outros" no final, depois por contagem
  const sorted = [...folders].sort((a, b) => {
    const special = (n: string) => (n === "Cadastros espontâneos" ? 2 : n === "Outros" ? 1 : 0);
    const sa = special(a.name);
    const sb = special(b.name);
    if (sa !== sb) return sa - sb;
    return b.count - a.count;
  });

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-[#0a0a0a]">Banco de talentos</h1>
        <p className="mt-2 max-w-[640px] text-sm text-[#71717a]">
          Candidatos separados por área de atuação. Quando abrir uma vaga, a IA confere quem combina.
        </p>
      </div>

      {bankLink && <TalentBankLink url={bankLink} />}

      <div className="mt-5">
        <TalentBackfillButton />
      </div>

      {folders.length === 0 ? (
        <div className="mt-7 rounded-2xl border border-dashed border-[#e4e4e7] bg-white p-8 text-center">
          <FolderOpen className="mx-auto size-6 text-[#a1a1aa]" aria-hidden />
          <p className="mt-3 text-sm font-medium text-[#0a0a0a]">Nenhuma pasta ainda</p>
          <p className="mx-auto mt-1 max-w-[440px] text-[13px] text-[#71717a]">
            Na tela de um candidato, use &ldquo;Guardar em uma pasta&rdquo;. Quem fica abaixo do mínimo da vaga já aparece com a
            sugestão, e o nome da pasta vem da área do currículo.
          </p>
        </div>
      ) : (
        <>
          {/* Resumo */}
          <div className="mt-6 flex flex-wrap gap-4">
            <div className="flex items-center gap-2 rounded-lg border border-[#e4e4e7] bg-white px-3.5 py-2">
              <FolderOpen className="size-4 text-[#a1a1aa]" aria-hidden />
              <span className="text-[13px] text-[#71717a]">
                <strong className="font-semibold text-[#0a0a0a]">{folders.length}</strong>{" "}
                {folders.length === 1 ? "pasta" : "pastas"}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#e4e4e7] bg-white px-3.5 py-2">
              <Users className="size-4 text-[#a1a1aa]" aria-hidden />
              <span className="text-[13px] text-[#71717a]">
                <strong className="font-semibold text-[#0a0a0a]">{total}</strong>{" "}
                {total === 1 ? "pessoa" : "pessoas"}
              </span>
            </div>
          </div>

          {/* Grid de pastas por área */}
          <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((folder) => (
              <li key={folder.id}>
                <Link
                  href={`/talentos/${folder.id}`}
                  className="group flex items-center gap-3.5 rounded-xl border border-[#e4e4e7] bg-white px-4 py-4 transition-all hover:border-[#d4d4d8] hover:shadow-sm"
                >
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: areaColor(folder.name) }}
                  >
                    <FolderOpen
                      className="size-[18px]"
                      style={{ color: "var(--brand-primary)" }}
                      aria-hidden
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-[#0a0a0a] group-hover:text-[var(--brand-primary)]">
                      {folder.name}
                    </span>
                    <span className="text-[13px] text-[#a1a1aa]">
                      {folder.count} {folder.count === 1 ? "pessoa" : "pessoas"}
                    </span>
                  </span>
                  <TalentFolderActions folderId={folder.id} name={folder.name} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
