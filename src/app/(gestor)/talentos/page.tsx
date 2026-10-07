import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen } from "lucide-react";

import { TalentFolderActions } from "@/components/gestor/talent-folder-actions";
import { loadTalentFolders } from "@/server/controllers/talent.controller";
import { FOLDER_SEPARATOR, groupFoldersByArea } from "@/server/models/talent.model";

export const metadata: Metadata = { title: "Banco de talentos · Triagem" };

/**
 * Banco de talentos: pastas por perfil, agrupadas pela área do currículo, com
 * candidatos que não serviram para a vaga em que se inscreveram mas podem
 * servir para as próximas.
 */
export default async function TalentosPage() {
  const folders = await loadTalentFolders();
  const total = folders.reduce((sum, f) => sum + f.count, 0);
  const groups = groupFoldersByArea(folders);

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-[#0a0a0a]">Banco de talentos</h1>
        <p className="mt-2 max-w-[640px] text-sm text-[#71717a]">
          Candidatos com bom perfil que não combinaram com a vaga em que se inscreveram, separados por área e função
          do currículo. Eles ficam em stand-by: quando abrir uma vaga parecida, a IA confere quem combina.
        </p>
      </div>

      {folders.length === 0 ? (
        <div className="mt-7 rounded-2xl border border-dashed border-[#e4e4e7] bg-white p-8 text-center">
          <FolderOpen className="mx-auto size-6 text-[#a1a1aa]" aria-hidden />
          <p className="mt-3 text-sm font-medium text-[#0a0a0a]">Nenhuma pasta ainda</p>
          <p className="mx-auto mt-1 max-w-[440px] text-[13px] text-[#71717a]">
            Na tela de um candidato, use “Guardar em uma pasta”. Quem fica abaixo do mínimo da vaga já aparece com a
            sugestão, e o nome da pasta vem da área e da função do currículo.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-6 text-[12px] text-[#a1a1aa]">
            {groups.length} {groups.length === 1 ? "área" : "áreas"} · {folders.length}{" "}
            {folders.length === 1 ? "pasta" : "pastas"} · {total} {total === 1 ? "candidato" : "candidatos"}
          </p>
          <div className="mt-3 space-y-7">
            {groups.map((group) => (
              <section key={group.area} aria-label={group.area}>
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.6px] text-[#71717a]">
                  {group.area}
                </h2>
                <ul className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.folders.map((folder) => {
                    const label = folder.name.startsWith(`${group.area}${FOLDER_SEPARATOR}`)
                      ? folder.name.slice(group.area.length + FOLDER_SEPARATOR.length)
                      : folder.name;
                    return (
                      <li
                        key={folder.id}
                        className="flex items-center gap-3 rounded-2xl border border-[#e4e4e7] bg-white p-4 transition-colors hover:border-[#d4d4d8]"
                      >
                        <span
                          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                          style={{
                            backgroundColor: "color-mix(in srgb, var(--brand-primary) 10%, white)",
                            color: "var(--brand-primary)",
                          }}
                        >
                          <FolderOpen className="size-4.5" aria-hidden />
                        </span>
                        <Link href={`/talentos/${folder.id}`} className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold text-[#0a0a0a]">{label}</span>
                          <span className="flex items-center gap-1.5 text-[12px] text-[#71717a]">
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
