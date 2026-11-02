import { notFound, redirect } from "next/navigation";

import { getTalentBankEntryPath } from "@/server/controllers/public.controller";

/**
 * Cadastro sem vaga: leva para o mesmo formulário de candidatura, só que na
 * vaga oculta "Banco de talentos". O currículo entra no banco e, quando abrir
 * uma vaga parecida, a empresa já tem a pessoa.
 */
export default async function TalentBankEntryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const path = await getTalentBankEntryPath(slug);
  if (!path) notFound();
  redirect(path);
}
