"use client";

import { useEffect } from "react";

/**
 * Erro inesperado em qualquer tela (antes aparecia a página padrão do Next,
 * em inglês e sem saída). Não mostra detalhes técnicos ao usuário.
 */
export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[erro de tela]", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#faf8f6] px-6 text-center">
      <h1 className="text-2xl font-semibold text-[#1c1917]">Algo deu errado por aqui</h1>
      <p className="mt-2 max-w-[400px] text-sm leading-6 text-[#57534e]">
        Não foi culpa sua. Tente de novo; se continuar, volte em alguns minutos.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-7 inline-flex h-11 items-center justify-center rounded-xl bg-[#1c1917] px-5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c1917]"
      >
        Tentar de novo
      </button>
      {error.digest && <p className="mt-4 text-[11px] text-[#78716c]">Código para o suporte: {error.digest}</p>}
    </main>
  );
}
