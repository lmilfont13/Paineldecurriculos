import { redirect } from "next/navigation";

import { getDefaultPublicSlug } from "@/server/controllers/public.controller";

// A empresa ativa é lida do banco a cada acesso — não congelar no build.
export const dynamic = "force-dynamic";

/** Raiz do site: abre direto a página de carreiras da empresa ativa. */
export default async function Home() {
  const slug = await getDefaultPublicSlug();
  redirect(slug ? `/${slug}/vagas` : "/login");
}
