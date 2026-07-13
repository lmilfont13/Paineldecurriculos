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
