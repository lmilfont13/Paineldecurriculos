import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  deleteUserById,
  findUserByEmail,
  findUsersByCompany,
  prismaCreateManagerUser,
} from "@/server/repositories/user.repository";
import { appUrl } from "@/lib/env";

export function listCompanyUsers(companyId: string) {
  return findUsersByCompany(companyId);
}

export async function inviteManager(
  companyId: string,
  data: { name: string; email: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = data.email.toLowerCase().trim();

  const existing = await findUserByEmail(email);
  if (existing) return { ok: false, error: "Esse e-mail já tem acesso ao painel." };

  const admin = createAdminClient();

  // Cria o usuário no Supabase Auth sem senha — o link de convite define a senha.
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (authError) {
    return { ok: false, error: "Não foi possível criar o acesso. Tente novamente." };
  }

  // Insere na tabela User para que o sistema reconheça como gestor desta empresa.
  await prismaCreateManagerUser({ email, name: data.name.trim(), companyId });

  // Envia e-mail de recuperação de senha para o usuário definir a própria senha.
  await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: `${appUrl()}/redefinir-senha`,
    },
  });

  return { ok: true };
}

export async function removeManager(
  companyId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const users = await findUsersByCompany(companyId);
  const target = users.find((u) => u.id === userId);
  if (!target) return { ok: false, error: "Usuário não encontrado." };
  if (users.length <= 1) {
    return { ok: false, error: "A empresa precisa ter pelo menos um gestor." };
  }

  await deleteUserById(userId);

  // Remove do Supabase Auth também (best-effort).
  const admin = createAdminClient();
  const { data: authList } = await admin.auth.admin.listUsers();
  const authUser = authList?.users?.find((u) => u.email === target.email);
  if (authUser) {
    await admin.auth.admin.deleteUser(authUser.id);
  }

  return { ok: true };
}