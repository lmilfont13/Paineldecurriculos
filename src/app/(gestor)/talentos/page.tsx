import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen, Users } from "lucide-react";

import { TalentBackfillButton } from "@/components/gestor/talent-backfill-button";
import { TalentFolderActions } from "@/components/gestor/talent-folder-actions";
import { TalentBankLink } from "@/components/gestor/talent-bank-link";
import { loadTalentBankLink, loadTalentFolders } from "@/server/controllers/talent.controller";
import { FOLDER_SEPARATOR, groupFoldersByArea } from "@/server/models/talent.model";

export const metadata: Metadata = { title: "Banco de talentos · Triagem" };

/**
 * Banco de talentos: pastas por perfil, agrupadas pela área do currículo, com
 * candidatos que não serviram para a vaga em que se inscreveram mas podem
 * servir para as próximas.
 */
export default async function TalentosPage() {
  const folders = await loadTalentFolders();
  const bankLink = await loadTalentBankLink();
  const total = folders.reduce((sum, f) => sum + f.count, 0);
  const groups = groupFoldersByArea(folders);

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-[#0a0a0a]">Banco de talentos</h1>
        <p className="mt-2 max-w-[640px] text-sm text-[#71717a]">
          Candidatos com bom perfil separados por área e função. Quando abrir uma vaga parecida, a IA confere quem combina.
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
            Na tela de um candidato, use "Guardar em uma pasta". Quem fica abaixo do mínimo da vaga já aparece com a
            sugestão, e o nome da pasta vem da área e da função do currículo.
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
                {total === 1 ? "candidato" : "candidatos"}
              </span>
            </div>
          </div>

          {/* Grupos por área */}
          <div className="mt-5 space-y-8">
            {groups.map((group) => (
              <section key={group.area} aria-label={group.area}>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[13px] font-semibold text-[#0a0a0a]">{group.area}</h2>
                  <span className="text-[12px] text-[#a1a1aa]">
                    {group.folders.length} {group.folders.length === 1 ? "pasta" : "pastas"}
                  </span>
                </div>
                <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {group.folders.map((folder) => {
                    const label = folder.name.startsWith(`${group.area}${FOLDER_SEPARATOR}`)
                      ? folder.name.slice(group.area.length + FOLDER_SEPARATOR.length)
                      : folder.name;
                    return (
                      <li
                        key={folder.id}
                        className="group flex items-center gap-3 rounded-xl border border-[#e4e4e7] bg-white px-4 py-3.5 transition-all hover:border-[#d4d4d8] hover:shadow-sm"
                      >
                        <span
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                          style={{
                            backgroundColor: "color-mix(in srgb, var(--brand-primary) 8%, white)",
                            color: "var(--brand-primary)",
                          }}
                        >
                          <FolderOpen className="size-4" aria-hidden />
                        </span>
                        <Link href={`/talentos/${folder.id}`} className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium text-[#0a0a0a] group-hover:text-[var(--brand-primary)]">
                            {label}
                          </span>
                          <span className="text-[12px] text-[#a1a1aa]">
                            {folder.count} {folder.count === 1 ? "candidato" : "candidatos"}
                          </span>
                        </Link>
                        <TalentFolderActions folderId={folder.id} name={folder.name} />
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
