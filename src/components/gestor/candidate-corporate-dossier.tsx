"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  FileText,
  User,
  History,
  Sparkles,
  MessageSquare,
  AlertTriangle,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Clock,
  ShieldCheck,
  Download,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Star,
  CheckCircle2,
  XCircle,
  Clock3,
  Shirt,
  Building2,
  CreditCard,
  Briefcase,
  Layers,
} from "lucide-react";
import { ZoomableCandidateAvatar } from "@/components/gestor/zoomable-candidate-avatar";
import { WhatsAppQuickButton } from "@/components/gestor/whatsapp-quick-templates";
import { ResumeLightboxButton } from "@/components/gestor/resume-lightbox-button";
import { ImpedimentToggle } from "@/components/gestor/impediment-toggle";
import { CompanyDossierModal } from "@/components/gestor/company-dossier-modal";
import { getCompanyReportAction, type CompanyCandidateDossierItem } from "@/server/controllers/application.controller";
import { appStatusLabels, type AppStatusKey } from "@/server/models/application.model";
import { formatPhone } from "@/lib/phone";
import { jobLabel } from "@/server/models/candidate-list.model";
import { extractStandbyReason } from "@/server/models/standby.model";

export type ApplicationHistoryItem = {
  id: string;
  status: string;
  hasImpediment: boolean;
  impedimentReason?: string | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
  managerNotes?: string | null;
  job: {
    id?: string;
    title: string;
    code?: string | null;
    location?: string | null;
  };
};

export type CorporateDossierProps = {
  applicationId: string;
  name: string;
  email: string;
  phone?: string | null;
  photoUrl?: string | null;
  city?: string | null;
  state?: string | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
  status: string;
  hasImpediment: boolean;
  impedimentReason?: string | null;
  impedimentAt?: Date | string | null;
  preRegistered?: boolean;
  isDemo?: boolean;
  age?: number | null;
  birthDateFormatted?: string | null;
  addressFormatted?: string | null;
  uniformLine?: string | null;
  bankLine?: string | null;
  rgMasked?: string | null;
  cpfMasked?: string | null;
  jobId: string;
  jobTitle: string;
  jobCode?: string | null;
  jobLocation?: string | null;
  companyName: string;
  whatsappTemplatesEnabled: boolean;
  otherApplications: ApplicationHistoryItem[];
  queue?: {
    currentPosition: number;
    total: number;
    prevId: string | null;
    nextId: string | null;
    nextPendingId: string | null;
  } | null;
  latestResumeInfo?: {
    hasNewerResume: boolean;
    latestResumeUrl?: string | null;
    sourceTitle?: string | null;
  } | null;
  hasResume: boolean;
  aiState?: string;
  aiScore?: number | null;
  aiMinScore?: number;
  // Slots de conteúdo
  decisionBlockSlot: ReactNode;
  registrationEditorHeaderSlot: ReactNode;
  registrationEditorInlineSlot: ReactNode;
  curriculoContentSlot?: ReactNode;
  iaEvaluationContentSlot: ReactNode;
  dadosInternosContentSlot: ReactNode;
  entrevistasContentSlot: ReactNode;
  ocorrenciasContentSlot?: ReactNode;
  managerIntakeSlot?: ReactNode;
  deleteApplicationSlot?: ReactNode;
};

type TabKey = "inscricoes" | "curriculo" | "dados" | "ia" | "entrevistas" | "ocorrencias";

function formatDateShort(dateInput: Date | string): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(d);
}

