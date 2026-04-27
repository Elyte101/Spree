import type { ReactNode } from "react";
import { getServerSession } from "next-auth";

import { AdminWorkspaceShell } from "@/components/admin/adminWorkspaceShell";
import { authOptions } from "@/lib/auth";
import { canCreateProductsRole } from "@/lib/roles";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user.role ?? "customer";

  return (
    <AdminWorkspaceShell
      userName={session?.user.name ?? "Spree user"}
      userRole={userRole}
      canManageCatalog={canCreateProductsRole(userRole)}
    >
      {children}
    </AdminWorkspaceShell>
  );
}
