import type { Metadata } from "next";
import { requireManager } from "@/server/controllers/guards";
import { findJobsByCompanyId } from "@/server/repositories/job.repository";
import { getJobSocialPostData } from "@/server/services/social-post.service";
import { InstagramPostCreator } from "@/components/gestor/instagram-post-creator";

export const metadata: Metadata = {
  title: "Divulgação Instagram · Triagem",
};

export default async function DivulgacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ vaga?: string }>;
}) {
  const user = await requireManager();
  const { vaga } = await searchParams;

  const rawJobs = await findJobsByCompanyId(user.companyId);
  const jobs = rawJobs.map((j) => ({
    id: j.id,
    title: j.title,
    code: j.code,
    status: j.status,
    location: j.location,
  }));

  const initialPostData = vaga ? await getJobSocialPostData(vaga, user.companyId) : null;

  return (
    <div className="mx-auto max-w-7xl">
      <InstagramPostCreator
        initialJobs={jobs}
        preselectedJobId={vaga}
        initialPostData={initialPostData}
      />
    </div>
  );
}
