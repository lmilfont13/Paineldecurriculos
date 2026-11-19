import type { Metadata } from "next";
import { ClipboardList, Download, Eye, FileText, History, Lock, MessageSquare, Sparkles, UserRound } from "lucide-react";
import { SectionEyebrow } from "@/components/gestor/section-eyebrow";
import { formatPhone } from "@/lib/phone";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DecisionBlock } from "@/components/gestor/decision-block";
import { ImpedimentToggle } from "@/components/gestor/impediment-toggle";
import { CandidateDetailSplitView } from "@/components/gestor/candidate-detail-split-view";
import { CandidateRegistrationEditor } from "@/components/gestor/candidate-registration-editor";
import { ResumeLightboxButton } from "@/components/gestor/resume-lightbox-button";
import { SyncResumeBanner } from "@/components/gestor/sync-resume-banner";
import { extractStandbyReason } from "@/server/models/standby.model";
import { DeleteApplicationButton } from "@/components/gestor/delete-application-button";
import { LiveRefresh } from "@/components/gestor/live-refresh";
import { InfoRequestBox } from "@/components/gestor/info-request-box";
import { jobLabel } from "@/server/models/candidate-list.model";
import { MessageBox } from "@/components/gestor/message-box";
import { appUrl } from "@/lib/env";
import {
  INFO_FIELDS,
  knownInfoOf,
  maskCpf,
  maskRg,
  missingInfoFields,
  type InfoField,
} from "@/server/models/pre-interview.model";
import { NotesForm } from "@/components/gestor/notes-form";
import { formatBirthDate } from "@/server/models/age.model";
import { formatAddress } from "@/server/models/address.model";
import { AnswersEditor } from "@/components/gestor/answers-editor";
import { AskAiBox } from "@/components/gestor/ask-ai-box";
import { ReanalyzeButton } from "@/components/gestor/reanalyze-button";
import { ReextractPhotoButton } from "@/components/gestor/reextract-photo-button";
import { CareerCard } from "@/components/gestor/career-card";
import { ManagerIntakeCard } from "@/components/gestor/manager-intake-card";
import { getIntakeInvite } from "@/server/controllers/intake.controller";
import { TalentPoolCard } from "@/components/gestor/talent-pool-card";
import { readCareer } from "@/server/models/career.model";
import { loadApplicationTalentInfo } from "@/server/controllers/talent.controller";
import { suggestTalentPool } from "@/server/models/talent.model";
import { readChecklist, scoredWithoutResumeText } from "@/server/models/ai.model";
import { readTenure } from "@/server/models/tenure.model";
import { TenureCard } from "@/components/gestor/tenure-card";
import { getCandidaturaDetail } from "@/server/controllers/gestor.controller";
import {
  listInterviewEvaluationsAction,
  listMessageTemplatesAction,
} from "@/server/controllers/application.controller";
import { InterviewEvaluationCard } from "@/components/gestor/interview-evaluation-card";
import {
  showInterviewEvaluation,
  suggestedCriteria,
} from "@/server/models/interview-evaluation.model";
import {
  appStatusLabels,
  formatAppliedAt,
  formatWaiting,
  type AppStatusKey,
} from "@/server/models/application.model";
import { ZoomableCandidateAvatar } from "@/components/gestor/zoomable-candidate-avatar";
import { WhatsAppQuickButton } from "@/components/gestor/whatsapp-quick-templates";
import { isWhatsappTemplatesEnabled } from "@/server/services/company-feature.service";
import { instagramUrl } from "@/server/models/instagram.model";
import { ExternalLink } from "lucide-react";
import {
  interviewSummary,
  isPastInterview,
} from "@/server/models/interview.model";

