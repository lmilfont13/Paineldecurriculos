import "server-only";

import { cache } from "react";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  CandidateAuthResult,
  CandidateProfile,
} from "@/server/models/candidate.model";
import {
  isAllowedResumePath,
  profileResumePrefix,
  type ResumeUploadTarget,
} from "@/server/models/application.model";
import {
  RESUMES_BUCKET,
  createResumeUploadTarget,
  verifyUploadedResume,
} from "@/server/services/resume-storage.service";
import {
  anonymizeApplicationsByCandidate,
  findResumePathsByCandidate,
} from "@/server/repositories/application.repository";
import {
  createCandidate,
  deleteCandidate,
  findCandidateByEmail,
  updateCandidate,
} from "@/server/repositories/candidate.repository";
import { findUserByEmail } from "@/server/repositories/user.repository";
import { getVerifiedSessionEmail } from "@/server/services/auth.service";

/**
 * Candidato da sessão (3ª classe de sessão, separada do staff — CA1).
 * Retorna null se não houver sessão ou se o e-mail não for de candidato.
 */
export const getSessionCandidate = cache(
  async (): Promise<CandidateProfile | null> => {
    // JWT validado localmente (getClaims) — sem ida ao Auth server.
    const email = await getVerifiedSessionEmail();
    if (!email) return null;

    const candidate = await findCandidateByEmail(email);
    if (!candidate) return null;
    return {
      id: candidate.id,
      email: candidate.email,
      name: candidate.name,
      phone: candidate.phone,
      resumeUrl: candidate.resumeUrl,
    };
  }
);

/**
 * Cadastro do candidato (CA1): cria o usuário já confirmado no Supabase Auth
 * (via service role) e inicia a sessão em seguida.
 */
export async function signupCandidate(input: {
  name: string;
  email: string;
  password: string;
}): Promise<CandidateAuthResult> {
  if (await findUserByEmail(input.email)) {
    return {
      ok: false,
      error: "Este e-mail pertence a uma conta de equipe da plataforma.",
    };
  }
  if (await findCandidateByEmail(input.email)) {
    return {
      ok: false,
      error: "Este e-mail já tem conta. Use a aba Entrar.",
    };
  }

  const admin = createAdminClient();
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });
  if (authError && !/already|registered/i.test(authError.message)) {
    return { ok: false, error: "Não foi possível criar a conta. Tente novamente." };
  }

  await createCandidate({
    email: input.email,
    name: input.name,
    authId: created?.user?.id ?? null,
  });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (error) {
    return { ok: false, error: "Conta criada, mas o login falhou. Use a aba Entrar." };
  }
  return { ok: true };
}

/** Login do candidato (CA1). */
export async function loginCandidate(input: {
  email: string;
  password: string;
}): Promise<CandidateAuthResult> {
  const candidate = await findCandidateByEmail(input.email);
  if (!candidate) {
    return {
      ok: false,
      error: "E-mail sem conta de candidato. Use a aba Criar conta.",
    };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(input);
  if (error) return { ok: false, error: "E-mail ou senha incorretos." };
  return { ok: true };
}

/** Wayfinding do login: o e-mail pertence a um candidato? */
export async function emailBelongsToCandidate(email: string): Promise<boolean> {
  return (await findCandidateByEmail(email)) !== null;
}

/** Atualiza o perfil reaproveitável do candidato (CA2/CA5). */
export function updateCandidateProfile(
  candidateId: string,
  data: Partial<{ name: string; phone: string | null; resumeUrl: string | null }>
) {
  return updateCandidate(candidateId, data);
}

/**
 * CA5 · Regra 5: URL assinada para o navegador subir o PDF do perfil direto
 * no Storage (o arquivo não passa pela server action).
 */
export function requestProfileResumeUpload(
  candidateId: string
): Promise<ResumeUploadTarget | null> {
  return createResumeUploadTarget(profileResumePrefix(candidateId));
}

/** Confere o PDF enviado pelo navegador antes de vinculá-lo ao perfil. */
export async function verifyProfileResume(
  candidateId: string,
  path: string
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (!isAllowedResumePath(path, profileResumePrefix(candidateId))) {
    return { ok: false, error: "Currículo inválido. Envie o PDF novamente." };
  }
  const verified = await verifyUploadedResume(path);
  if (!verified.ok) return verified;
  return { ok: true, path };
}

/**
 * CA8 (LGPD): exclui a conta do candidato.
 * Currículos saem do Storage, candidaturas são anonimizadas (a empresa
 * mantém o registro do processo sem dados pessoais), o perfil e o usuário
 * de auth são apagados e a sessão é encerrada.
 */
export async function deleteCandidateAccount(candidate: {
  id: string;
  email: string;
  resumeUrl: string | null;
}): Promise<void> {
  const admin = createAdminClient();

  // 1. Remove currículos do Storage (perfil + candidaturas)
  const paths = new Set(await findResumePathsByCandidate(candidate.id));
  if (candidate.resumeUrl) paths.add(candidate.resumeUrl);
  if (paths.size > 0) {
    await admin.storage
      .from(RESUMES_BUCKET)
      .remove([...paths].filter((p) => !p.startsWith("demo/")));
  }

  // 2. Anonimiza candidaturas e apaga o perfil
  await anonymizeApplicationsByCandidate(candidate.id);
  const row = await findCandidateByEmail(candidate.email);
  await deleteCandidate(candidate.id);

  // 3. Apaga o usuário do Supabase Auth e encerra a sessão
  let authId = row?.authId ?? null;
  if (!authId) {
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    authId = data.users.find((u) => u.email === candidate.email)?.id ?? null;
  }
  if (authId) await admin.auth.admin.deleteUser(authId);

  const supabase = await createClient();
  await supabase.auth.signOut();
}
