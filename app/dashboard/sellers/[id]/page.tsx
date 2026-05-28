import { notFound, redirect } from "next/navigation";

import { AdminSellerDetailPage } from "@/components/admin/adminSellerDetailPage";
import { auth } from "@/auth";
import { getAdminSeller } from "@/lib/serverApi";

interface DashboardSellerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function DashboardSellerDetailPage({
  params,
}: DashboardSellerDetailPageProps) {
  const session = await auth();

  if (!session) {
    redirect("/auth/sign-in?callbackUrl=/dashboard/sellers");
  }

  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }

  const { id } = await params;
  const seller = await getAdminSeller(id);

  if (!seller) {
    notFound();
  }

  return <AdminSellerDetailPage initialSeller={seller} />;
}
