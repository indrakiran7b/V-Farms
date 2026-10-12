import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminSession } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) {
    return <div className="min-h-screen bg-ivory-50">{children}</div>;
  }
  return (
    <AdminShell role={session.role} email={session.email}>
      {children}
    </AdminShell>
  );
}
