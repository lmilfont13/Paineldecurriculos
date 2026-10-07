import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen } from "lucide-react";

import { TalentFolderActions } from "@/components/gestor/talent-folder-actions";
import { loadTalentFolders } from "@/server/controllers/talent.controller";

export const metadata: Metadata = { title: "Banco de talentos · Triagem" };

/**
 * Banco de talentos: pastas por perfil com candidatos que não serviram para a
 * vaga em que se inscreveram, mas podem servir para as próximas.
 */
export default async function TalentosPage() {
  const folders = await loadTalentFolders();
  const total = folders.reduce((sum, f) => sum + f.count, 0);

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-[#0a0a0a]">Banco de talentos</h1>
        <p className="mt-2 max-w-[620px] text-sm text-[#71717a]">
          Candidatos com bom perfil que não combinaram com a vaga em que se inscreveram, separados por perfil.
          Quando abrir uma vaga parecida, comece por aqui.
        </p>
      </div>

      {folders.length === 0 ? (
        <div className="mt-7 rounded-2xl border border-dashed border-[#e4e4e7] bg-white p-8 text-center">
          <FolderOpen className="mx-auto size-6 text-[#a1a1aa]" aria-hidden />
          <p className="mt-3 text-sm font-medium text-[#0a0a0a]">Nenhuma pasta ainda</p>
          <p className="mx-auto mt-1 max-w-[420px] text-[13px] text-[#71717a]">
            Na tela de um candidato, use “Guardar em uma pasta”. Quem fica abaixo do mínimo da vaga já aparece com a sugestão, e o nome da pasta vem do perfil do currículo.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-6 text-[12px] text-[#a1a1aa]">
            {folders.length} {folders.length === 1 ? "pasta" : "pastas"} · {total}{" "}
            {total === 1 ? "candidato" : "candidatos"}
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {folders.map((folder) => (
              <li
                key={folder.id}
                className="group flex items-center gap-3 rounded-2xl border border-[#e4e4e7] bg-white p-4 transition-colors hover:border-[#d4d4d8]"
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary) 10%, white)", color: "var(--brand-primary)" }}
                >
                  <FolderOpen className="size-4.5" aria-hidden />
                </span>
                <Link href={`/talentos/${folder.id}`} className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-[#0a0a0a]">{folder.name}</span>
                  <span className="text-[12px] text-[#71717a]">
                    {folder.count} {folder.count === 1 ? "candidato" : "candidatos"}
                  </span>
                </Link>
                <TalentFolderActions folderId={folder.id} name={folder.name} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
