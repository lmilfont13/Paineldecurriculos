import type { AIState, AppStatus } from "@prisma/client";

export type DashboardStats = {
  openJobs: number;
  totalJobs: number;
  newApplications7d: number;
  meetingMinimum: number;
  inInterview: number;
};

export type PriorityApplication = {
  id: string;
  name: string;
  jobTitle: string;
  aiScore: number | null;
  aiState: AIState;
  status: AppStatus;
  meetsMinimum: boolean;
};

export function personInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1][0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}
