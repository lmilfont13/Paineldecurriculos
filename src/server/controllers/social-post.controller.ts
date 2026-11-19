"use server";

import { requireManager } from "@/server/controllers/guards";
import {
  parseJobAnnouncementText,
  getJobSocialPostData,
  generateInstagramCaption,
} from "@/server/services/social-post.service";
import { findJobsByCompanyId } from "@/server/repositories/job.repository";
import { SocialJobPostData } from "@/server/models/social-post.model";

export async function parseSocialPostAction(rawText: string): Promise<SocialJobPostData> {
  const user = await requireManager();
  return parseJobAnnouncementText(rawText, user.companyId);
}

export async function getJobSocialPostAction(jobId: string): Promise<SocialJobPostData | null> {
  const user = await requireManager();
  return getJobSocialPostData(jobId, user.companyId);
}

export async function getAvailableJobsForSocialAction() {
  const user = await requireManager();
  const jobs = await findJobsByCompanyId(user.companyId);
  return jobs.map((j) => ({
    id: j.id,
    title: j.title,
    code: j.code,
    status: j.status,
    location: j.location,
  }));
}

export async function generateCaptionAction(data: SocialJobPostData, companyName?: string) {
  await requireManager();
  return generateInstagramCaption(data, companyName);
}
