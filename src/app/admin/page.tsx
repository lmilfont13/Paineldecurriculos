import { redirect } from "next/navigation";

/** /admin sozinho não tinha página (404): leva para a lista de empresas. */
export default function AdminIndexPage() {
  redirect("/admin/empresas");
}
