import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/resend", () => ({ resend: { emails: { send } } }));

import { stageMovePreview } from "@/server/models/stage-message.model";
import { sendStatusUpdateEmail } from "@/server/services/email.service";

const brand = { name: "TARHGET FORTALEZA", slug: "technova", primaryColor: "#7a1f3d", logoUrl: null, senderEmail: "rh@tarhget.com.br" };
const strip = (html: string) =>
  html.replace(/<\/?strong[^>]*>/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

beforeEach(() => send.mockReset().mockResolvedValue({ data: { id: "e1" }, error: null }));

describe("a prévia ao mover é o e-mail que sai", () => {
  for (const status of ["INTERVIEW", "APPROVED", "REJECTED"] as const) {
    it(status, async () => {
      const ctx = { candidateName: "Maria Souza", companyName: brand.name, jobTitle: "Promotor(a) de Vendas & Merch" };
      const preview = stageMovePreview(status, ctx).email!;
      await sendStatusUpdateEmail({
        brand,
        to: "maria@x.com",
        candidateName: ctx.candidateName,
        jobTitle: ctx.jobTitle,
        status,
        applicationId: "a1",
      });
      const msg = send.mock.calls[0][0];
      expect(msg.subject).toBe(preview.subject);
      const text = strip(msg.html);
      expect(text).toContain(preview.title);
      expect(text).toContain(preview.greeting);
      expect(text).toContain(preview.body.replace(/\s+/g, " "));
    });
  }
});
