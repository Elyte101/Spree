import type { ReactNode } from "react";
import { getServerSession } from "next-auth";

import { AdminWorkspaceShell } from "@/components/admin/adminWorkspaceShell";
import { authOptions } from "@/lib/auth";
import { canCreateProductsRole } from "@/lib/roles";
import { getUserProfile } from "@/lib/serverApi";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user.role ?? "customer";
  const profile =
    session && userRole === "seller"
      ? await getUserProfile(session.user.id, {
          name: session.user.name ?? undefined,
          email: session.user.email ?? undefined,
          role: session.user.role,
        })
      : null;
  const canManageCatalog =
    userRole === "admin" || (canCreateProductsRole(userRole) && profile?.sellerStatus === "active");

  return (
    <AdminWorkspaceShell
      userName={session?.user.name ?? "Spree user"}
      userRole={userRole}
      canManageCatalog={canManageCatalog}
    >
      {children}
    </AdminWorkspaceShell>
  );
}
