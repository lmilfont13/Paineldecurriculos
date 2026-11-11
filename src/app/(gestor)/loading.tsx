/**
 * Enquanto a tela do gestor carrega os dados (2 a 5 s em algumas telas), o
 * conteúdo dá sinal de vida em vez de a navegação parecer travada.
 */
export default function GestorLoading() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse p-1">
      <span className="sr-only">Carregando…</span>
      <div className="h-7 w-48 rounded-lg bg-[#ececec]" />
      <div className="mt-3 h-4 w-72 max-w-full rounded bg-[#f1f1f1]" />
      <div className="mt-8 space-y-3">
        <div className="h-24 rounded-2xl bg-[#f1f1f1]" />
        <div className="h-16 rounded-2xl bg-[#f4f4f4]" />
        <div className="h-16 rounded-2xl bg-[#f4f4f4]" />
        <div className="h-16 rounded-2xl bg-[#f4f4f4]" />
      </div>
    </div>
  );
}
