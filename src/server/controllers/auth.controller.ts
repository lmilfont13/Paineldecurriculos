"use server";

import { redirect } from "next/navigation";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/server/models/user.model";
import { emailBelongsToCandidate } from "@/server/services/candidate.service";
import {
  getSessionUser,
  isAdmin,
  resetPassword,
  sendPasswordReset,
} from "@/server/services/auth.service";

export type LoginState = { error: string; isCandidate?: boolean } | null;

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: "E-mail ou senha incorretos." };
  }

  const user = await getSessionUser();
  if (!user) {
    // Autenticou mas não é staff. Se for candidato, aponta o caminho certo.
    const isCandidate = await emailBelongsToCandidate(parsed.data.email);
    await supabase.auth.signOut();
    if (isCandidate) {
      return { error: “candidato”, isCandidate: true };
    }
    return { error: "Este e-mail não tem acesso à plataforma." };
  }

  redirect(isAdmin(user) ? "/admin/empresas" : "/painel");
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type PasswordFlowState = { error?: string; done?: boolean } | null;

/** CA7/G13 · Envia o link de recuperação (resposta neutra, sem vazar cadastro). */
export async function forgotPasswordAction(
  _prev: PasswordFlowState,
  formData: FormData
): Promise<PasswordFlowState> {
  const parsed = z.email().safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Informe um e-mail válido." };
  await sendPasswordReset(parsed.data);
  return { done: true };
}

/** Define a nova senha a partir do link do e-mail. */
export async function resetPasswordAction(
  _prev: PasswordFlowState,
  formData: FormData
): Promise<PasswordFlowState> {
  const code = String(formData.get("code") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!code) return { error: "Link inválido. Peça um novo." };
  if (password.length < 8) {
    return { error: "A senha precisa de pelo menos 8 caracteres." };
  }
  const result = await resetPassword(code, password);
  if (!result.ok) return { error: result.error };
  return { done: true };
}
