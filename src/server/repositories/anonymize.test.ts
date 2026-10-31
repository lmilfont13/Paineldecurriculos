import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { updateMany } = vi.hoisted(() => ({ updateMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { application: { updateMany } } }));

import { anonymizeApplicationsByCandidate } from "@/server/repositories/application.repository";

beforeEach(() => updateMany.mockReset());

describe("anonymizeApplicationsByCandidate (LGPD)", () => {
  it("apaga também os dados da pré-entrevista", async () => {
    await anonymizeApplicationsByCandidate("c1");
    const { where, data } = updateMany.mock.calls[0][0];
    expect(where).toEqual({ candidateId: "c1" });
    expect(data).toMatchObject({
      rg: null,
      cpf: null,
      maritalStatus: null,
      hasChildren: null,
      childrenCount: null,
      professionalSummary: null,
      infoRequestedFields: [],
      infoRequestedAt: null,
      infoAnsweredAt: null,
    });
  });
});
