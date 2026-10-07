import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AiScoreChip } from "@/components/gestor/ai-score-chip";
import { CandidateAvatar } from "@/components/gestor/candidate-avatar";
import { RemoveFromFolderButton } from "@/components/gestor/talent-folder-actions";
import { loadTalentFolder } from "@/server/controllers/talent.controller";
import { appStatusLabels } from "@/server/models/application.model";

export const metadata: Metadata = { title: "Banco de talentos · Triagem" };

export default async function TalentFolderPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = await params;
  const folder = await loadTalentFolder(folderId);
  if (!folder) notFound();

  return (
    <>
      <Link href="/talentos" className="text-[13px] text-[#71717a] hover:text-[#0a0a0a]">
        ← Banco de talentos
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-[#0a0a0a]">{folder.name}</h1>
      <p className="mt-1.5 text-sm text-[#71717a]">
        {folder.people.length} {folder.people.length === 1 ? "candidato" : "candidatos"}
      </p>

      <div className="mt-6 divide-y divide-[#e4e4e7] overflow-hidden rounded-2xl border border-[#e4e4e7] bg-white">
        {folder.people.length === 0 && (
          <p className="p-6 text-sm text-[#71717a]">Pasta vazia.</p>
        )}
        {folder.people.map((person) => (
          <div key={person.id} className="flex flex-wrap items-center gap-3 px-5 py-4 sm:flex-nowrap">
            <Link href={`/candidaturas/${person.id}`} className="flex min-w-0 flex-1 items-center gap-3">
              <CandidateAvatar
                name={person.name}
                photoUrl={person.photoUrl}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1c1917] text-[10px] font-bold text-white"
              />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-[#0a0a0a]">{person.name}</span>
                <span className="block truncate text-[12px] text-[#71717a]">
                  {person.aiProfile ? `${person.aiProfile} · ` : ""}se inscreveu em {person.job.title}
                </span>
              </span>
            </Link>
            <span className="hidden text-[11px] text-[#a1a1aa] sm:block">
              {appStatusLabels[person.status]}
            </span>
            <AiScoreChip
              aiScore={person.aiScore}
              aiState={person.aiState}
              meetsMinimum={person.aiScore !== null && person.aiScore >= person.job.aiMinScore}
            />
            <RemoveFromFolderButton folderId={folder.id} applicationId={person.id} name={person.name} />
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-[#a1a1aa]">
        A nota é a da vaga em que a pessoa se inscreveu, não de uma vaga nova.
      </p>
    </>
  );
}
