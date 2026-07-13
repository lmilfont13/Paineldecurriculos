import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type {
  AdminUser,
  ManagerUser,
  SessionUser,
} from "@/server/models/user.model";
import { findUserByEmail } from "@/server/repositories/user.repository";

/**
 * Resolve o usuário da sessão Supabase para o usuário de domínio (tabela User).
 * Retorna null se não houver sessão ou se o e-mail não tiver cadastro interno.
 * `cache()` garante uma única resolução por request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const dbUser = await findUserByEmail(user.email);
  if (!dbUser) return null;

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role,
    companyId: dbUser.companyId,
  };
});

export function isManager(user: SessionUser): user is ManagerUser {
  return user.role === "MANAGER" && user.companyId !== null;
}

export function isAdmin(user: SessionUser): user is AdminUser {
  return user.role === "ADMIN";
}

/**
 * CA7/G13 · Recuperação de senha unificada (gestor, admin e candidato).
 * O Supabase envia o e-mail com link para /redefinir-senha?code=…
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/redefinir-senha`,
  });
}

/** Troca o code do link de recuperação por sessão e define a nova senha. */
export async function resetPassword(
  code: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return {
      ok: false,
      error: "Link inválido ou expirado. Peça um novo link de recuperação.",
    };
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { ok: false, error: "Não foi possível redefinir a senha." };
  }
  return { ok: true };
}
