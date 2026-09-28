"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireManager } from "@/server/controllers/guards";
import { createAuditLog } from "@/server/repositories/audit.repository";
import { inviteManager, listCompanyUsers, removeManager } from "@/server/services/user.service";

export type UserActionState = { error: string } | { ok: true; message: string } | null;

const inviteSchema = z.object({
  name: z.string().min(2, "Informe o nome completo."),
  email: z.string().email("Informe um e-mail válido."),
});

export async function getCompanyUsersAction() {
  const user = await requireManager();
  return listCompanyUsers(user.companyId);
}

export async function inviteManagerAction(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const user = await requireManager();
  const parsed = inviteSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const result = await inviteManager(user.companyId, parsed.data);
  if (!result.ok) return { error: result.error };
  try {
    await createAuditLog({
      companyId: user.companyId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "CONFIGURACOES_ATUALIZADAS",
      entityType: "EMPRESA",
      metadata: { acao: "usuario_convidado", convidado: parsed.data.email },
    });
  } catch { /* auditoria nunca bloqueia */ }
  revalidatePath("/configuracoes/usuarios");
  return { ok: true, message: `Convite enviado para ${parsed.data.email}. Eles receberão um link para definir a senha.` };
}

export async function removeManagerAction(userId: string): Promise<UserActionState> {
  const user = await requireManager();
  if (user.id === userId) {
    return { error: "Você não pode remover o seu próprio acesso." };
  }
  const result = await removeManager(user.companyId, userId);
  if (!result.ok) return { error: result.error };
  revalidatePath("/configuracoes/usuarios");
  return { ok: true, message: "Usuário removido." };
}
