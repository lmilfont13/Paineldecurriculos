import type { Metadata } from "next";

import { NotFoundLink } from "@/components/common/not-found-link";

export const metadata: Metadata = { title: "Página não encontrada" };

/**
 * 404 em português (antes aparecia a página padrão do Next, em inglês).
 * Neutra: serve para o candidato, o gestor e o admin.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#faf8f6] px-6 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#78716c]">Erro 404</p>
      <h1 className="mt-3 text-2xl font-semibold text-[#1c1917]">Não encontramos esta página</h1>
      <p className="mt-2 max-w-[380px] text-sm leading-6 text-[#57534e]">
        O endereço pode estar errado, ou a vaga já foi encerrada.
      </p>
      <NotFoundLink />
    </main>
  );
}
