import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CompanyFooter, CompanyHeader } from "@/components/public/company-header";
import { getPrivacyPageData, getPublicSession } from "@/server/controllers/public.controller";
import { CONSENT_VERSION, privacyNotice } from "@/server/models/consent.model";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPrivacyPageData(slug);
  return { title: data ? `Aviso de Privacidade · ${data.company.name}` : "Aviso de Privacidade" };
}

/** Aviso de Privacidade (LGPD) da empresa — linkado no aceite da candidatura. */
export default async function PrivacyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getPrivacyPageData(slug);
  const candidate = await getPublicSession();
  if (!data) notFound();
  const { company, contactEmail } = data;
  const sections = privacyNotice(company.name, contactEmail);
  const [year, month, day] = CONSENT_VERSION.slice(0, 10).split("-");

  return (
    <>
      <CompanyHeader company={company} candidate={candidate} />
      <main className="mx-auto w-full max-w-[760px] flex-1 px-5 pt-8 md:px-8 md:pt-10">
        <Link
          href={`/${company.slug}/vagas`}
          className="text-[13px] font-medium text-[#78716c] hover:text-[#1c1917]"
        >
          ← Voltar para as vagas
        </Link>
        <h1 className="mt-6 text-[28px] font-bold leading-tight tracking-[-0.3px] text-[#1c1917] md:text-[34px]">
          Aviso de Privacidade
        </h1>
        <p className="mt-2 text-sm text-[#78716c]">
          Como a {company.name} trata os dados de quem se candidata por este site, conforme a Lei
          Geral de Proteção de Dados (Lei nº 13.709/2018). Versão de {day}/{month}/{year}.
        </p>

        <div className="mt-8 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-[15px] font-semibold text-[#1c1917]">{section.title}</h2>
              <div className="mt-2 space-y-3">
                {section.paragraphs.map((p) => (
                  <p key={p.slice(0, 40)} className="text-[15px] leading-7 text-[#44403c]">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <CompanyFooter company={company} />
    </>
  );
}
