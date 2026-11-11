import "server-only";

import writeExcelFile, { type Cell, type Row } from "write-excel-file/node";

import {
  buildCandidateExport,
  exportFileName,
  type CandidateExport,
} from "@/server/models/candidate-export.model";
import { findApplicationsForExport } from "@/server/repositories/application.repository";
import { createAuditLog } from "@/server/repositories/audit.repository";
import { getCompanyById } from "@/server/services/company.service";

type Column<T> = { header: string; width: number; cell: (row: T) => Cell };

const HEADER = { fontWeight: "bold", backgroundColor: "#F1F0ED", wrap: true } as const;
const DATE = "dd/mm/yyyy";

const text = (value: string): Cell => (value ? { value, type: String } : null);
const num = (value: number | null): Cell => (value === null ? null : { value, type: Number });
const day = (value: Date | null): Cell => (value ? { value, type: Date, format: DATE } : null);

function sheet<T>(name: string, rows: T[], columns: Column<T>[], stickyColumnsCount = 1) {
  const data: Row[] = [
    columns.map((c): Cell => ({ value: c.header, ...HEADER })),
    ...rows.map((r) => columns.map((c) => c.cell(r))),
  ];
  return {
    sheet: name,
    data,
    columns: columns.map((c) => ({ width: c.width })),
    stickyRowsCount: 1,
    stickyColumnsCount,
  };
}

/** Monta o .xlsx (Pessoas, Candidaturas, Resumo) a partir dos dados já organizados. */
export async function renderCandidateWorkbook(
  data: CandidateExport,
  meta: { companyName: string; generatedAt: Date; generatedBy: string }
): Promise<Buffer> {
  type P = CandidateExport["people"][number];
  type A = CandidateExport["applications"][number];

  const people = sheet<P>("Pessoas", data.people, [
    { header: "Nome", width: 30, cell: (p) => text(p.name) },
    { header: "E-mail", width: 30, cell: (p) => text(p.email) },
    { header: "Telefone", width: 17, cell: (p) => text(p.phone) },
    { header: "Cidade", width: 20, cell: (p) => text(p.city) },
    { header: "UF", width: 5, cell: (p) => text(p.state) },
    { header: "Bairro", width: 20, cell: (p) => text(p.neighborhood) },
    { header: "Nascimento", width: 12, cell: (p) => day(p.birthDate) },
    { header: "Idade", width: 7, cell: (p) => num(p.age) },
    { header: "Cargo desejado", width: 24, cell: (p) => text(p.desiredRole) },
    { header: "Pretensão salarial", width: 16, cell: (p) => text(p.salaryExpectation) },
    { header: "Disponibilidade", width: 15, cell: (p) => text(p.availability) },
    { header: "Modalidade", width: 18, cell: (p) => text(p.workPreference) },
    { header: "CNH", width: 20, cell: (p) => text(p.cnh) },
    { header: "Candidaturas", width: 12, cell: (p) => num(p.applications) },
    { header: "Vagas", width: 40, cell: (p) => text(p.jobs) },
    { header: "Etapa atual", width: 15, cell: (p) => text(p.currentStage) },
    { header: "Melhor nota da IA", width: 11, cell: (p) => num(p.bestScore) },
    { header: "Área (IA)", width: 18, cell: (p) => text(p.aiArea) },
    { header: "Nível (IA)", width: 13, cell: (p) => text(p.aiLevel) },
    { header: "Por onde chegou", width: 15, cell: (p) => text(p.source) },
    { header: "Primeiro cadastro", width: 12, cell: (p) => day(p.firstSeen) },
    { header: "Última candidatura", width: 12, cell: (p) => day(p.lastApplied) },
    { header: "Impedimento", width: 12, cell: (p) => text(p.impediment) },
    { header: "LGPD aceita", width: 10, cell: (p) => text(p.consent) },
  ]);

  const applications = sheet<A>("Candidaturas", data.applications, [
    { header: "Nome", width: 30, cell: (a) => text(a.name) },
    { header: "E-mail", width: 30, cell: (a) => text(a.email) },
    { header: "Telefone", width: 17, cell: (a) => text(a.phone) },
    { header: "Vaga", width: 30, cell: (a) => text(a.job) },
    { header: "Código", width: 9, cell: (a) => text(a.jobCode) },
    { header: "Etapa", width: 15, cell: (a) => text(a.stage) },
    { header: "Nota da IA", width: 9, cell: (a) => num(a.score) },
    { header: "Nota mínima da vaga", width: 11, cell: (a) => num(a.minScore) },
    { header: "Atinge a mínima", width: 10, cell: (a) => text(a.meetsMinimum) },
    { header: "Área (IA)", width: 18, cell: (a) => text(a.aiArea) },
    { header: "Nível (IA)", width: 13, cell: (a) => text(a.aiLevel) },
    { header: "Por onde chegou", width: 15, cell: (a) => text(a.source) },
    { header: "Candidatou-se em", width: 13, cell: (a) => day(a.appliedOn) },
    { header: "Entrevista em", width: 13, cell: (a) => day(a.interviewOn) },
    { header: "Formato da entrevista", width: 16, cell: (a) => text(a.interviewMode) },
    { header: "Impedimento", width: 12, cell: (a) => text(a.impediment) },
  ]);

  const bold = (value: string): Cell => ({ value, fontWeight: "bold" });
  const summaryRows: Row[] = [
    [bold("Cadastrados"), text(meta.companyName)],
    [text("Gerado em"), { value: meta.generatedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }), type: String }],
    [text("Gerado por"), text(meta.generatedBy)],
    [],
    [text("Pessoas"), num(data.summary.people)],
    [text("Candidaturas"), num(data.summary.applications)],
    [],
    [bold("Por etapa"), bold("Candidaturas")],
    ...data.summary.byStage.map((s) => [text(s.label), num(s.count)]),
    [],
    [bold("Por vaga"), bold("Candidaturas")],
    ...data.summary.byJob.map((j) => [text(j.label), num(j.count)]),
    [],
    [text("A nota da IA é só um apoio: a decisão sobre cada candidato é sempre de uma pessoa.")],
    [text("Esta planilha tem dados pessoais (LGPD). Guarde em local seguro e não repasse.")],
  ];

  return writeExcelFile(
    [
      people,
      applications,
      { sheet: "Resumo", data: summaryRows, columns: [{ width: 44 }, { width: 28 }] },
    ],
    { fontFamily: "Calibri", fontSize: 11 }
  ).toBuffer();
}

/**
 * Planilha com todos os cadastrados da empresa. `companyId` vem da sessão
 * (regra 1). O download fica registrado na auditoria; sem o registro, não sai.
 */
export async function exportCompanyCandidates(
  companyId: string,
  user: { id: string; email: string; name: string | null }
): Promise<{ fileName: string; buffer: Buffer } | null> {
  const company = await getCompanyById(companyId);
  if (!company) return null;
  const now = new Date();
  const data = buildCandidateExport(await findApplicationsForExport(companyId), now);

  await createAuditLog({
    companyId,
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    action: "CADASTROS_EXPORTADOS",
    entityType: "EMPRESA",
    entityId: companyId,
    entityLabel: company.name,
    metadata: { pessoas: data.summary.people, candidaturas: data.summary.applications },
  });

  const buffer = await renderCandidateWorkbook(data, {
    companyName: company.name,
    generatedAt: now,
    generatedBy: user.name || user.email,
  });
  return { fileName: exportFileName(company.name, now), buffer };
}
