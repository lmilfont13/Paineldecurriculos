import "server-only";

import { jobLabel } from "@/server/models/candidate-list.model";
import { cleanDigits, cleanEmail, cleanName } from "@/server/models/cv-search.model";
import { inferGender } from "@/server/models/talent-dashboard.model";
import { titleCasePt } from "@/server/models/text.model";

import type {
  DailyRegistrationPoint,
  DashboardAnalytics,
  DashboardStats,
  JobProgress,
  PriorityApplication,
  TopJobRegistration,
} from "@/server/models/dashboard.model";
import { findDashboardApplications } from "@/server/repositories/application.repository";
import { findDashboardJobs } from "@/server/repositories/job.repository";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const brDateKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const brDayMonthFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
});

const brWeekdayFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
});

/**
 * Dados do E1 · Painel — sempre escopados ao companyId da sessão (regra 1).
 *
 * A prioridade combina espera e aderência: quem está há mais tempo sem
 * resposta sobe, e o score desempata. Ordenar só por score fazia um candidato
 * de duas semanas atrás desaparecer atrás de quem chegou hoje.
 */
export async function getDashboard(companyId: string): Promise<{
  stats: DashboardStats;
  priority: PriorityApplication[];
  jobs: JobProgress[];
  analytics: DashboardAnalytics;
}> {
  const now = Date.now();
  const since7d = new Date(now - WEEK_MS);
  // Sequencial: com connection_limit=1 o Promise.all só enfileira na
  // mesma conexão e aumenta o risco de P2024 (pool_timeout).
  const allApplications = await findDashboardApplications(companyId);
  const allJobs = await findDashboardJobs(companyId);

  // Vagas abertas para a fila de trabalho ativa
  const applications = allApplications.filter(
    (a) => !a.job.isTalentPool && (!a.job.status || a.job.status === "OPEN")
  );

  const waitingList = applications.filter((a) => a.status === "PENDING");
  const oldestWaitingAt = waitingList.reduce<Date | null>(
    (oldest, a) => (!oldest || a.createdAt < oldest ? a.createdAt : oldest),
    null
  );

  const stats: DashboardStats = {
    openJobs: allJobs.filter((j) => j.status === "OPEN").length,
    totalJobs: allJobs.length,
    waiting: waitingList.length,
    oldestWaitingAt,
    decided7d: applications.filter(
      (a) =>
        (a.status === "APPROVED" || a.status === "REJECTED") &&
        a.updatedAt >= since7d
    ).length,
    newApplications7d: allApplications.filter((a) => a.createdAt >= since7d).length,
    totalApplications: allApplications.length,
  };

  const priority: PriorityApplication[] = waitingList
    .map((a) => ({
      id: a.id,
      name: titleCasePt(a.name),
      jobTitle: jobLabel(a.job.title, a.job.code),
      aiScore: a.aiScore,
      aiState: a.aiState,
      status: a.status,
      meetsMinimum: a.aiScore !== null && a.aiScore >= a.job.aiMinScore,
      createdAt: a.createdAt,
      photoPath: a.photoPath,
      hasImpediment: a.hasImpediment,
      impedimentReason: a.impedimentReason,
    }))
    .sort((a, b) => {
      const byWait = a.createdAt.getTime() - b.createdAt.getTime();
      if (byWait !== 0) return byWait;
      return (b.aiScore ?? -1) - (a.aiScore ?? -1);
    })
    .slice(0, 5);

  // Uma passagem pela base, em vez de varrer todas as candidaturas para cada vaga.
  const countsByJob = new Map<
    string,
    {
      total: number;
      pending: number;
      interview: number;
      approved: number;
      rejected: number;
    }
  >();
  for (const application of applications) {
    const counts = countsByJob.get(application.job.id) ?? {
      total: 0,
      pending: 0,
      interview: 0,
      approved: 0,
      rejected: 0,
    };
    counts.total += 1;
    if (application.status === "PENDING") counts.pending += 1;
    if (application.status === "INTERVIEW") counts.interview += 1;
    if (application.status === "APPROVED") counts.approved += 1;
    if (application.status === "REJECTED") counts.rejected += 1;
    countsByJob.set(application.job.id, counts);
  }

  // Rascunho entra na lista: é trabalho parado esperando o dono publicar.
  const jobs: JobProgress[] = allJobs
    .filter((j) => j.status !== "CLOSED")
    .map((job) => ({
      id: job.id,
      title: jobLabel(job.title, job.code),
      status: job.status,
      ...(countsByJob.get(job.id) ?? {
        total: 0,
        pending: 0,
        interview: 0,
        approved: 0,
        rejected: 0,
      }),
    }))
    .sort((a, b) => {
      if (a.status === "DRAFT" && b.status !== "DRAFT") return -1;
      if (b.status === "DRAFT" && a.status !== "DRAFT") return 1;
      return b.pending - a.pending;
    });

  // --- Micro-Dashboard Analítico Discreto ---
  // 1) Cadastros por dia (últimos 7 dias no fuso America/Sao_Paulo)
  const dailyMap = new Map<string, DailyRegistrationPoint>();
  const dailyRegistrations: DailyRegistrationPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * DAY_MS);
    const dateKey = brDateKeyFmt.format(d);
    const dayMonth = brDayMonthFmt.format(d);
    const rawWeekday = brWeekdayFmt.format(d).replace(/\.$/, "");
    const weekday =
      i === 0
        ? "Hoje"
        : rawWeekday.charAt(0).toUpperCase() + rawWeekday.slice(1, 3);
    const pt: DailyRegistrationPoint = {
      dateKey,
      dayMonth,
      weekday,
      count: 0,
      isToday: i === 0,
    };
    dailyMap.set(dateKey, pt);
    dailyRegistrations.push(pt);
  }

  for (const app of allApplications) {
    const key = brDateKeyFmt.format(app.createdAt);
    const bucket = dailyMap.get(key);
    if (bucket) bucket.count += 1;
  }

  const todayRegistrations = dailyRegistrations[dailyRegistrations.length - 1]?.count ?? 0;
  const last7DaysTotal = dailyRegistrations.reduce((sum, d) => sum + d.count, 0);

  // 2) Candidatos únicos e Gênero (Homens × Mulheres)
  const uniquePeopleMap = new Map<string, { name: string }>();
  for (const app of allApplications) {
    const cpfKey = cleanDigits(app.cpf);
    const emailKey = cleanEmail(app.email);
    const nameKey = cleanName(app.name);
    const personKey =
      (cpfKey.length >= 11 ? `cpf:${cpfKey}` : null) ||
      (app.candidateId ? `cid:${app.candidateId}` : null) ||
      (emailKey ? `em:${emailKey}` : null) ||
      `nm:${nameKey || app.id}`;
    if (!uniquePeopleMap.has(personKey)) {
      uniquePeopleMap.set(personKey, { name: app.name });
    }
  }

  let femaleCount = 0;
  let maleCount = 0;
  let unspecifiedCount = 0;
  for (const person of uniquePeopleMap.values()) {
    const g = inferGender(person.name);
    if (g === "Feminino") femaleCount += 1;
    else if (g === "Masculino") maleCount += 1;
    else unspecifiedCount += 1;
  }
  const uniquePeople = uniquePeopleMap.size;
  const knownGenderTotal = Math.max(1, femaleCount + maleCount);
  const femalePct =
    femaleCount + maleCount > 0 ? Math.round((femaleCount / knownGenderTotal) * 100) : 0;
  const malePct =
    femaleCount + maleCount > 0 ? 100 - femalePct : 0;
  const unspecifiedPct =
    uniquePeople > 0 ? Math.round((unspecifiedCount / uniquePeople) * 100) : 0;

  // 3) Vagas com mais cadastros
  const allJobCounts = new Map<
    string,
    {
      id: string;
      title: string;
      code: string | null;
      status: JobProgress["status"];
      count: number;
    }
  >();
  let totalNonPoolApps = 0;
  for (const app of allApplications) {
    if (app.job.isTalentPool) continue;
    totalNonPoolApps += 1;
    const entry = allJobCounts.get(app.job.id) ?? {
      id: app.job.id,
      title: app.job.title,
      code: app.job.code,
      status: app.job.status ?? "OPEN",
      count: 0,
    };
    entry.count += 1;
    allJobCounts.set(app.job.id, entry);
  }
  const topJobs: TopJobRegistration[] = Array.from(allJobCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map((j) => ({
      ...j,
      pct: totalNonPoolApps > 0 ? Math.round((j.count / totalNonPoolApps) * 100) : 0,
    }));

  // 4) Qualidade IA, Top Áreas, Top Funções, Cidades, Idade, Senioridade e Funil
  let scoreSum = 0;
  let scoredCount = 0;
  let aboveCutoffCount = 0;
  let topMatchCount = 0;
  let readyToAdvanceCount = 0;
  let withCnhCount = 0;
  let immediateCount = 0;
  const areaCounts = new Map<string, number>();
  const roleCounts = new Map<string, number>();
  const cityCounts = new Map<string, number>();
  const levelCounts = new Map<string, number>();
  const ages: number[] = [];
  const funnel = {
    pending: 0,
    shortlisted: 0,
    interview: 0,
    standby: 0,
    approved: 0,
    rejected: 0,
  };

  const currentYear = new Date(now).getUTCFullYear();

  for (const app of allApplications) {
    if (app.status === "PENDING") funnel.pending += 1;
    else if (app.status === "SHORTLISTED") funnel.shortlisted += 1;
    else if (app.status === "INTERVIEW") funnel.interview += 1;
    else if (app.status === "STANDBY") funnel.standby += 1;
    else if (app.status === "APPROVED") funnel.approved += 1;
    else if (app.status === "REJECTED") funnel.rejected += 1;

    if (app.aiScore !== null) {
      scoreSum += app.aiScore;
      scoredCount += 1;
      if (app.aiScore >= app.job.aiMinScore) {
        aboveCutoffCount += 1;
        if (app.status === "PENDING" && !app.hasImpediment) {
          readyToAdvanceCount += 1;
        }
      }
      if (app.aiScore >= 80) topMatchCount += 1;
    }

    if (app.hasCnh && app.hasCnh !== "NONE") withCnhCount += 1;
    if (app.availability === "IMMEDIATE") immediateCount += 1;

    if (app.birthDate) {
      const bYear = app.birthDate.getUTCFullYear();
      const age = currentYear - bYear;
      if (age >= 15 && age <= 85) {
        ages.push(age);
      }
    }

    if (app.aiArea && app.aiArea.trim()) {
      const area = titleCasePt(app.aiArea.trim());
      areaCounts.set(area, (areaCounts.get(area) ?? 0) + 1);
    }

    if (app.aiProfile && app.aiProfile.trim()) {
      const role = titleCasePt(app.aiProfile.trim());
      roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
    }

    if (app.aiLevel && app.aiLevel.trim()) {
      const lvl = titleCasePt(app.aiLevel.trim());
      levelCounts.set(lvl, (levelCounts.get(lvl) ?? 0) + 1);
    }

    const locRaw = app.city?.trim() || app.neighborhood?.trim();
    if (locRaw) {
      const loc = titleCasePt(locRaw);
      cityCounts.set(loc, (cityCounts.get(loc) ?? 0) + 1);
    }
  }

  const toRankedList = (map: Map<string, number>, maxItems: number) => {
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxItems)
      .map(([label, count]) => ({
        label,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
      }));
  };

  const topAreas = toRankedList(areaCounts, 3);
  const topRoles = toRankedList(roleCounts, 4);
  const topCities = toRankedList(cityCounts, 4);
  const levels = toRankedList(levelCounts, 4);

  const avgAge =
    ages.length > 0
      ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)
      : null;
  const ageBuckets = [
    { label: "Até 24a", count: ages.filter((a) => a <= 24).length },
    { label: "25 a 34a", count: ages.filter((a) => a >= 25 && a <= 34).length },
    { label: "35 a 44a", count: ages.filter((a) => a >= 35 && a <= 44).length },
    { label: "45+ anos", count: ages.filter((a) => a >= 45).length },
  ].map((b) => ({
    ...b,
    pct: ages.length > 0 ? Math.round((b.count / ages.length) * 100) : 0,
  }));

  const analytics: DashboardAnalytics = {
    totalRegistrations: allApplications.length,
    uniquePeople,
    todayRegistrations,
    last7DaysTotal,
    dailyRegistrations,
    topJobs,
    gender: {
      femaleCount,
      femalePct,
      maleCount,
      malePct,
      unspecifiedCount,
      unspecifiedPct,
    },
    quality: {
      avgScore: scoredCount > 0 ? Math.round(scoreSum / scoredCount) : null,
      aboveCutoffCount,
      aboveCutoffPct: scoredCount > 0 ? Math.round((aboveCutoffCount / scoredCount) * 100) : 0,
      topMatchCount,
    },
    topAreas,
    topRoles,
    topCities,
    levels,
    ageSummary: {
      avgAge,
      brackets: ageBuckets,
    },
    readiness: {
      withCnhCount,
      immediateCount,
      readyToAdvanceCount,
    },
    funnel,
  };

  return { stats, priority, jobs, analytics };
}
