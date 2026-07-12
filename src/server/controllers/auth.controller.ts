"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/server/models/user.model";
import { getSessionUser, isAdmin } from "@/server/services/auth.service";

export type LoginState = { error: string } | null;

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
    // Autenticou no Supabase mas não tem cadastro interno — sem acesso.
    await supabase.auth.signOut();
    return { error: "Este usuário não tem acesso à plataforma." };
  }

  redirect(isAdmin(user) ? "/admin/empresas" : "/painel");
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
