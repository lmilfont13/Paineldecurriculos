import { setShowcaseConsentAction } from "@/server/controllers/candidate.controller";
import { displayName } from "@/server/models/showcase.model";

/**
 * Para quem foi aprovado: autorizar (ou não) o nome completo e a vaga na
 * página pública de vagas. Nada aparece sem o "sim"; dá para mudar depois.
 */
export function ShowcaseConsentCard({
  slug,
  applicationId,
  companyName,
  jobTitle,
  name,
  consent,
  hidden,
}: {
  slug: string;
  applicationId: string;
  companyName: string;
  jobTitle: string;
  name: string;
  consent: boolean | null;
  hidden: boolean;
}) {
  const accept = setShowcaseConsentAction.bind(null, slug, applicationId, true);
  const decline = setShowcaseConsentAction.bind(null, slug, applicationId, false);

  if (consent === true) {
    return (
      <section className="mt-6 rounded-2xl border border-[#e4e4e7] bg-white p-6">
        <p className="text-sm font-semibold text-[#0a0a0a]">
          {hidden ? "Autorização registrada" : "Você aparece na página de vagas"}
        </p>
        <p className="mt-1 text-[13px] leading-5 text-[#71717a]">
          {hidden
            ? `Você autorizou, mas a ${companyName} ainda não está mostrando o seu nome.`
            : `Seu nome e a vaga "${jobTitle}" aparecem em "Quem já entrou pela ${companyName}".`}
        </p>
        <form action={decline} className="mt-4">
          <button
            type="submit"
            className="text-[13px] font-medium text-[#71717a] underline underline-offset-2 hover:text-[#0a0a0a]"
          >
            Não quero mais aparecer
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-[#e4e4e7] bg-white p-6">
      <p className="text-sm font-semibold text-[#0a0a0a]">
        {consent === false ? "Você preferiu não aparecer" : "Quer aparecer como contratado(a)?"}
      </p>
      <p className="mt-1 text-[13px] leading-5 text-[#71717a]">
        A {companyName} mostra na página de vagas quem já foi contratado por aqui. Se você
        autorizar, aparece <strong className="font-medium text-[#0a0a0a]">{displayName(name)}</strong>, a vaga e o mês
        da contratação. Nada além disso. Você pode mudar quando quiser.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <form action={accept}>
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-xl px-4 text-[13px] font-semibold hover:opacity-90"
            style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-foreground)" }}
          >
            Sim, pode mostrar
          </button>
        </form>
        {consent === null && (
          <form action={decline}>
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-xl border border-[#e4e4e7] bg-white px-4 text-[13px] font-medium text-[#0a0a0a] hover:bg-[#fafaf9]"
            >
              Prefiro não
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
