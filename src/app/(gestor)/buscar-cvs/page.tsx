import type { Metadata } from "next";

import { BuscarCvsView } from "@/components/gestor/buscar-cvs-view";
import { getBuscarCvsData } from "@/server/controllers/gestor.controller";

export const metadata: Metadata = {
  title: "Buscar Currículos · Base Aberta de Talentos",
  description: "Busca inteligente no texto dos currículos com filtros facetados por área, senioridade e competências.",
};

export default async function BuscarCvsPage() {
  const { candidates, jobs } = await getBuscarCvsData();

  return (
    <BuscarCvsView
      candidates={candidates}
      jobs={jobs.map((j) => ({ id: j.id, title: j.title }))}
    />
  );
}
