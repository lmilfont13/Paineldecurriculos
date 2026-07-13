import "server-only";

import { cache } from "react";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  CandidateAuthResult,
  CandidateProfile,
} from "@/server/models/candidate.model";
import {
  MAX_RESUME_BYTES,
  RESUME_MIME,
} from "@/server/models/application.model";
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

/**
 * Candidato da sessão (3ª classe de sessão, separada do staff — CA1).
 * Retorna null se não houver sessão ou se o e-mail não for de candidato.
 */
export const getSessionCandidate = cache(
  async (): Promise<CandidateProfile | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return null;

    const candidate = await findCandidateByEmail(user.email);
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

/** CA5: sobe um novo currículo do perfil (regra 5: PDF ≤ 5 MB). */
export async function uploadProfileResume(
  candidateId: string,
  file: File
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (file.type !== RESUME_MIME) {
    return { ok: false, error: "O currículo deve ser um PDF." };
  }
  if (file.size > MAX_RESUME_BYTES) {
    return { ok: false, error: "O currículo deve ter no máximo 5 MB." };
  }
  const path = `profile/${candidateId}/${crypto.randomUUID()}.pdf`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from("resumes")
    .upload(path, file, { contentType: RESUME_MIME });
  if (error) {
    return { ok: false, error: "Falha ao enviar o currículo. Tente novamente." };
  }
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
    await admin.storage.from("resumes").remove([...paths]);
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
