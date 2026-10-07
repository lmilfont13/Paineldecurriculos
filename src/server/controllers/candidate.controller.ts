"use server";

import { redirect } from "next/navigation";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  candidateLoginSchema,
  candidateSignupSchema,
} from "@/server/models/candidate.model";
import { withdrawApplication } from "@/server/services/application.service";
import { markRead } from "@/server/services/notification.service";
import {
  deleteCandidateAccount,
  getSessionCandidate,
  loginCandidate,
  signupCandidate,
  updateCandidateProfile,
  requestProfileResumeUpload,
  verifyProfileResume,
} from "@/server/services/candidate.service";

export type CandidateAuthState = { error: string } | null;

/** Sanitiza o destino pós-login: só caminhos internos. */
function safeNext(raw: FormDataEntryValue | null, fallback: string): string {
  const value = String(raw ?? "");
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

/** CA1 · Criar conta de candidato e continuar a candidatura. */
export async function signupCandidateAction(
  _prev: CandidateAuthState,
  formData: FormData
): Promise<CandidateAuthState> {
  const parsed = candidateSignupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const result = await signupCandidate(parsed.data);
  if (!result.ok) return { error: result.error };
  redirect(safeNext(formData.get("next"), "/"));
}

/** CA1 · Entrar com conta de candidato existente. */
export async function loginCandidateAction(
  _prev: CandidateAuthState,
  formData: FormData
): Promise<CandidateAuthState> {
  const parsed = candidateLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const result = await loginCandidate(parsed.data);
  if (!result.ok) return { error: result.error };
  redirect(safeNext(formData.get("next"), "/"));
}

/** Sair da conta de candidato (volta para a página de vagas do tenant). */
export async function logoutCandidateAction(slug: string): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${slug}/vagas`);
}

/** CA5 · Atualiza nome, telefone e (opcionalmente) o currículo do perfil. */
export async function updateProfileAction(
  slug: string,
  _prev: CandidateAuthState,
  formData: FormData
): Promise<CandidateAuthState> {
  const candidate = await getSessionCandidate();
  if (!candidate) return { error: "Sessão expirada. Entre novamente." };

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (name.length < 2) return { error: "Informe seu nome completo." };

  // Regra 5: o PDF já foi enviado pelo navegador direto ao Storage.
  let resumeUrl: string | null | undefined = undefined;
  const resumePath = String(formData.get("resumePath") ?? "").trim();
  if (resumePath) {
    const verified = await verifyProfileResume(candidate.id, resumePath);
    if (!verified.ok) return { error: verified.error };
    resumeUrl = verified.path;
  }

  await updateCandidateProfile(candidate.id, {
    name,
    phone: phone || null,
    ...(resumeUrl !== undefined ? { resumeUrl } : {}),
  });
  revalidatePath(`/${slug}/perfil`);
  return null;
}

/** CA5 · Destino assinado para subir o PDF do perfil direto no Storage. */
export async function requestProfileResumeUploadAction(): Promise<
  { ok: true; path: string; token: string } | { ok: false; error: string }
> {
  const candidate = await getSessionCandidate();
  if (!candidate) return { ok: false, error: "Sessão expirada. Entre novamente." };
  const target = await requestProfileResumeUpload(candidate.id);
  if (!target) {
    return { ok: false, error: "Não foi possível preparar o envio do currículo." };
  }
  return { ok: true, ...target };
}

/** Retirar candidatura — decisão do candidato, apaga o registro. */
export async function withdrawApplicationAction(
  slug: string,
  applicationId: string
): Promise<void> {
  const candidate = await getSessionCandidate();
  if (candidate) {
    await withdrawApplication(candidate.id, applicationId);
  }
  redirect(`/${slug}/minhas-candidaturas`);
}

/** Marca as novidades como lidas — sempre no escopo do candidato da sessão. */
export async function markNotificationsReadAction(slug: string): Promise<void> {
  const candidate = await getSessionCandidate();
  if (candidate) await markRead(candidate.id);
  revalidatePath(`/${slug}/notificacoes`);
  revalidatePath(`/${slug}/minhas-candidaturas`);
}

/** CA8 · Exclui a conta e os dados pessoais (LGPD). */
export async function deleteAccountAction(slug: string): Promise<void> {
  const candidate = await getSessionCandidate();
  if (!candidate) redirect(`/${slug}/vagas`);
  await deleteCandidateAccount(candidate);
  redirect(`/${slug}/vagas`);
}
