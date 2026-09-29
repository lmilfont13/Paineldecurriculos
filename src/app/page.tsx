import { redirect } from "next/navigation";

/** Raiz do site: redireciona para o login unificado. */
export default function Home() {
  redirect("/login");
}
