"use server";

import { requireManager } from "@/server/controllers/guards";
import {
  parseJobAnnouncementText,
  getJobSocialPostData,
  generateInstagramCaption,
} from "@/server/services/social-post.service";
import {
  publishToInstagramFeed,
  type InstagramPublishResult,
} from "@/server/services/instagram-publish.service";
import { findJobsByCompanyId } from "@/server/repositories/job.repository";
import { SocialJobPostData } from "@/server/models/social-post.model";
import { readEnv } from "@/lib/env";

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

export async function checkInstagramConfigAction() {
  await requireManager();
  const hasAccountId = Boolean(readEnv("INSTAGRAM_ACCOUNT_ID") || readEnv("META_INSTAGRAM_ACCOUNT_ID"));
  const hasAccessToken = Boolean(readEnv("INSTAGRAM_ACCESS_TOKEN") || readEnv("META_ACCESS_TOKEN"));
  return {
    configured: hasAccountId && hasAccessToken,
    hasAccountId,
    hasAccessToken,
  };
}

export async function publishToInstagramAction(params: {
  imageBase64: string;
  caption: string;
  accountId?: string;
  accessToken?: string;
}): Promise<InstagramPublishResult> {
  await requireManager();
  return publishToInstagramFeed(params);
}
