import { unzipSync, strFromU8 } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const findApps = vi.fn();
vi.mock("@/server/repositories/application.repository", () => ({
  findApplicationsForExport: (...a: unknown[]) => findApps(...a),
}));
const audit = vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({}));
vi.mock("@/server/repositories/audit.repository", () => ({
  createAuditLog: (...a: unknown[]) => audit(...a),
}));
const company = vi.fn();
vi.mock("@/server/services/company.service", () => ({
  getCompanyById: (...a: unknown[]) => company(...a),
}));

import { exportCompanyCandidates } from "./candidate-export.service";

const USER = { id: "u1", email: "g@x.com", name: "Gestora" };
const APP = {
  id: "a1", candidateId: "c1", name: "=HYPERLINK(\"http://mal\")", email: "x@x.com", phone: "+5511999990000",
  birthDate: null, city: "São Paulo", state: "sp", neighborhood: null, desiredRole: null, salaryExpectation: null,
  workPreference: null, availability: null, hasCnh: null, source: null, status: "PENDING", aiState: "DONE",
  aiScore: 80, aiArea: null, aiLevel: null, hasImpediment: false, consentAt: null,
  createdAt: new Date("2026-11-01T12:00:00Z"), interviewAt: null, interviewMode: null,
  job: { title: "Promotor", code: "7", aiMinScore: 60, isTalentPool: false },
};

function files(buffer: Buffer) {
  const zip = unzipSync(new Uint8Array(buffer));
  return Object.fromEntries(Object.entries(zip).map(([k, v]) => [k, strFromU8(v)]));
}

beforeEach(() => {
  findApps.mockReset();
  audit.mockClear();
  company.mockReset();
});

describe("exportCompanyCandidates", () => {
  it("gera as três abas, só com a empresa da sessão, e registra na auditoria sem dados pessoais", async () => {
    company.mockResolvedValue({ id: "co1", name: "Acme" });
    findApps.mockResolvedValue([APP]);
    const out = await exportCompanyCandidates("co1", USER);
    expect(findApps).toHaveBeenCalledWith("co1");
    expect(out!.fileName).toMatch(/^cadastrados-acme-\d{4}-\d{2}-\d{2}\.xlsx$/);

    const xml = files(out!.buffer);
    for (const name of ["Pessoas", "Candidaturas", "Resumo"]) expect(xml["xl/workbook.xml"]).toContain(`name="${name}"`);

    expect(audit).toHaveBeenCalledTimes(1);
    const entry = audit.mock.calls[0][0] as { action: string; companyId: string; metadata: unknown };
    expect(entry.action).toBe("CADASTROS_EXPORTADOS");
    expect(entry.companyId).toBe("co1");
    expect(entry.metadata).toEqual({ pessoas: 1, candidaturas: 1 });
  });

  it("texto do candidato nunca vira fórmula na planilha", async () => {
    company.mockResolvedValue({ id: "co1", name: "Acme" });
    findApps.mockResolvedValue([APP]);
    const out = await exportCompanyCandidates("co1", USER);
    const sheets = Object.entries(files(out!.buffer)).filter(([k]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k));
    expect(sheets.length).toBe(3);
    for (const [, content] of sheets) expect(content).not.toContain("<f>");
  });

  it("sem registro na auditoria, a planilha não sai", async () => {
    company.mockResolvedValue({ id: "co1", name: "Acme" });
    findApps.mockResolvedValue([APP]);
    audit.mockRejectedValueOnce(new Error("banco fora"));
    await expect(exportCompanyCandidates("co1", USER)).rejects.toThrow();
  });

  it("empresa inexistente: nada é lido", async () => {
    company.mockResolvedValue(null);
    expect(await exportCompanyCandidates("x", USER)).toBeNull();
    expect(findApps).not.toHaveBeenCalled();
  });
});