export function CandidateCorporateDossier({
  applicationId,
  name,
  email,
  phone,
  photoUrl,
  city,
  state,
  createdAt,
  updatedAt,
  status,
  hasImpediment,
  impedimentReason,
  impedimentAt,
  preRegistered,
  isDemo,
  age,
  addressFormatted,
  uniformLine,
  bankLine,
  cpfMasked,
  jobId,
  jobTitle,
  jobCode,
  jobLocation,
  companyName,
  whatsappTemplatesEnabled,
  otherApplications,
  queue,
  latestResumeInfo,
  hasResume,
  aiState,
  aiScore,
  aiMinScore = 70,
  decisionBlockSlot,
  registrationEditorHeaderSlot,
  registrationEditorInlineSlot,
  curriculoContentSlot,
  iaEvaluationContentSlot,
  dadosInternosContentSlot,
  entrevistasContentSlot,
  ocorrenciasContentSlot,
  managerIntakeSlot,
  deleteApplicationSlot,
}: CorporateDossierProps) {
  // Define a aba inicial: se tiver outras inscrições, abre inscrições como na referência; senão abre parecer da IA ou dados
  const [activeTab, setActiveTab] = useState<TabKey>("inscricoes");
  const [activeResumeVersion, setActiveResumeVersion] = useState<"current" | "latest">("current");
  const [companyDossierOpen, setCompanyDossierOpen] = useState(false);
  const [companyDossierData, setCompanyDossierData] = useState<CompanyCandidateDossierItem[] | null>(null);
  const [companyDossierLoading, setCompanyDossierLoading] = useState(false);

  async function handleOpenCompanyDossier() {
    setCompanyDossierLoading(true);
    const res = await getCompanyReportAction([applicationId]);
    setCompanyDossierLoading(false);
    if (res.ok && res.candidates) {
      setCompanyDossierData(res.candidates);
      setCompanyDossierOpen(true);
    }
  }

  const effectiveResumeUrl =
    activeResumeVersion === "latest" && latestResumeInfo?.latestResumeUrl
      ? `/candidaturas/${applicationId}/cv?url=${encodeURIComponent(latestResumeInfo.latestResumeUrl)}`
      : `/candidaturas/${applicationId}/cv`;

  const downloadResumeUrl =
    activeResumeVersion === "latest" && latestResumeInfo?.latestResumeUrl
      ? `/candidaturas/${applicationId}/cv?url=${encodeURIComponent(latestResumeInfo.latestResumeUrl)}&download=1`
      : `/candidaturas/${applicationId}/cv?download=1`;

  // Compila todas as inscrições: a atual em primeiro + o histórico anterior
  const allApplications: ApplicationHistoryItem[] = [
    {
      id: applicationId,
      status,
      hasImpediment,
      impedimentReason,
      createdAt,
      updatedAt,
      job: {
        id: jobId,
        title: jobTitle,
        code: jobCode,
        location: jobLocation,
      },
    },
    ...otherApplications,
  ];

  const totalApplications = allApplications.length;

  return (
    <div className="w-full space-y-3 font-sans text-slate-800">
      {/* 1. BARRA DE TOPO CORPORATIVA (Inspirada no Grupo GPS / FastRH) */}
      <header className="rounded-xl border border-slate-300/80 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 px-4 py-2.5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Lado Esquerdo: Identificação Corporativa */}
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-amber-400/20 text-amber-600">
              <Star className="size-4 fill-amber-400 text-amber-500" />
            </div>
            <div className="min-w-0 flex items-baseline gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Candidato:
              </span>
              <h1 className="truncate text-sm sm:text-base font-extrabold uppercase tracking-tight text-slate-900">
                {name}
              </h1>
              <span className="text-slate-400" aria-hidden>·</span>
              <Link
                href={`/vagas/${jobId}`}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition hover:underline"
                title={`Vaga: ${jobLabel(jobTitle, jobCode)}`}
              >
                {jobLabel(jobTitle, jobCode)}
              </Link>
            </div>
          </div>

          {/* Lado Direito: Navegação Anterior / Próximo + Fila */}
          <div className="flex shrink-0 items-center gap-2">
            {queue && (
              <span className="hidden sm:inline-flex rounded-md bg-slate-300/60 px-2 py-0.5 text-[11px] font-semibold text-slate-700 tabular-nums">
                {queue.currentPosition} de {queue.total}
              </span>
            )}

            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-2xs">
              {queue?.prevId ? (
                <Link
                  href={`/candidaturas/${queue.prevId}`}
                  className="inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition"
                  title="Candidato anterior (Atalho: K ou ←)"
                >
                  <ChevronLeft className="size-3.5" />
                  <span>Anterior</span>
                </Link>
              ) : (
                <span className="inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-semibold text-slate-300 cursor-not-allowed">
                  <ChevronLeft className="size-3.5" />
                  <span>Anterior</span>
                </span>
              )}

              {queue?.nextId ? (
                <Link
                  href={`/candidaturas/${queue.nextId}`}
                  className="inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition"
                  title="Próximo candidato (Atalho: J ou →)"
                >
                  <span>Próximo</span>
                  <ChevronRight className="size-3.5" />
                </Link>
              ) : (
                <span className="inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-semibold text-slate-300 cursor-not-allowed">
                  <span>Próximo</span>
                  <ChevronRight className="size-3.5" />
                </span>
              )}
            </div>

            <Link
              href="/candidaturas"
              className="flex size-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/80 hover:text-slate-800 transition"
              title="Voltar para a lista de candidatos"
            >
              ✕
            </Link>
          </div>
        </div>
      </header>

      {/* 2. GRID PRINCIPAL: SIDEBAR DE IDENTIDADE + DOSSIÊ CORPORATIVO EM ABAS */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[290px_minmax(0,1fr)] xl:grid-cols-[310px_minmax(0,1fr)]">
        
        {/* COLUNA ESQUERDA: CARD DE IDENTIDADE DO CANDIDATO */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            {/* Foto e Nome em destaque */}
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-3">
                <ZoomableCandidateAvatar
                  applicationId={applicationId}
                  name={name}
                  photoUrl={photoUrl}
                  className="size-28 rounded-xl border border-slate-200 object-cover shadow-sm bg-slate-100 text-slate-700 text-2xl font-bold flex items-center justify-center overflow-hidden"
                />
                {hasImpediment && (
                  <span
                    className="absolute -bottom-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full bg-red-600 text-white shadow-xs text-xs font-bold"
                    title="Possui Tarja Preta / Impedimento ativo"
                  >
                    !
                  </span>
                )}
              </div>

              <h2 className="text-base font-extrabold uppercase tracking-tight text-slate-900 leading-snug">
                {name}
              </h2>

              {/* Status Badge */}
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                    status === "APPROVED"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : status === "REJECTED"
                        ? "bg-slate-100 text-slate-700 border border-slate-300"
                        : status === "INTERVIEW"
                          ? "bg-sky-100 text-sky-800 border border-sky-300"
                          : status === "SHORTLISTED"
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : status === "STANDBY"
                              ? "bg-teal-100 text-teal-800 border border-teal-300"
                              : "bg-slate-100 text-slate-700 border border-slate-300"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      status === "APPROVED"
                        ? "bg-emerald-500"
                        : status === "REJECTED"
                          ? "bg-slate-400"
                          : status === "INTERVIEW"
                            ? "bg-sky-500"
                            : status === "SHORTLISTED"
                              ? "bg-amber-500"
                              : status === "STANDBY"
                                ? "bg-teal-500"
                                : "bg-slate-400"
                    }`}
                  />
                  {appStatusLabels[status as AppStatusKey]}
                </span>

                {typeof aiScore === "number" && (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                      aiScore >= aiMinScore
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                    title={`Score IA: ${aiScore}% (Mínimo: ${aiMinScore}%)`}
                  >
                    {aiScore}% match
                  </span>
                )}
              </div>
            </div>

            {/* Alerta de Impedimento se houver */}
            {hasImpediment && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-900">
                <div className="flex items-center gap-1.5 font-bold text-red-700 uppercase tracking-wide">
                  <AlertTriangle className="size-3.5 text-red-600" />
                  <span>Tarja Preta Ativa</span>
                </div>
                {impedimentReason && (
                  <p className="mt-1 text-[11px] leading-relaxed text-red-800">
                    {impedimentReason}
                  </p>
                )}
              </div>
            )}

            {/* Lista de Contatos e Metadados (Fiel ao design corporativo) */}
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-700">
              {email && (
                <div className="flex items-center gap-2">
                  <Mail className="size-3.5 text-slate-400 shrink-0" />
                  <a
                    href={`mailto:${email}`}
                    className="truncate hover:text-slate-900 transition hover:underline"
                    title={email}
                  >
                    {email}
                  </a>
                </div>
              )}

              {phone && (
                <div className="flex items-center gap-2">
                  <Phone className="size-3.5 text-slate-400 shrink-0" />
                  <a
                    href={`tel:${phone}`}
                    className="hover:text-slate-900 font-medium transition hover:underline"
                  >
                    {formatPhone(phone)}
                  </a>
                </div>
              )}

              {(city || state) && (
                <div className="flex items-center gap-2">
                  <MapPin className="size-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">
                    {[city, state].filter(Boolean).join(" / ")}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Calendar className="size-3.5 text-slate-400 shrink-0" />
                <span>
                  Cadastro: <strong>{formatDateShort(createdAt)}</strong>
                </span>
              </div>

              {updatedAt && (
                <div className="flex items-center gap-2">
                  <Clock className="size-3.5 text-slate-400 shrink-0" />
                  <span>
                    Atualizado: <strong>{formatDateShort(updatedAt)}</strong>
                  </span>
                </div>
              )}

              {/* Status Documental */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                <ShieldCheck className="size-3.5 text-slate-400 shrink-0" />
                <span className="text-[11px]">
                  E-Social / Docs:{" "}
                  <strong>{cpfMasked ? "Em análise" : "Não Avaliado"}</strong>
                </span>
              </div>

              {uniformLine && (
                <div className="flex items-center gap-2">
                  <Shirt className="size-3.5 text-slate-400 shrink-0" />
                  <span className="truncate text-[11px]" title={uniformLine}>
                    Farda: {uniformLine}
                  </span>
                </div>
              )}
            </div>

            {/* Ações Rápidas na Sidebar */}
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
              <div className="flex items-center gap-2">
                <WhatsAppQuickButton
                  candidateName={name}
                  candidatePhone={phone}
                  jobTitle={jobTitle}
                  companyName={companyName}
                  enabled={whatsappTemplatesEnabled}
                />
                <a
                  href={downloadResumeUrl}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                  title="Baixar currículo em PDF"
                >
                  <Download className="size-3.5 text-slate-500" />
                  <span>Baixar PDF</span>
                </a>
              </div>

              <div className="flex items-center justify-between gap-2">
                {registrationEditorHeaderSlot}
                <ImpedimentToggle
                  applicationId={applicationId}
                  candidateName={name}
                  hasImpediment={hasImpediment}
                  impedimentReason={impedimentReason ?? undefined}
                />
              </div>

              <button
                type="button"
                disabled={companyDossierLoading}
                onClick={handleOpenCompanyDossier}
                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white shadow-2xs hover:bg-emerald-600 transition disabled:opacity-50"
                title="Gerar resumo executivo deste candidato com Nome, E-mail, Telefone, Fardamento e Resumo para enviar à empresa parceira"
              >
                <Building2 className="size-3.5" />
                <span>{companyDossierLoading ? "Carregando…" : "Resumo p/ Empresa"}</span>
              </button>
            </div>
          </div>

          {/* Bloco de Decisão (Avançar etapa / Reprovar / Standby) */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            {decisionBlockSlot}
          </div>

          {managerIntakeSlot}

          {deleteApplicationSlot && (
            <div className="flex justify-center pt-1">
              {deleteApplicationSlot}
            </div>
          )}
        </aside>

        {/* COLUNA DIREITA: DOSSIÊ CORPORATIVO COM ABAS */}
        <main className="min-w-0 space-y-3">
          {/* HEADER DE ABAS ESTILO CORPORATIVO */}
          <div className="rounded-xl border border-slate-300 bg-slate-700 p-1.5 shadow-xs">
            <nav className="flex flex-wrap items-center gap-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("inscricoes")}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 transition ${
                  activeTab === "inscricoes"
                    ? "bg-white text-slate-900 shadow-sm font-bold"
                    : "text-slate-200 hover:bg-slate-600/70 hover:text-white"
                }`}
              >
                <Layers className="size-3.5" />
                <span>Inscrições</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    activeTab === "inscricoes"
                      ? "bg-slate-200 text-slate-800"
                      : "bg-slate-600 text-slate-100"
                  }`}
                >
                  {totalApplications}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("curriculo")}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 transition ${
                  activeTab === "curriculo"
                    ? "bg-white text-slate-900 shadow-sm font-bold"
                    : "text-slate-200 hover:bg-slate-600/70 hover:text-white"
                }`}
              >
                <FileText className="size-3.5" />
                <span>Currículo</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("dados")}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 transition ${
                  activeTab === "dados"
                    ? "bg-white text-slate-900 shadow-sm font-bold"
                    : "text-slate-200 hover:bg-slate-600/70 hover:text-white"
                }`}
              >
                <User className="size-3.5" />
                <span>Dados Internos</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("ia")}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 transition ${
                  activeTab === "ia"
                    ? "bg-white text-slate-900 shadow-sm font-bold"
                    : "text-slate-200 hover:bg-slate-600/70 hover:text-white"
                }`}
              >
                <Sparkles className="size-3.5 text-amber-300" />
                <span>Parecer da IA & Triagem</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("entrevistas")}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 transition ${
                  activeTab === "entrevistas"
                    ? "bg-white text-slate-900 shadow-sm font-bold"
                    : "text-slate-200 hover:bg-slate-600/70 hover:text-white"
                }`}
              >
                <MessageSquare className="size-3.5" />
                <span>Entrevistas & Parecer</span>
              </button>

              {hasImpediment && (
                <button
                  type="button"
                  onClick={() => setActiveTab("ocorrencias")}
                  className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 transition ${
                    activeTab === "ocorrencias"
                      ? "bg-white text-red-700 shadow-sm font-bold"
                      : "text-red-200 hover:bg-red-900/40 hover:text-white"
                  }`}
                >
                  <AlertTriangle className="size-3.5 text-red-400" />
                  <span>Ocorrências</span>
                </button>
              )}
            </nav>
          </div>

          {/* CONTEÚDO DAS ABAS */}
          
          {/* ABA 1: INSCRIÇÕES (HISTÓRICO EXATAMENTE COMO NO MODELO DO PARCEIRO) */}
          {activeTab === "inscricoes" && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Layers className="size-4 text-slate-600" />
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                    Histórico de Inscrições na Empresa
                  </h3>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  Total de {totalApplications} processo{totalApplications > 1 ? "s" : ""}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/75 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      <th className="px-3.5 py-2.5">Cód</th>
                      <th className="px-3.5 py-2.5">Nome da Vaga</th>
                      <th className="px-3.5 py-2.5">Unidade / Local</th>
                      <th className="px-3.5 py-2.5">Empresa</th>
                      <th className="px-3.5 py-2.5">Status</th>
                      <th className="px-3.5 py-2.5">Inscrição</th>
                      <th className="px-3.5 py-2.5">Motivo Reprovação / Observação</th>
                      <th className="px-3.5 py-2.5 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allApplications.map((appItem, idx) => {
                      const isCurrent = appItem.id === applicationId;
                      const hasItemImpediment = appItem.hasImpediment || (isCurrent && hasImpediment);
                      const displayReason =
                        appItem.impedimentReason ||
                        (isCurrent ? impedimentReason : null) ||
                        extractStandbyReason(appItem.managerNotes) ||
                        (appItem.status === "REJECTED" ? "Não aderente aos requisitos" : null);

                      return (
                        <tr
                          key={appItem.id}
                          className={`transition ${
                            isCurrent
                              ? "bg-amber-50/50 font-medium"
                              : idx % 2 === 0
                                ? "bg-white hover:bg-slate-50/80"
                                : "bg-slate-50/40 hover:bg-slate-50"
                          }`}
                        >
                          {/* Código da Vaga */}
                          <td className="px-3.5 py-3 font-mono font-bold text-slate-700">
                            {appItem.job.code || "—"}
                          </td>

                          {/* Nome da Vaga */}
                          <td className="px-3.5 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900">
                                {appItem.job.title}
                              </span>
                              {isCurrent && (
                                <span className="rounded bg-amber-200/80 px-1.5 py-0.2 text-[9px] font-extrabold uppercase tracking-wide text-amber-900">
                                  Vaga Atual
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Unidade / Local */}
                          <td className="px-3.5 py-3 text-slate-600">
                            {appItem.job.location || city || "Geral"}
                          </td>

                          {/* Empresa */}
                          <td className="px-3.5 py-3 font-semibold text-slate-700">
                            {companyName}
                          </td>

                          {/* Status */}
                          <td className="px-3.5 py-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                appItem.status === "APPROVED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : appItem.status === "REJECTED"
                                    ? "bg-slate-200 text-slate-700"
                                    : appItem.status === "INTERVIEW"
                                      ? "bg-sky-100 text-sky-800"
                                      : appItem.status === "SHORTLISTED"
                                        ? "bg-amber-100 text-amber-800"
                                        : appItem.status === "STANDBY"
                                          ? "bg-teal-100 text-teal-800"
                                          : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {appStatusLabels[appItem.status as AppStatusKey] || appItem.status}
                            </span>
                          </td>

                          {/* Data de Inscrição */}
                          <td className="px-3.5 py-3 text-slate-500 tabular-nums">
                            {formatDateShort(appItem.createdAt)}
                          </td>

                          {/* Motivo Reprovação / Observação */}
                          <td className="px-3.5 py-3">
                            {hasItemImpediment ? (
                              <div className="flex items-center gap-1.5 text-red-700 font-semibold" title={displayReason || "Tarja Preta"}>
                                <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
                                <span className="truncate max-w-[200px]">
                                  {displayReason || "Tarja preta / Impedimento"}
                                </span>
                              </div>
                            ) : displayReason ? (
                              <div className="flex items-center gap-1 text-slate-600" title={displayReason}>
                                <span className="truncate max-w-[200px]">{displayReason}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Ação */}
                          <td className="px-3.5 py-3 text-right">
                            {isCurrent ? (
                              <span className="text-[11px] font-semibold text-slate-400">Em exibição</span>
                            ) : (
                              <Link
                                href={`/candidaturas/${appItem.id}`}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
                              >
                                <span>Ver</span>
                                <ExternalLink className="size-2.5" />
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ABA 2: CURRÍCULO (PDF INTEGRADO) */}
          {activeTab === "curriculo" && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <header className="flex h-11 items-center justify-between border-b border-slate-200 bg-slate-50 px-4 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="size-4 text-slate-600" />
                  <span className="truncate text-xs font-bold text-slate-800">
                    Documento Original · {name}
                  </span>
                  {latestResumeInfo?.latestResumeUrl && (
                    <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-md text-[10px] shrink-0 font-medium">
                      <button
                        type="button"
                        onClick={() => setActiveResumeVersion("current")}
                        className={`px-2 py-0.5 rounded transition ${
                          activeResumeVersion === "current"
                            ? "bg-white text-slate-900 font-bold shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Desta vaga
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveResumeVersion("latest")}
                        className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
                          activeResumeVersion === "latest"
                            ? "bg-white text-sky-800 font-bold shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                        title={`Ver currículo mais recente enviado em ${latestResumeInfo.sourceTitle || "outra vaga"}`}
                      >
                        <Sparkles className="size-2.5 text-sky-600" />
                        <span>Mais recente</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={downloadResumeUrl}
                    className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-900 transition"
                  >
                    <Download className="size-3" />
                    <span>Baixar</span>
                  </a>
                  <a
                    href={effectiveResumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 transition"
                  >
                    <ExternalLink className="size-3" />
                    <span>Nova aba</span>
                  </a>
                </div>
              </header>

              <div className="relative min-h-[640px] h-[calc(100vh-16rem)] bg-slate-600">
                <iframe
                  key={effectiveResumeUrl}
                  src={`${effectiveResumeUrl}#toolbar=1&navpanes=0`}
                  className="size-full border-0"
                  title={`Currículo de ${name}`}
                />
              </div>
            </div>
          )}

          {/* ABA 3: DADOS INTERNOS (FICHA CADASTRAL CORPORATIVA) */}
          {activeTab === "dados" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <User className="size-4 text-slate-600" />
                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">
                      Ficha Cadastral e Dados Internos
                    </h3>
                  </div>
                  {registrationEditorInlineSlot}
                </div>

                {/* Subcomponente com os blocos de dados e perguntas */}
                <div className="mt-4">{dadosInternosContentSlot}</div>
              </div>
            </div>
          )}

          {/* ABA 4: PARECER DA IA & TRIAGEM */}
          {activeTab === "ia" && (
            <div className="space-y-4">
              {iaEvaluationContentSlot}
            </div>
          )}

          {/* ABA 5: ENTREVISTAS & PARECER */}
          {activeTab === "entrevistas" && (
            <div className="space-y-4">
              {entrevistasContentSlot}
            </div>
          )}

          {/* ABA 6: OCORRÊNCIAS */}
          {activeTab === "ocorrencias" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-red-200 bg-red-50/60 p-5 shadow-xs">
                <div className="flex items-center gap-2 text-red-900">
                  <AlertTriangle className="size-5 text-red-600" />
                  <h3 className="text-sm font-bold uppercase tracking-wide">
                    Ocorrências & Tarja Preta
                  </h3>
                </div>
                <p className="mt-2 text-xs text-red-800 leading-relaxed">
                  {impedimentReason || "Candidato possui impedimento de contratação registrado pelo gestor."}
                </p>
                {impedimentAt && (
                  <p className="mt-2 text-[11px] text-red-700">
                    Registrado em: <strong>{formatDateShort(impedimentAt)}</strong>
                  </p>
                )}
              </div>
              {ocorrenciasContentSlot}
            </div>
          )}
        </main>
      </div>

      {/* MODAL DE DOSSIÊ PARA EMPRESA */}
      {companyDossierData && (
        <CompanyDossierModal
          open={companyDossierOpen}
          onClose={() => setCompanyDossierOpen(false)}
          companyName={companyName}
          jobTitle={jobTitle}
          candidates={companyDossierData}
        />
      )}
    </div>
  );
}
