import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  mockApplication,
  updateApplicationImpediment,
  updateApplicationStatus,
  updateInterview,
  updateApplicationAi,
  findApplicationById,
  createStatusEvent,
} = vi.hoisted(() => {
  const app = {
    id: "app-1",
    companyId: "comp-1",
    status: "SHORTLISTED",
    hasImpediment: false,
    impedimentReason: null as string | null,
    impedimentAt: null as Date | null,
    email: "candidato@teste.com",
    name: "Carlos Silva",
    jobId: "job-1",
    resumeUrl: "resumes/cv.pdf",
    aiState: "DONE",
    aiScore: 85,
    company: { id: "comp-1", name: "Empresa Teste" },
    job: { id: "job-1", title: "Operador de Caixa", aiMinScore: 70 },
  };

  return {
    mockApplication: app,
    updateApplicationImpediment: vi.fn(async (id: string, hasImpediment: boolean, reason: string | null) => ({
      ...app,
      id,
      hasImpediment,
      impedimentReason: hasImpediment ? reason : null,
      impedimentAt: hasImpediment ? new Date() : null,
    })),
    updateApplicationStatus: vi.fn(async (id: string, status: string) => ({
      ...app,
      id,
      status,
    })),
    updateInterview: vi.fn(async (id: string, data: any) => ({
      ...app,
      id,
      ...data,
    })),
    updateApplicationAi: vi.fn(async (id: string, data: any) => ({
      ...app,
      id,
      ...data,
    })),
    findApplicationById: vi.fn(async (id: string) => {
      if (id === app.id) return { ...app };
      return null;
    }),
    createStatusEvent: vi.fn(async () => ({ id: "ev-1" })),
  };
});

vi.mock("@/server/repositories/application.repository", () => ({
  updateApplicationImpediment,
  updateApplicationStatus,
  updateInterview,
  updateApplicationAi,
  findApplicationById,
  createStatusEvent,
  findApplicationsByIds: vi.fn(async () => []),
  findUnevaluatedApplications: vi.fn(async () => []),
}));

vi.mock("@/server/services/bulk-message.service", () => ({
  sendBulkMessage: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/inngest", () => ({
  trySendEvent: vi.fn(async () => true),
}));

vi.mock("@/server/services/company.service", () => ({
  getCompanyById: vi.fn(async () => ({ id: "comp-1", name: "Empresa Teste" })),
}));

vi.mock("@/server/services/talent.service", () => ({
  autoCategorizeTalent: vi.fn(async () => {}),
}));

import {
  toggleApplicationImpediment,
  setApplicationStatus,
  scheduleInterview,
  requestReanalysis,
} from "@/server/services/application.service";
import { moveApplication } from "@/server/services/stage-move.service";
import { analyzeApplication, runTriageWithTracking } from "@/server/services/ai.service";

