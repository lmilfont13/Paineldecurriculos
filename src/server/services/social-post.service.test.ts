import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const generate = vi.fn();
vi.mock("@/lib/gemini", () => ({ geminiGenerate: (...a: unknown[]) => generate(...a) }));
const findJob = vi.fn();
vi.mock("@/server/repositories/job.repository", () => ({ findJobById: (...a: unknown[]) => findJob(...a) }));

import { getJobSocialPostData, parseJobAnnouncementText } from "./social-post.service";

const JOB = {
  id: "job-1",
  companyId: "co1",
  code: "1133",
  title: "Promotor (a) de Merchandising ( LIMOEIRO DO NORTE - CE )",
  location: "Limoeiro do Norte - CE",
  contract: "CLT",
  description: "Contrato CLT determinado de 24/11 a 24/12 (Ação Temporária Blitz).",
  requirements: "",
};

beforeEach(() => {
  generate.mockReset();
  findJob.mockReset();
  findJob.mockResolvedValue(JOB);
});

describe("getJobSocialPostData", () => {
  it("título sem a cidade e contrato do texto da vaga (não força 'Efetivo')", async () => {
    generate.mockResolvedValue(JSON.stringify({ roleTitle: "x", contractType: "CLT determinado (24/11 a 24/12)" }));
    const data = await getJobSocialPostData("job-1", "co1");
    expect(data!.roleTitle).toBe("PROMOTOR(A) DE MERCHANDISING");
    expect(data!.contractType).toBe("CLT determinado (24/11 a 24/12)");
  });

  it("sem contrato no texto, usa o cadastro da vaga sem inventar 'Efetivo'", async () => {
    generate.mockResolvedValue(JSON.stringify({ roleTitle: "x" }));
    const data = await getJobSocialPostData("job-1", "co1");
    expect(data!.contractType).toBe("Regime CLT");
  });

  it("vaga de outra empresa não é lida", async () => {
    expect(await getJobSocialPostData("job-1", "outra")).toBeNull();
  });
});

describe("parseJobAnnouncementText: nada de valor de exemplo", () => {
  it("IA fora do ar: só o que estava no texto", async () => {
    generate.mockRejectedValue(new Error("429"));
    const data = await parseJobAnnouncementText("Cargo: Repositor\nLocal: Pacajus - CE");
    expect(data.roleTitle).toBe("Repositor");
    expect(data.location).toBe("Pacajus - CE");
    expect(data.salary).toBe("");
    expect(data.mealVoucher).toBe("");
    expect(data.benefitsList).toEqual([]);
    expect(data.jobCode).toBe("");
  });

  it("resposta incompleta da IA não puxa o salário do exemplo", async () => {
    generate.mockResolvedValue(JSON.stringify({ roleTitle: "" }));
    const data = await parseJobAnnouncementText("Vaga de repositor");
    expect(data.salary).toBe("");
    expect(data.healthInsurance).toBe("");
    expect(data.benefitsList).toEqual([]);
  });
});
