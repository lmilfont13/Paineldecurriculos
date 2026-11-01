import { switchCandidateAccountAction } from "@/server/controllers/candidate.controller";

/**
 * O link da candidatura só abre para a conta de quem se candidatou. Quando outra
 * conta está aberta no navegador, em vez de um 404 seco mostramos o motivo e o
 * caminho: sair e entrar com o e-mail certo.
 */
export function WrongAccountNotice({
  slug,
  nextPath,
  currentEmail,
}: {
  slug: string;
  nextPath: string;
  currentEmail: string;
}) {
  return (
    <div className="mt-10 rounded-2xl border border-[#f0e3c8] bg-[#fdfaf3] p-6">
      <h1 className="text-lg font-bold text-[#0a0a0a]">Este link é de outra conta</h1>
      <p className="mt-2 text-sm leading-6 text-[#57534e]">
        Você está conectado(a) como <strong className="text-[#0a0a0a]">{currentEmail}</strong>, mas esta
        candidatura pertence a outra conta. Entre com o e-mail que foi usado na candidatura para abrir
        a página.
      </p>
      <form action={switchCandidateAccountAction.bind(null, slug, nextPath)} className="mt-5">
        <button
          type="submit"
          className="h-11 rounded-xl px-5 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
        >
          Sair e entrar com outra conta
        </button>
      </form>
    </div>
  );
}
