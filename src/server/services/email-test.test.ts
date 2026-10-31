import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/resend", () => ({ resend: { emails: { send } } }));

import { sendTestEmail } from "@/server/services/email.service";

const brand = { name: "TARHGET FORTALEZA", slug: "technova", primaryColor: "#7a1f3d", logoUrl: null };

beforeEach(() => send.mockReset().mockResolvedValue({ data: { id: "e1" }, error: null }));

describe("sendTestEmail", () => {
  it("envia do remetente da empresa para o endereço pedido e diz que saiu", async () => {
    const outcome = await sendTestEmail({ ...brand, senderEmail: "vanessa.freitas@tarhgetfortaleza.com.br" }, "vanessa.freitas@tarhgetfortaleza.com.br");
    expect(outcome).toBe("sent");
    const msg = send.mock.calls[0][0];
    expect(msg.from).toBe("TARHGET FORTALEZA <vanessa.freitas@tarhgetfortaleza.com.br>");
    expect(msg.to).toBe("vanessa.freitas@tarhgetfortaleza.com.br");
    expect(msg.subject).toMatch(/teste/i);
  });

  it("sem remetente próprio usa o padrão do sistema e avisa que é modo de teste", async () => {
    expect(await sendTestEmail(brand, "alguem@empresa.com.br")).toBe("sandbox");
  });

  it("se o Resend recusar (domínio não verificado, por exemplo), devolve falha", async () => {
    send.mockResolvedValue({ data: null, error: { message: "domain is not verified" } });
    expect(await sendTestEmail({ ...brand, senderEmail: "x@naoverificado.com" }, "a@b.com")).toBe("failed");
  });
});