describe("Impedimento de Contratação (Tarja Preta)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApplication.hasImpediment = false;
    mockApplication.impedimentReason = null;
    mockApplication.status = "SHORTLISTED";
  });

  describe("Ativação e Desativação (Reversibilidade)", () => {
    it("ativa o impedimento com motivo e persiste no repositório", async () => {
      const result = await toggleApplicationImpediment(
        "comp-1",
        "app-1",
        true,
        "Restrição de Compliance"
      );

      expect(result.ok).toBe(true);
      expect(result.hasImpediment).toBe(true);
      expect(result.reason).toBe("Restrição de Compliance");
      expect(updateApplicationImpediment).toHaveBeenCalledWith(
        "app-1",
        true,
        "Restrição de Compliance"
      );
    });

    it("desmarca o impedimento (reversibilidade) limpando o motivo", async () => {
      mockApplication.hasImpediment = true;
      mockApplication.impedimentReason = "Restrição de Compliance";

      const result = await toggleApplicationImpediment(
        "comp-1",
        "app-1",
        false
      );

      expect(result.ok).toBe(true);
      expect(result.hasImpediment).toBe(false);
      expect(result.reason).toBeNull();
      expect(updateApplicationImpediment).toHaveBeenCalledWith("app-1", false, null);
    });

    it("respeita isolamento de tenant (Regra 1): não altera candidatura de outra empresa", async () => {
      const result = await toggleApplicationImpediment(
        "outra-empresa",
        "app-1",
        true,
        "Motivo"
      );

      expect(result.ok).toBe(false);
      expect(result.error).toContain("não encontrada");
      expect(updateApplicationImpediment).not.toHaveBeenCalled();
    });
  });

  describe("Bloqueio de Movimentação no Funil", () => {
    it("moveApplication bloqueia avanço para INTERVIEW se houver impedimento", async () => {
      mockApplication.hasImpediment = true;
      mockApplication.impedimentReason = "Conduta inadequada";

      const result = await moveApplication("comp-1", "app-1", "INTERVIEW", {
        mode: "silent",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("impedimento de contratação ativo (Tarja Preta)");
      }
      expect(updateApplicationStatus).not.toHaveBeenCalled();
    });

    it("moveApplication bloqueia avanço para APPROVED se houver impedimento", async () => {
      mockApplication.hasImpediment = true;

      const result = await moveApplication("comp-1", "app-1", "APPROVED", {
        mode: "silent",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("impedimento de contratação ativo (Tarja Preta)");
      }
      expect(updateApplicationStatus).not.toHaveBeenCalled();
    });

    it("moveApplication permite mover para REJECTED mesmo com impedimento", async () => {
      mockApplication.hasImpediment = true;

      const result = await moveApplication("comp-1", "app-1", "REJECTED", {
        mode: "silent",
      });

      expect(result.ok).toBe(true);
      expect(updateApplicationStatus).toHaveBeenCalledWith("app-1", "REJECTED");
    });

    it("moveApplication permite mover para STANDBY mesmo com impedimento", async () => {
      mockApplication.hasImpediment = true;

      const result = await moveApplication("comp-1", "app-1", "STANDBY", {
        mode: "silent",
      });

      expect(result.ok).toBe(true);
      expect(updateApplicationStatus).toHaveBeenCalledWith("app-1", "STANDBY");
    });

    it("setApplicationStatus retorna null ao tentar mover para INTERVIEW com impedimento", async () => {
      mockApplication.hasImpediment = true;

      const result = await setApplicationStatus("comp-1", "app-1", "INTERVIEW");
      expect(result).toBeNull();
      expect(updateApplicationStatus).not.toHaveBeenCalled();
    });

    it("scheduleInterview bloqueia agendamento de candidato impedido", async () => {
      mockApplication.hasImpediment = true;

      const result = await scheduleInterview("comp-1", "app-1", {
        at: new Date(),
        mode: "Presencial",
        location: "Sala 2",
      });

      expect(result.ok).toBe(false);
      expect(updateInterview).not.toHaveBeenCalled();
    });
  });

  describe("Bloqueio de Reanálise da IA", () => {
    it("requestReanalysis rejeita reenfileirar candidato impedido", async () => {
      mockApplication.hasImpediment = true;

      const result = await requestReanalysis("comp-1", "app-1");
      expect(result.ok).toBe(false);
      expect(updateApplicationAi).not.toHaveBeenCalled();
    });

    it("analyzeApplication retorna null imediatamente para candidato impedido", async () => {
      mockApplication.hasImpediment = true;

      const result = await analyzeApplication("app-1");
      expect(result).toBeNull();
      expect(updateApplicationAi).not.toHaveBeenCalled();
    });

    it("runTriageWithTracking aborta sem criar run de agente para candidato impedido", async () => {
      mockApplication.hasImpediment = true;

      await runTriageWithTracking("app-1", {
        eventName: "application/reanalyze-batch",
      });

      expect(updateApplicationAi).not.toHaveBeenCalled();
    });
  });
});
