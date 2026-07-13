import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CompareActions } from "@/components/gestor/compare-actions";
import { getCompareData } from "@/server/controllers/gestor.controller";
import { personInitials } from "@/server/models/dashboard.model";

export const metadata: Metadata = { title: "Comparar candidatos · Triagem" };

/** E10 · Comparar candidatos lado a lado (frame 104:175 do Figma). */
export default async function CompararPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;
  const idList = (ids ?? "").split(",").filter(Boolean);
  if (idList.length < 2) redirect("/candidaturas");

  const applications = await getCompareData(idList);
  if (applications.length < 2) redirect("/candidaturas");

  const scores = applications.map((a) => a.aiScore ?? -1);
  const topScore = Math.max(...scores);
  const jobTitles = [...new Set(applications.map((a) => a.job.title))];

  return (
    <>
      <h1 className="text-2xl font-bold text-[#0a0a0a]">
        Comparar candidatos
      </h1>
      <p className="mt-2 text-sm text-[#71717a]">
        {jobTitles.join(" · ")} · {applications.length} candidaturas
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {applications.map((app) => {
          const isTop =
            app.aiScore !== null && app.aiScore === topScore && topScore >= 0;
          const meets =
            app.aiScore !== null && app.aiScore >= app.job.aiMinScore;
          return (
            <div
              key={app.id}
              className={
                "relative flex flex-col rounded-2xl bg-white p-6 " +
                (isTop
                  ? "border-[1.5px] border-[#0a0a0a]"
                  : "border border-[#e4e4e7]")
              }
            >
              {isTop && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#0a0a0a] px-4 py-1 text-[11px] font-medium text-white">
                  Maior score
                </span>
              )}

              <div className="flex flex-col items-center pt-2">
                <span className="flex size-[52px] items-center justify-center rounded-full bg-[#1c1917] text-[15px] font-bold text-white">
                  {personInitials(app.name)}
                </span>
                <h2 className="mt-3 text-[15px] font-semibold text-[#0a0a0a]">
                  {app.name}
                </h2>
                {app.aiScore !== null ? (
                  <>
                    <p
                      className={
                        "mt-1 text-[44px] font-bold " +
                        (meets ? "text-[#1f7a4d]" : "text-[#c23b3b]")
                      }
                    >
                      {app.aiScore}
                    </p>
                    <p className="text-xs text-[#71717a]">
                      /100 · {meets ? "Atende" : "Não atende"}
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-[#71717a]">Sem análise</p>
                )}
              </div>

              <hr className="my-4 border-[#e4e4e7]" />
              <p className="text-[10px] font-medium uppercase tracking-[0.6px] text-[#a1a1aa]">
                Análise da IA
              </p>
              <p className="mt-2 min-h-[54px] text-xs leading-[18px] text-[#0a0a0a]">
                {app.aiReasoning ?? "—"}
              </p>

              <hr className="my-4 border-[#e4e4e7]" />
              <dl className="flex-1 space-y-3">
                <div>
                  <dt className="text-[11px] text-[#a1a1aa]">E-mail</dt>
                  <dd className="truncate text-[13px] font-medium text-[#0a0a0a]">
                    {app.email}
                  </dd>
                </div>
                {app.answers.map((answer) => (
                  <div key={answer.id}>
                    <dt className="text-[11px] text-[#a1a1aa]">
                      {answer.field.label}
                    </dt>
                    <dd className="truncate text-[13px] font-medium text-[#0a0a0a]">
                      {answer.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <hr className="my-4 border-[#e4e4e7]" />
              {app.resumeUrl ? (
                <a
                  href={`/candidaturas/${app.id}/cv`}
                  className="mb-4 text-xs font-medium text-[#71717a] hover:text-[#0a0a0a]"
                >
                  CV: currículo de {app.name.split(" ")[0]} ↓
                </a>
              ) : (
                <p className="mb-4 text-xs text-[#a1a1aa]">Sem currículo</p>
              )}

              <CompareActions applicationId={app.id} name={app.name} />
            </div>
          );
        })}
      </div>

      <Link
        href="/candidaturas"
        className="mt-8 inline-block text-[13px] font-medium text-[#71717a] hover:text-[#0a0a0a]"
      >
        ← Voltar para a lista
      </Link>
    </>
  );
}
