import { redirect } from "next/navigation";

/** O formulário agora mora em Configurações; o endereço antigo continua valendo. */
export default function FormularioRedirect() {
  redirect("/configuracoes/formulario");
}
