import type { Metadata } from "next";
import { ClipboardList, Download, ExternalLink, FileText, History, Lock, MessageSquare, Sparkles, UserRound } from "lucide-react";
import { SectionEyebrow } from "@/components/gestor/section-eyebrow";
import { formatPhone } from "@/lib/phone";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DecisionBlock } from "@/components/gestor/decision-block";
import { ShowcaseToggle } from "@/components/gestor/showcase-toggle";
import { ImpedimentToggle } from "@/components/gestor/impediment-toggle";
import { CandidateDetailSplitView } from "@/components/gestor/candidate-detail-split-view";
import { CandidateRegistrationEditor } from "@/components/gestor/candidate-registration-editor";
import { CandidateCorporateDossier } from "@/components/gestor/candidate-corporate-dossier";
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
import { ScoreRulerTrigger, ScoreRulerCard } from "@/components/gestor/score-ruler-legend";
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
import { isWhatsappTemplatesEnabled } from "@/server/services/company-feature.service";
import { instagramUrl } from "@/server/models/instagram.model";
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

      <SyncResumeBanner
        applicationId={app.id}
        candidateName={app.name}
        latestResumeInfo={app.latestResumeInfo}
      />

      <CandidateCorporateDossier
        applicationId={app.id}
        name={app.name}
        email={app.email}
        phone={app.phone}
        photoUrl={app.photoUrl}
        city={app.city}
        state={app.state}
        createdAt={app.createdAt}
        updatedAt={app.updatedAt}
        status={app.status}
        hasImpediment={Boolean(app.hasImpediment)}
        impedimentReason={app.impedimentReason}
        impedimentAt={app.impedimentAt}
        preRegistered={app.preRegistered}
        isDemo={app.isDemo}
        age={app.age}
        birthDateFormatted={formatBirthDate(app.birthDate)}
        addressFormatted={formatAddress(app)}
        uniformLine={uniformLine}
        bankLine={bankLine}
        rgMasked={app.rg ? maskRg(app.rg) : null}
        cpfMasked={app.cpf ? maskCpf(app.cpf) : null}
        jobId={app.job.id}
        jobTitle={app.job.title}
        jobCode={app.job.code}
        jobLocation={(app.job as { location?: string | null }).location}
        companyName={app.company.name}
        whatsappTemplatesEnabled={whatsappTemplatesEnabled}
        otherApplications={app.otherApplications as any}
        queue={app.queue}
        latestResumeInfo={app.latestResumeInfo}
        hasResume={Boolean(app.resumeUrl || app.latestResumeInfo?.latestResumeUrl)}
        aiState={app.aiState}
        aiScore={app.aiScore}
        aiMinScore={app.job.aiMinScore}
        decisionBlockSlot={
          <>
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
          {app.status === "APPROVED" && app.candidateId && (
            <ShowcaseToggle
              applicationId={app.id}
              consent={app.showcaseConsent}
              hidden={app.showcaseHidden}
            />
          )}
          </>
        }
        registrationEditorHeaderSlot={
          <CandidateRegistrationEditor
            initial={registrationInitial}
            answers={editableAnswers}
            variant="header"
          />
        }
        registrationEditorInlineSlot={
          <CandidateRegistrationEditor
            initial={registrationInitial}
            answers={editableAnswers}
            variant="inline"
          />
        }
        managerIntakeSlot={
          (app.preRegistered || !app.resumeUrl) && intake ? (
            <ManagerIntakeCard
              applicationId={app.id}
              preRegistered={app.preRegistered}
              hasResume={!!app.resumeUrl}
              invite={intake.invite}
              whatsapp={intake.whatsapp}
            />
          ) : null
        }
        deleteApplicationSlot={
          <DeleteApplicationButton
            applicationId={app.id}
            candidateName={app.name}
          />
        }
        dadosInternosContentSlot={
          <div className="space-y-6">
            {/* Bloco 1: Documentos & Identificação */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5 mb-3">
                1. Documentação & Identificação
              </h4>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 md:grid-cols-3 text-xs">
                <div>
                  <dt className="font-semibold text-slate-500">CPF</dt>
                  <dd className="mt-0.5 font-mono text-slate-900 font-medium">
                    {app.cpf ? maskCpf(app.cpf) : "Não informado"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">RG</dt>
                  <dd className="mt-0.5 font-mono text-slate-900 font-medium">
                    {app.rg ? maskRg(app.rg) : "Não informado"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">CNH</dt>
                  <dd className="mt-0.5 text-slate-900 font-medium">
                    {app.hasCnh ? `Possui (${app.hasCnh})` : "Não informado"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">PCD</dt>
                  <dd className="mt-0.5 text-slate-900 font-medium">
                    {app.isPcd ? `Sim (${app.pcdDetails || "Detalhes não especificados"})` : "Não"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Data de Nascimento</dt>
                  <dd className="mt-0.5 text-slate-900 font-medium">
                    {formatBirthDate(app.birthDate) || "Não informada"}{" "}
                    {app.age !== null ? `(${app.age} anos)` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Estado Civil / Filhos</dt>
                  <dd className="mt-0.5 text-slate-900 font-medium">
                    {[
                      app.maritalStatus,
                      app.hasChildren ? `${app.childrenCount ?? 1} filho(s)` : app.hasChildren === false ? "Sem filhos" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Não informado"}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Bloco 2: Endereço & Residência */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5 mb-3">
                2. Endereço & Residência
              </h4>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 md:grid-cols-3 text-xs">
                <div className="sm:col-span-2">
                  <dt className="font-semibold text-slate-500">Logradouro / Bairro</dt>
                  <dd className="mt-0.5 text-slate-900 font-medium">
                    {formatAddress(app) || "Endereço não cadastrado"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">CEP</dt>
                  <dd className="mt-0.5 font-mono text-slate-900 font-medium">
                    {app.zipCode || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Cidade / UF</dt>
                  <dd className="mt-0.5 text-slate-900 font-medium">
                    {[app.city, app.state].filter(Boolean).join(" / ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Preferência de Trabalho</dt>
                  <dd className="mt-0.5 text-slate-900 font-medium">
                    {app.workPreference || "Presencial / Não informado"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Disponibilidade</dt>
                  <dd className="mt-0.5 text-slate-900 font-medium">
                    {app.availability || "Imediata"}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Bloco 3: Operacional & Logística (Uniforme / Banco) */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5 mb-3">
                3. Operacional, Uniforme & Dados Bancários
              </h4>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 md:grid-cols-3 text-xs">
                <div>
                  <dt className="font-semibold text-slate-500">Medidas de Uniforme</dt>
                  <dd className="mt-0.5 text-slate-900 font-medium">
                    {uniformLine || "Não informado"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Conta Bancária</dt>
                  <dd className="mt-0.5 text-slate-900 font-medium">
                    {bankLine || "Não informado"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Pretensão Salarial</dt>
                  <dd className="mt-0.5 text-slate-900 font-medium">
                    {app.salaryExpectation || "A combinar"}
                  </dd>
                </div>
                {app.instagram && (
                  <div>
                    <dt className="font-semibold text-slate-500">Instagram</dt>
                    <dd className="mt-0.5">
                      <a
                        href={instagramUrl(app.instagram)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:underline"
                      >
                        @{app.instagram}
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    </dd>
                  </div>
                )}
                {app.professionalSummary && (
                  <div className="sm:col-span-2 md:col-span-3">
                    <dt className="font-semibold text-slate-500">Resumo Profissional</dt>
                    <dd className="mt-1 leading-relaxed text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      {app.professionalSummary}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Bloco 4: Respostas do Formulário da Vaga */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5 mb-3">
                4. Perguntas Específicas do Processo Seletivo
              </h4>
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
            </div>
          </div>
        }
        iaEvaluationContentSlot={
          <div className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <SectionEyebrow icon={Sparkles}>Leitura da IA</SectionEyebrow>
                  <h2 className="mt-1 text-base font-bold text-slate-900">
                    Apoio à Decisão & Compatibilidade
                  </h2>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  A decisão final é sua
                </span>
              </div>

              {app.aiState === "DONE" && app.aiScore !== null ? (
                <>
                  {app.aiReasoning && (
                    <p className="mt-4 text-xs leading-relaxed text-slate-800 bg-slate-50/70 p-3.5 rounded-lg border border-slate-200">
                      {app.aiReasoning}
                    </p>
                  )}
                  <div
                    className={`mt-4 rounded-xl border p-4 ${
                      meets ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"
                    }`}
                  >
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <p className="flex items-baseline gap-1 tabular-nums">
                        <span
                          className={`text-3xl font-extrabold leading-none tracking-tight ${
                            meets ? "text-emerald-700" : "text-amber-800"
                          }`}
                        >
                          {app.aiScore}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">/ 100</span>
                      </p>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            meets ? "bg-emerald-200/80 text-emerald-900" : "bg-amber-200/80 text-amber-900"
                          }`}
                        >
                          {meets
                            ? `Acima do mínimo da vaga (${app.job.aiMinScore})`
                            : `Abaixo do mínimo da vaga (${app.job.aiMinScore})`}
                        </span>
                        <ScoreRulerTrigger highlightScore={app.aiScore} variant="pill" label="Régua da Nota" />
                      </div>
                    </div>
                    <div className="relative mt-2.5 h-2 rounded-full bg-slate-200 ring-1 ring-black/5">
                      <div
                        className={`h-full rounded-full ${meets ? "bg-emerald-600" : "bg-amber-500"}`}
                        style={{ width: `${Math.max(0, Math.min(100, app.aiScore))}%` }}
                      />
                      <span
                        aria-hidden
                        className="absolute -top-1 h-4 w-0.5 rounded-full bg-slate-800"
                        style={{ left: `${Math.max(0, Math.min(100, app.job.aiMinScore))}%` }}
                        title={`Mínimo da vaga: ${app.job.aiMinScore}`}
                      />
                    </div>
                  </div>

                  {scoredWithoutResumeText(app) && (
                    <p
                      role="note"
                      className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900"
                    >
                      Atenção: a IA não conseguiu ler o texto do currículo anexado. Esta nota considera só as
                      respostas do formulário. Abra o currículo para avaliar, ou use &quot;Analisar de novo&quot;.
                    </p>
                  )}

                  {app.aiModel && (
                    <p className="mt-2.5 text-[11px] text-slate-500">
                      Analisado por {app.aiModel.replace(/^groq:/, "")}
                      {app.resumeUrl ? "" : ", só com as respostas do formulário"}
                    </p>
                  )}
                </>
              ) : (
                <div className="mt-4 rounded-xl bg-slate-50 p-4 text-xs text-slate-600 border border-slate-200">
                  <div className="flex items-center gap-2">
                    {analyzing && (
                      <span className="size-2 animate-pulse rounded-full bg-slate-600" />
                    )}
                    {app.aiState === "NO_RESUME"
                      ? "Não havia material para a IA ler (sem PDF legível e sem respostas). Avalie pela ficha cadastral."
                      : app.aiState === "FAILED"
                        ? "A análise falhou. Você pode pedir uma nova tentativa."
                        : "Analisando o currículo… o resultado aparece aqui em instantes."}
                  </div>
                </div>
              )}

              {(app.aiState === "FAILED" || app.aiState === "NO_RESUME" || app.aiState === "DONE") && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <ReanalyzeButton applicationId={app.id} hasImpediment={app.hasImpediment ?? false} />
                  {app.resumeUrl && !app.photoPath && (
                    <ReextractPhotoButton applicationId={app.id} />
                  )}
                </div>
              )}

              {checklist.length > 0 ? (
                <div className="mt-5 border-t border-slate-200 pt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Critério por critério da vaga
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {checklist.map((item) => (
                      <li key={item.criterion} className="flex gap-2.5 text-xs leading-relaxed">
                        <span
                          aria-hidden
                          className={
                            "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold " +
                            (item.met === "sim"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.met === "parcial"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-200 text-slate-700")
                          }
                        >
                          {item.met === "sim" ? "✓" : item.met === "parcial" ? "~" : "–"}
                        </span>
                        <span className="min-w-0">
                          <span className="font-bold text-slate-900">{item.criterion}</span>
                          {item.evidence && (
                            <span className="block text-slate-600">{item.evidence}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : app.job.aiCriteria.length > 0 && (
                <div className="mt-5 border-t border-slate-200 pt-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Critérios avaliados
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {app.job.aiCriteria.map((criterion) => (
                      <span
                        key={criterion}
                        className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-800 border border-slate-200"
                      >
                        {criterion}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 border-t border-slate-200 pt-4">
                <TenureCard tenure={tenure} />
              </div>
            </section>

            <CareerCard
              applicationId={app.id}
              career={readCareer(app.aiCareer)}
              matches={talent?.matches ?? []}
            />

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

            {app.aiState === "DONE" && (
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <AskAiBox applicationId={app.id} jobId={app.job.id} />
              </section>
            )}
          </div>
        }
        entrevistasContentSlot={
          <div className="space-y-4">
            {showEvaluation && (
              <InterviewEvaluationCard
                applicationId={app.id}
                suggestedCriteria={suggestedCriteria(app.job.aiCriteria)}
                evaluations={evaluations}
                currentUserId={currentUserId}
                interviewSummary={interview ? interview.summary : null}
              />
            )}

            {interview && (
              <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 shadow-xs text-xs">
                <div className="flex items-center gap-2 font-bold text-sky-900 uppercase tracking-wide">
                  <span>📅 Entrevista Agendada</span>
                </div>
                <p className="mt-1.5 text-sky-800">
                  <strong>Horário:</strong> {interview.summary}
                </p>
                {interview.location && (
                  <p className="mt-0.5 text-sky-800">
                    <strong>Local / Link:</strong> {interview.location}
                  </p>
                )}
              </div>
            )}

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <SectionEyebrow icon={Lock}>Notas Internas da Equipe</SectionEyebrow>
              <h3 className="mt-1 text-sm font-bold text-slate-900">
                Parecer e Anotações Sigilosas
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Visível apenas para gestores e recrutadores da empresa. O candidato nunca vê.
              </p>
              <div className="mt-3">
                <NotesForm applicationId={app.id} notes={app.managerNotes} />
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <SectionEyebrow icon={History}>Processo Seletivo</SectionEyebrow>
              <h3 className="mt-1 text-sm font-bold text-slate-900">
                Histórico de Movimentações
              </h3>
              {app.statusEvents.length > 0 ? (
                <ol className="mt-3 space-y-2.5 text-xs">
                  {app.statusEvents.map((event, i) => (
                    <li key={event.id} className="flex gap-2.5">
                      <span
                        className="mt-1.5 size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: i === 0 ? "var(--brand-primary, #0f172a)" : "#94a3b8" }}
                      />
                      <div>
                        <span className="font-semibold text-slate-900">
                          {historyLine(event.from, event.to, event.actor)}
                        </span>
                        <span className="ml-2 text-slate-500">
                          {formatAppliedAt(event.createdAt, true)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  Ainda não há movimentações registradas.
                </p>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <SectionEyebrow icon={MessageSquare}>Comunicação com o Candidato</SectionEyebrow>
              <h3 className="mt-1 text-sm font-bold text-slate-900">
                Enviar Recado ou Notificação
              </h3>
              <div className="mt-3">
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
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <SectionEyebrow icon={ClipboardList}>Pré-Entrevista & Documentos</SectionEyebrow>
              <h3 className="mt-1 text-sm font-bold text-slate-900">
                Solicitação de Informações Pendentes
              </h3>
              <div className="mt-3">
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
              </div>
            </section>
          </div>
        }
        ocorrenciasContentSlot={
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Auditoria de Alterações e Restrições
            </h4>
            <p className="text-xs text-slate-600">
              Todas as restrições e registros de impedimento aplicados a este candidato bloqueiam o avanço em qualquer vaga desta empresa, conforme as diretrizes corporativas de compliance.
            </p>
          </div>
        }
      />
    </CandidateDetailSplitView>
  );
}