function toLocalInput(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function historyLine(
  from: AppStatusKey | null,
  to: AppStatusKey,
  actor: string
): string {
  if (from === null) return "Candidatura enviada pelo candidato";
  const who = actor === "gestor" ? "Você" : "O sistema";
  return `${who} moveu de "${appStatusLabels[from]}" para "${appStatusLabels[to]}"`;
}

export const metadata: Metadata = { title: "Candidatura · Triagem" };

// Banco de talentos (até 5 vagas) e análise de perfil (até 3) rodam na hora.
export const maxDuration = 60;

export default async function CandidaturaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const app = await getCandidaturaDetail(id);
  const talent = app ? await loadApplicationTalentInfo(app.id) : null;
  const messageTemplates = app ? await listMessageTemplatesAction() : [];
  const intake =
    app && (app.preRegistered || !app.resumeUrl)
      ? await getIntakeInvite(app.id, app.job.id, app.job.title, app.name, app.email, app.phone)
      : null;
  if (!app) notFound();
  const whatsappTemplatesEnabled = await isWhatsappTemplatesEnabled(app.company.id);

  const meets = app.aiScore !== null && app.aiScore >= app.job.aiMinScore;
  const coreAnswers = app.answers.filter((a) => a.field.isCore);
  const customAnswers = app.answers.filter((a) => !a.field.isCore);
  const uniformLine =
    [
      app.bootSize && `Bota ${app.bootSize}`,
      app.pantsSize && `Calça ${app.pantsSize}`,
      app.shirtSize && `Blusa ${app.shirtSize}`,
    ]
      .filter(Boolean)
      .join(" · ") || null;
  const bankLine =
    app.hasBankAccount === "no"
      ? "Não possui conta bancária"
      : app.hasBankAccount === "yes"
        ? [
            app.bankNames,
            app.bankAccountType === "corrente"
              ? "conta corrente"
              : app.bankAccountType === "poupanca"
                ? "poupança"
                : app.bankAccountType === "salario"
                  ? "conta salário"
                  : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Possui conta (bancos não informados)"
        : null;
  const infoPairs: [string, string][] = [
    ["E-mail", app.email],
    ["Telefone", formatPhone(app.phone) || "—"],
    ...(formatAddress(app) ? ([["Endereço", formatAddress(app) as string]] as [string, string][]) : []),
    ...(uniformLine ? ([["Uniforme", uniformLine]] as [string, string][]) : []),
    ...(bankLine ? ([["Conta bancária", bankLine]] as [string, string][]) : []),
    ...coreAnswers.map((a) => [a.field.label, a.value] as [string, string]),
    ...customAnswers.map((a) => [a.field.label, a.value] as [string, string]),
  ];
  const analyzing = app.aiState === "WAITING" || app.aiState === "PROCESSING";
  const checklist = readChecklist(app.aiChecklist);
  const tenure = readTenure((app as { aiTenure?: unknown }).aiTenure ?? app.aiChecklist, app.resumeText);

  const interview = app.interviewAt
    ? {
        at: toLocalInput(app.interviewAt),
        summary: interviewSummary(app.interviewAt, app.interviewMode),
        mode: app.interviewMode ?? "Videochamada",
        location: app.interviewLocation ?? "",
        past: isPastInterview(app.interviewAt),
      }
    : null;

  // Ficha de avaliação da entrevista (interna). Sequencial: connection_limit=1.
  const { evaluations, currentUserId } = await listInterviewEvaluationsAction(app.id);
  const showEvaluation = showInterviewEvaluation({
    status: app.status,
    interviewAt: app.interviewAt,
    hasEvaluations: evaluations.length > 0,
  });

  const editableAnswers = [...coreAnswers, ...customAnswers]
    .filter((a) => a.field.type !== "FILE_UPLOAD")
    .map((a) => ({
      id: a.id,
      label: a.field.label,
      value: a.value,
      type: a.field.type,
      options: a.field.options,
    }));

  const registrationInitial = {
    id: app.id,
    name: app.name,
    email: app.email,
    phone: app.phone,
    birthDate: app.birthDate ? app.birthDate.toISOString().split("T")[0] : null,
    rg: app.rg,
    cpf: app.cpf,
    maritalStatus: app.maritalStatus,
    hasChildren: app.hasChildren,
    childrenCount: app.childrenCount,
    zipCode: app.zipCode,
    street: app.street,
    streetNumber: app.streetNumber,
    complement: app.complement,
    neighborhood: app.neighborhood,
    city: app.city,
    state: app.state,
    desiredRole: app.desiredRole,
    salaryExpectation: app.salaryExpectation,
    instagram: app.instagram ? `@${app.instagram}` : null,
    workPreference: app.workPreference,
    availability: app.availability,
    hasCnh: app.hasCnh,
    isPcd: Boolean(app.isPcd),
    pcdDetails: app.pcdDetails,
    bootSize: app.bootSize,
    pantsSize: app.pantsSize,
    shirtSize: app.shirtSize,
    hasBankAccount: app.hasBankAccount,
    bankNames: app.bankNames,
    bankAccountType: app.bankAccountType,
    professionalSummary: app.professionalSummary,
    aiProfile: app.aiProfile,
    aiArea: app.aiArea,
    aiLevel: app.aiLevel,
  };

  return (
    <CandidateDetailSplitView
      applicationId={app.id}
      candidateName={app.name}
      jobId={app.job.id}
      jobTitle={jobLabel(app.job.title, app.job.code)}
      hasResume={true}
      latestResumeUrl={app.latestResumeInfo?.latestResumeUrl}
      latestResumeSource={app.latestResumeInfo?.sourceTitle}
      queue={app.queue}
    >
      <LiveRefresh active={analyzing} applicationIds={[app.id]} />

      {!app.queue && (
        <div className="mb-4 flex items-center justify-between gap-4">
          <Link
            href="/candidaturas"
            className="text-xs font-medium text-[#71717a] hover:text-[#0a0a0a]"
          >
            ← Voltar para candidatos
          </Link>
        </div>
      )}

      <header className="relative overflow-hidden rounded-2xl border border-[#e4e4e7] bg-white p-5 shadow-sm sm:p-6">
        {/* Faixa da marca: dá identidade ao topo da ficha sem pesar a base neutra. */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: "linear-gradient(90deg, var(--brand-primary), var(--brand-deep))" }}
        />
        {/* Linha 1: Contexto da vaga + Status + Match Score + Fechar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Link
              href={`/vagas/${app.job.id}`}
              className="truncate text-[11px] font-semibold uppercase tracking-[0.6px] text-[#71717a] transition hover:text-[#0a0a0a]"
            >
              Candidatura · {jobLabel(app.job.title, app.job.code)}
            </Link>
            <span className="text-[#e4e4e7]" aria-hidden>·</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                app.status === "APPROVED"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : app.status === "REJECTED"
                    ? "border-zinc-200 bg-zinc-100 text-zinc-700"
                    : app.status === "INTERVIEW"
                      ? "border-sky-200 bg-sky-50 text-sky-800"
                      : app.status === "SHORTLISTED"
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : app.status === "STANDBY"
                          ? "border-teal-200 bg-teal-50 text-teal-800"
                          : "border-[#e4e4e7] bg-[#f4f4f5] text-[#3f3f46]"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  app.status === "APPROVED"
                    ? "bg-emerald-500"
                    : app.status === "REJECTED"
                      ? "bg-zinc-400"
                      : app.status === "INTERVIEW"
                        ? "bg-sky-500"
                        : app.status === "SHORTLISTED"
                          ? "bg-amber-500"
                          : app.status === "STANDBY"
                            ? "bg-teal-500"
                            : "bg-zinc-400"
                }`}
              />
              {appStatusLabels[app.status as AppStatusKey]}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {app.aiState === "DONE" && app.aiScore !== null && (
              <span
                className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold tabular-nums ${
                  meets
                    ? "bg-[#e4f6ec] text-[#1f7a4d]"
                    : "bg-[#fff4e0] text-[#9a5b00]"
                }`}
                title={
                  meets
                    ? `Nota ${app.aiScore}/100 — acima do mínimo da vaga (${app.job.aiMinScore})`
                    : `Nota ${app.aiScore}/100 — abaixo do mínimo da vaga (${app.job.aiMinScore})`
                }
              >
                <span className="size-1.5 rounded-full bg-current" />
                {app.aiScore}% match
              </span>
            )}
            <Link
              href="/candidaturas"
              aria-label="Fechar e voltar para candidatos"
              className="flex size-8 shrink-0 items-center justify-center rounded-xl text-[#71717a] transition hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
            >
              ✕
            </Link>
          </div>
        </div>

        {/* Linha 2: Identidade em largura 100% livre (nome nunca fica espremido) */}
        <div className="mt-4 flex items-start gap-4">
          <ZoomableCandidateAvatar
            applicationId={app.id}
            name={app.name}
            photoUrl={app.photoUrl}
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#1c1917] text-base font-bold text-white shadow-xs sm:size-15"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-[-0.02em] text-[#0a0a0a] sm:text-2xl">
                {app.name}
              </h1>
              {app.hasImpediment && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-zinc-50 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600"
                  title={
                    app.impedimentReason
                      ? `Motivo do impedimento: ${app.impedimentReason}`
                      : "Impedimento de contratação ativo em todas as vagas"
                  }
                >
                  <span className="size-1.5 rounded-full bg-rose-500/80" />
                  <span>Tarja preta</span>
                </span>
              )}
              {app.preRegistered && (
                <span className="rounded-full bg-[#fff7e6] px-2.5 py-0.5 text-[11px] font-medium text-[#a16207]">
                  Cadastro incompleto
                </span>
              )}
              {app.isDemo && (
                <span className="rounded-full bg-[#f5f3ff] px-2.5 py-0.5 text-[11px] font-medium text-[#6d28d9]">
                  Demonstração
                </span>
              )}
            </div>

            <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-[#52525b]">
              <span>
                {app.preRegistered ? "Cadastrado por você em" : "Candidatou-se em"}{" "}
                {formatAppliedAt(app.createdAt, true)}
              </span>
              {app.age !== null && (
                <span
                  className="text-[#52525b]"
                  title="Só para sua conferência: não entra na nota nem vai para a IA"
                >
                  · {app.age} anos
                </span>
              )}
              {(app.city || app.state) && (
                <span className="text-[#52525b]">
                  · {[app.city, app.state].filter(Boolean).join(" - ")}
                </span>
              )}
              {(app.aiProfile || app.aiLevel) && (
                <span className="font-semibold text-[#0a0a0a]">
                  · {[app.aiProfile, app.aiLevel].filter(Boolean).join(" · ")}
                </span>
              )}
              {app.consentAt && (
                <span
                  className="text-[#52525b]"
                  title={`Aceitou o Aviso de Privacidade (LGPD) em ${formatAppliedAt(app.consentAt, true)} · versão ${app.consentVersion ?? "-"}`}
                >
                  · LGPD aceita
                </span>
              )}
              {app.status === "PENDING" && (
                <span className="font-medium text-[#b07818]">
                  · esperando resposta {formatWaiting(app.createdAt)}
                </span>
              )}
              {app.status === "STANDBY" && (
                <span className="font-medium text-[#0e7a6b]">
                  · em stand-by
                  {extractStandbyReason(app.managerNotes)
                    ? ` (${extractStandbyReason(app.managerNotes)})`
                    : ""}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Linha 3: Barra de Ações Minimalista */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#f4f4f5] pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <WhatsAppQuickButton
              candidateName={app.name}
              candidatePhone={app.phone}
              jobTitle={app.job.title}
              companyName={app.company.name}
              enabled={whatsappTemplatesEnabled}
            />
            <ResumeLightboxButton
              applicationId={app.id}
              candidateName={app.name}
            />
            <a
              href={`/candidaturas/${app.id}/cv?download=1`}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-white px-3 text-xs font-semibold text-[#0a0a0a] shadow-2xs transition hover:bg-[#fafaf9]"
              title="Baixar currículo em PDF"
            >
              <Download className="size-3.5 text-[#52525b]" />
              <span>Baixar PDF</span>
            </a>
            <CandidateRegistrationEditor
              initial={registrationInitial}
              answers={editableAnswers}
              variant="header"
            />
          </div>

          {!app.hasImpediment && (
            <div className="flex items-center">
              <ImpedimentToggle
                applicationId={app.id}
                candidateName={app.name}
                hasImpediment={false}
              />
            </div>
          )}
        </div>
      </header>

      <SyncResumeBanner
        applicationId={app.id}
        candidateName={app.name}
        latestResumeInfo={app.latestResumeInfo}
      />

      {app.hasImpediment && (
        <section className="mt-4 rounded-2xl bg-black p-5 text-white shadow-lg border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-700 text-lg">
              ⚠️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-red-950 border border-red-800 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-400">
                  TARJA PRETA ATIVA
                </span>
                <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                  Impedimento de Contratação
                </h2>
              </div>
              <p className="mt-1 text-xs text-zinc-300">
                {app.impedimentReason
                  ? `Justificativa: ${app.impedimentReason}`
                  : "Candidato bloqueado para avanço em entrevistas, aprovação e reanálise da IA."}
                <span className="text-zinc-400">
                  {" · "}Válida em todas as vagas desta empresa.
                </span>
                {app.impedimentAt && (
                  <span className="text-zinc-500 text-[11px]">
                    {" · "}Registrado em {formatAppliedAt(app.impedimentAt, true)}
                  </span>
                )}
              </p>
            </div>
          </div>
          <ImpedimentToggle
            applicationId={app.id}
            candidateName={app.name}
            hasImpediment={true}
            impedimentReason={app.impedimentReason}
          />
        </section>
      )}

      {app.otherApplications.length > 0 && (
        <section className="mt-4 rounded-2xl border border-[#f0e3c8] bg-[#fdfaf3] p-4 text-[13px] text-[#57534e] sm:px-6">
          <p className="font-semibold text-[#0a0a0a]">
            {app.name.split(" ")[0]} também se candidatou a{" "}
            {app.otherApplications.length === 1 ? "outra vaga" : "outras vagas"}:
          </p>
          <ul className="mt-2 space-y-1">
            {app.otherApplications.map((other) => (
              <li key={other.id} className="flex flex-wrap items-center gap-1.5">
                <Link
                  href={`/candidaturas/${other.id}`}
                  className="font-medium text-[#0a0a0a] underline-offset-2 hover:underline"
                >
                  {jobLabel(other.job.title, other.job.code)}
                </Link>
                <span className="text-[#71717a]"> · {appStatusLabels[other.status as AppStatusKey]}</span>
                {(other.hasImpediment || app.hasImpediment) && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-600"
                    title={other.impedimentReason || app.impedimentReason || "Impedimento ativo em todas as vagas"}
                  >
                    <span className="size-1.5 rounded-full bg-rose-500/80" />
                    <span>Tarja preta</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <main className="min-w-0 space-y-5">
          {showEvaluation && (
            <InterviewEvaluationCard
              applicationId={app.id}
              suggestedCriteria={suggestedCriteria(app.job.aiCriteria)}
              evaluations={evaluations}
              currentUserId={currentUserId}
              interviewSummary={interview ? interview.summary : null}
            />
          )}
          <section className="rounded-2xl border border-[#e4e4e7] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <SectionEyebrow icon={Sparkles}>Leitura da IA</SectionEyebrow>
                <h2 className="mt-1.5 text-lg font-semibold text-[#0a0a0a]">
                  Apoio à decisão
                </h2>
              </div>
              <span className="rounded-full bg-[#f4f4f5] px-2.5 py-1 text-[10px] font-medium text-[#71717a]">
                A decisão é sua
              </span>
            </div>

            {app.aiState === "DONE" && app.aiScore !== null ? (
              <>
                {app.aiReasoning && (
                  <p className="mt-5 text-[15px] leading-6 text-[#0a0a0a]">
                    {app.aiReasoning}
                  </p>
                )}
                <div
                  className={`mt-5 rounded-xl border p-4 ${
                    meets ? "border-[#cdebd9] bg-[#f3fbf6]" : "border-[#f3dfbd] bg-[#fffaf1]"
                  }`}
                >
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <p className="flex items-baseline gap-1 tabular-nums">
                      <span
                        className={`text-[34px] font-bold leading-none tracking-[-1px] ${
                          meets ? "text-[#1f7a4d]" : "text-[#9a5b00]"
                        }`}
                      >
                        {app.aiScore}
                      </span>
                      <span className="text-sm font-medium text-[#71717a]">/ 100</span>
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        meets ? "bg-[#dcf3e5] text-[#1f7a4d]" : "bg-[#fdebc8] text-[#8a5200]"
                      }`}
                    >
                      {meets
                        ? `Acima do mínimo da vaga (${app.job.aiMinScore})`
                        : `Abaixo do mínimo da vaga (${app.job.aiMinScore})`}
                    </span>
                  </div>
                  <div className="relative mt-3 h-2 rounded-full bg-white/80 ring-1 ring-black/5">
                    <div
                      className={`h-full rounded-full ${meets ? "bg-[#2f9e62]" : "bg-[#e0a43a]"}`}
                      style={{ width: `${Math.max(0, Math.min(100, app.aiScore))}%` }}
                    />
                    {/* Marca da nota mínima da vaga */}
                    <span
                      aria-hidden
                      className="absolute -top-1 h-4 w-0.5 rounded-full bg-[#3f3f46]"
                      style={{ left: `${Math.max(0, Math.min(100, app.job.aiMinScore))}%` }}
                      title={`Mínimo da vaga: ${app.job.aiMinScore}`}
                    />
                  </div>
                </div>
                {scoredWithoutResumeText(app) && (
                  <p
                    role="note"
                    className="mt-4 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-3.5 py-2.5 text-[12px] leading-5 text-[#78350f]"
                  >
                    Atenção: a IA não conseguiu ler o texto do currículo anexado. Esta nota considera só as
                    respostas do formulário. Abra o currículo para avaliar, ou use &quot;Analisar de novo&quot;.
                  </p>
                )}
                {app.aiModel && (
                  <p className="mt-3 text-[11px] text-[#71717a]">
                    Analisado por {app.aiModel.replace(/^groq:/, "")}
                    {app.resumeUrl ? "" : ", só com as respostas do formulário"}
                  </p>
                )}
              </>
            ) : (
              <div className="mt-5 rounded-xl bg-[#fafaf9] p-4 text-sm text-[#71717a]">
                <div className="flex items-center gap-2">
                  {analyzing && (
                    <span className="size-2 animate-pulse rounded-full bg-[#8a8781]" />
                  )}
                  {app.aiState === "NO_RESUME"
                    ? "Não havia material para a IA ler (sem PDF legível e sem respostas). Avalie pelo que está abaixo."
                    : app.aiState === "FAILED"
                      ? "A análise falhou. Você pode pedir uma nova tentativa."
                      : "Analisando o currículo… o resultado aparece aqui em instantes."}
                </div>
              </div>
            )}

            {(app.aiState === "FAILED" || app.aiState === "NO_RESUME" || app.aiState === "DONE") && (
              <div className="mt-4">
                <ReanalyzeButton applicationId={app.id} hasImpediment={app.hasImpediment ?? false} />
              </div>
            )}

            {app.resumeUrl && !app.photoPath && (
              <div className="mt-4">
                <ReextractPhotoButton applicationId={app.id} />
              </div>
            )}

            {checklist.length > 0 ? (
              <div className="mt-6 border-t border-[#e4e4e7] pt-5">
                <h3 className="text-[13px] font-semibold text-[#0a0a0a]">
                  Critério por critério
                </h3>
                <p className="mt-0.5 text-[11px] text-[#71717a]">
                  Explica a nota; não muda o cálculo dela.
                </p>
                <ul className="mt-3 space-y-2.5">
                  {checklist.map((item) => (
                    <li key={item.criterion} className="flex gap-2.5 text-[12px] leading-5">
                      <span
                        aria-hidden
                        className={
                          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold " +
                          (item.met === "sim"
                            ? "bg-[#e4f6ec] text-[#1f7a4d]"
                            : item.met === "parcial"
                              ? "bg-[#fff7e6] text-[#a16207]"
                              : "bg-[#f4f4f5] text-[#71717a]")
                        }
                      >
                        {item.met === "sim" ? "✓" : item.met === "parcial" ? "~" : "–"}
                      </span>
                      <span className="min-w-0">
                        <span className="font-medium text-[#0a0a0a]">{item.criterion}</span>
                        <span className="sr-only">: {item.met === "sim" ? "atende" : item.met === "parcial" ? "atende em parte" : "não encontrado"}</span>
                        {item.evidence && (
                          <span className="block text-[#71717a]">{item.evidence}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : app.job.aiCriteria.length > 0 && (
              <div className="mt-6 border-t border-[#e4e4e7] pt-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[#71717a]">
                  Critérios avaliados
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {app.job.aiCriteria.map((criterion) => (
                    <span
                      key={criterion}
                      className="rounded-full bg-[#fafaf9] px-3 py-1.5 text-[11px] text-[#0a0a0a] ring-1 ring-[#e4e4e7]"
                    >
                      {criterion}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <TenureCard tenure={tenure} />
          </section>

          <CareerCard
            applicationId={app.id}
            career={readCareer(app.aiCareer)}
            matches={talent?.matches ?? []}
          />

          <section className="rounded-2xl border border-[#e4e4e7] bg-white p-5 shadow-sm sm:p-6">
            <SectionEyebrow icon={History}>Processo</SectionEyebrow>
            <h2 className="mt-1.5 text-base font-semibold text-[#0a0a0a]">
              Histórico do processo
            </h2>
            {app.statusEvents.length > 0 ? (
              <ol className="mt-4 space-y-3">
                {app.statusEvents.map((event, i) => (
                  <li key={event.id} className="flex gap-3 text-[12px]">
                    <span
                      className="mt-1.5 size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: i === 0 ? "var(--brand-primary)" : "#d4d4d8" }}
                    />
                    <div>
                      <span className="text-[#0a0a0a]">
                        {historyLine(event.from, event.to, event.actor)}
                      </span>
                      <span className="ml-2 text-[#71717a]">
                        {formatAppliedAt(event.createdAt, true)}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-xs text-[#71717a]">
                Ainda não há movimentações registradas.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-[#e4e4e7] bg-white p-5 shadow-sm sm:p-6">
            <SectionEyebrow icon={MessageSquare}>Comunicação</SectionEyebrow>
            <h2 className="mt-1.5 text-base font-semibold text-[#0a0a0a]">
              Recado para o candidato
            </h2>
            <p className="mt-1 text-[12px] text-[#71717a]">
              {app.name.split(" ")[0]} recebe por e-mail e nas novidades da área dele.
            </p>
            <MessageBox
              applicationId={app.id}
              candidateName={app.name}
              candidatePhone={app.phone ?? undefined}
              companyName={app.company.name}
              jobTitle={app.job.title}
              templates={messageTemplates}
              hasEmail={app.email.includes("@")}
              hasAccount={Boolean(app.candidateId)}
            />
          </section>

          <section className="rounded-2xl border border-[#e4e4e7] bg-white p-5 shadow-sm sm:p-6">
            <SectionEyebrow icon={ClipboardList}>Documentos</SectionEyebrow>
            <h2 className="mt-1.5 text-base font-semibold text-[#0a0a0a]">
              Pré-entrevista
            </h2>
            <p className="mt-1 text-[12px] text-[#71717a]">
              Peça as informações que faltam antes de marcar a conversa. RG e CPF
              só aparecem mascarados até você pedir para ver.
            </p>
            <InfoRequestBox
              applicationId={app.id}
              candidateName={app.name}
              candidatePhone={app.phone ?? undefined}
              companyName={app.company.name}
              jobTitle={app.job.title}
              hasEmail={app.email.includes("@")}
              hasAccount={Boolean(app.candidateId)}
              formUrl={`${appUrl()}/${app.company.slug}/minhas-candidaturas/${app.id}/pre-entrevista`}
              known={Object.fromEntries(
                INFO_FIELDS.map((f) => [
                  f,
                  !missingInfoFields(knownInfoOf(app)).includes(f),
                ])
              ) as Record<InfoField, boolean>}
              requestedFields={app.infoRequestedFields as InfoField[]}
              requestedAt={app.infoRequestedAt?.toISOString() ?? null}
              answeredAt={app.infoAnsweredAt?.toISOString() ?? null}
              answers={{
                maritalStatus: app.maritalStatus,
                hasChildren: app.hasChildren,
                childrenCount: app.childrenCount,
                professionalSummary: app.professionalSummary,
                address: formatAddress(app),
                uniform: uniformLine,
                birthDate: formatBirthDate(app.birthDate),
                bank: bankLine,
                rgMasked: app.rg ? maskRg(app.rg) : null,
                cpfMasked: app.cpf ? maskCpf(app.cpf) : null,
              }}
            />
          </section>

          <section className="rounded-2xl border border-[#e4e4e7] bg-white p-5 shadow-sm sm:p-6">
            <SectionEyebrow icon={Lock}>Só a equipe vê</SectionEyebrow>
            <h2 className="mt-1.5 text-base font-semibold text-[#0a0a0a]">Notas internas</h2>
            <p className="mt-1 text-[12px] text-[#71717a]">
              Visível só para sua equipe. O candidato nunca vê.
            </p>
            <div className="mt-4">
              <NotesForm applicationId={app.id} notes={app.managerNotes} />
            </div>
          </section>

          <section className="rounded-2xl border border-[#e4e4e7] bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <SectionEyebrow icon={UserRound}>Cadastro</SectionEyebrow>
                <h2 className="mt-1.5 text-base font-semibold text-[#0a0a0a]">Dados do candidato</h2>
              </div>
              <CandidateRegistrationEditor
                initial={registrationInitial}
                answers={editableAnswers}
                variant="inline"
              />
            </div>
            <dl className="mb-6 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
              {infoPairs.slice(0, 2 + (formatAddress(app) ? 1 : 0) + (uniformLine ? 1 : 0) + (bankLine ? 1 : 0)).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[11px] font-medium text-[#71717a]">{label}</dt>
                  <dd className="mt-1 break-words text-[13px] leading-5 text-[#0a0a0a]">{value}</dd>
                </div>
              ))}
              {app.instagram && (
                <div>
                  <dt className="text-[11px] font-medium text-[#71717a]">Instagram</dt>
                  <dd className="mt-1 text-[13px] leading-5">
                    <a
                      href={instagramUrl(app.instagram)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
                      style={{ color: "var(--brand-primary)" }}
                    >
                      @{app.instagram}
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  </dd>
                </div>
              )}
            </dl>
            <AnswersEditor
              applicationId={app.id}
              canReanalyze={app.aiState === "DONE" || app.aiState === "FAILED" || app.aiState === "NO_RESUME"}
              answers={[...coreAnswers, ...customAnswers]
                .filter((a) => a.field.type !== "FILE_UPLOAD")
                .map((a) => ({
                  id: a.id,
                  label: a.field.label,
                  value: a.value,
                  type: a.field.type,
                  options: a.field.options,
                }))}
            />
          </section>

          {app.aiState === "DONE" && (
            <section className="rounded-2xl border border-[#e4e4e7] bg-white p-5 shadow-sm sm:p-6">
              <AskAiBox applicationId={app.id} jobId={app.job.id} />
            </section>
          )}
        </main>

        <aside className="min-w-0 space-y-5 lg:sticky lg:top-5">
          <DecisionBlock
            applicationId={app.id}
            status={app.status}
            candidateName={app.name}
            candidatePhone={app.phone ?? undefined}
            jobTitle={app.job.title}
            hasEmail={app.email.includes("@")}
            hasAccount={Boolean(app.candidateId)}
            interview={interview}
            queue={app.queue}
            hasImpediment={app.hasImpediment ?? false}
          />

          {(app.preRegistered || !app.resumeUrl) && intake && (
            <ManagerIntakeCard
              applicationId={app.id}
              preRegistered={app.preRegistered}
              hasResume={!!app.resumeUrl}
              invite={intake.invite}
              whatsapp={intake.whatsapp}
            />
          )}

          {talent && (
            <TalentPoolCard
              applicationId={app.id}
              folders={talent.folders}
              inFolders={talent.inFolders}
              suggestedName={talent.suggestedName}
              level={talent.level}
              matches={talent.matches}
              highlight={suggestTalentPool({
                aiState: app.aiState,
                aiScore: app.aiScore,
                minScore: app.job.aiMinScore,
              })}
            />
          )}

          <section className="rounded-2xl border border-[#e4e4e7] bg-white p-5 shadow-sm">
            <SectionEyebrow icon={FileText}>Currículo</SectionEyebrow>
            <div className="mt-4 flex items-center gap-3">
              <span className="rounded-lg bg-[#e4f6ec] px-2.5 py-2 text-[9px] font-bold text-[#1f7a4d]">
                PDF
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-[#0a0a0a]">
                  Currículo de {app.name.split(" ")[0]}
                </span>
                <span className="mt-0.5 block text-[11px] text-[#71717a]">
                  {app.resumeUrl
                    ? "Documento enviado na candidatura"
                    : app.latestResumeInfo?.latestResumeUrl
                    ? `Currículo sincronizado (${app.latestResumeInfo.sourceTitle})`
                    : "Dossiê em PDF gerado com os dados da candidatura"}
                </span>
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <ResumeLightboxButton
                applicationId={app.id}
                candidateName={app.name}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#e4e4e7] bg-white px-3 text-xs font-semibold text-[#0a0a0a] transition hover:bg-[#fafaf9]"
              />
              <a
                href={`/candidaturas/${app.id}/cv?download=1`}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition hover:opacity-90"
                style={{
                  backgroundColor: "var(--brand-primary)",
                  color: "var(--brand-foreground)",
                }}
              >
                <Download className="size-3.5" />
                <span>Baixar PDF</span>
              </a>
            </div>
          </section>

          <div className="flex justify-center pt-1">
            <DeleteApplicationButton
              applicationId={app.id}
              candidateName={app.name}
            />
          </div>
        </aside>
      </div>
    </CandidateDetailSplitView>
  );
}
