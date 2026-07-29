import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ApplyWizard } from "@/components/public/apply/apply-wizard";
import { CompanyHeader } from "@/components/public/company-header";
import { getApplyPageData } from "@/server/controllers/public.controller";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; jobId: string }>;
}): Promise<Metadata> {
  const { slug, jobId } = await params;
  const data = await getApplyPageData(slug, jobId);
  return {
    title: data
      ? `Candidatar-se · ${data.job.title} · ${data.company.name}`
      : "Candidatar-se",
  };
}

/** P3–P7 · Candidatura multi-step (frames 87:72..87:243 do Figma). */
export default async function ApplyPage({
  params,
}: {
  params: Promise<{ slug: string; jobId: string }>;
}) {
  const { slug, jobId } = await params;
  const data = await getApplyPageData(slug, jobId);
  if (!data) notFound();

  // CA1: candidatar exige conta — sem sessão, cria/entra e volta para cá
  if (!data.candidate) {
    redirect(
      `/${slug}/entrar?next=${encodeURIComponent(`/${slug}/vagas/${jobId}/candidatar`)}`
    );
  }

  // Detecção precoce: já se candidatou → não faz sentido mostrar o wizard
  if (data.alreadyAppliedId) {
    return (
      <>
        <CompanyHeader company={data.company} candidate={data.candidate} />
        <main className="mx-auto w-full max-w-[512px] flex-1 px-6 pt-16">
          <div className="rounded-3xl border border-[#e4e4e7] bg-white p-8 text-center shadow-[0px_4px_6px_rgba(0,0,0,0.07)]">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#e4f6ec] text-xl text-[#1f7a4d]">
              ✓
            </span>
            <h1 className="mt-5 text-2xl font-semibold text-[#0a0a0a]">
              Você já se candidatou a esta vaga
            </h1>
            <p className="mt-2 text-sm text-[#71717a]">
              Sua candidatura para {data.job.title} está registrada — acompanhe
              o andamento na sua área.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3">
              <a
                href={`/${slug}/minhas-candidaturas/${data.alreadyAppliedId}`}
                className="flex h-11 w-full max-w-[280px] items-center justify-center rounded-2xl text-sm font-medium hover:opacity-90"
                style={{
                  backgroundColor: "var(--brand-primary)",
                  color: "var(--brand-foreground)",
                }}
              >
                Ver minha candidatura
              </a>
              <a
                href={`/${slug}/vagas`}
                className="text-[13px] font-medium text-[#71717a] hover:text-[#0a0a0a]"
              >
                Ver outras vagas
              </a>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <CompanyHeader company={data.company} candidate={data.candidate} />
      <main className="flex-1 pt-14">
        <ApplyWizard
          company={data.company}
          job={data.job}
          coreFields={data.coreFields}
          customFields={data.customFields}
          candidate={data.candidate}
          prefillAnswers={data.prefillAnswers}
        />
      </main>
    </>
  );
}
