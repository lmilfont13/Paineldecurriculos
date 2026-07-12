import { redirect } from "next/navigation";

/** A raiz não tem tela própria no design — o ponto de entrada é o login. */
export default function Home() {
  redirect("/login");
}
