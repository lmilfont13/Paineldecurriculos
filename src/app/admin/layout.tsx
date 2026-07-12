import { AdminSidebar, AdminTopbar } from "@/components/admin/sidebar";
import { logoutAction } from "@/server/controllers/auth.controller";
import { getAdminShell } from "@/server/controllers/admin.controller";

/** Shell do console admin (frames A1/A5 do Figma). */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, companyCount } = await getAdminShell();

  return (
    <div className="flex min-h-screen bg-[#fafaf9]">
      <AdminSidebar
        companyCount={companyCount}
        adminName={user.name ?? "Admin"}
        adminEmail={user.email}
        logoutAction={logoutAction}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar />
        <main className="flex-1 overflow-x-auto px-12 py-9">{children}</main>
      </div>
    </div>
  );
}
