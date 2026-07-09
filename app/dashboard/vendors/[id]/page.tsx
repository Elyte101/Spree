import { notFound, redirect } from "next/navigation";

import { AdminVendorDetailPage } from "@/components/admin/adminVendorDetailPage";
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
    redirect("/auth/sign-in?callbackUrl=/dashboard/vendors");
  }

  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }

  const { id } = await params;
  const vendor = await getAdminSeller(id, session.user.id);

  if (!vendor) {
    notFound();
  }

  return <AdminVendorDetailPage initialSeller={vendor} />;
}
