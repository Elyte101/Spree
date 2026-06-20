import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Stack } from "@mui/material";

import { ProductCreateForm } from "@/components/admin/productCreateForm";
import { auth } from "@/auth";
import { canCreateProductsRole } from "@/lib/roles";
import { getBrands, getCategories, getCollections, getUserProfile } from "@/lib/serverApi"; // getUserProfile used for non-admin sellers

export const metadata: Metadata = {
  title: "Create Product | Spree",
  description: "Add a new item to your shop",
};

export default async function AdminProductCreatePage() {
  const session = await auth();
  const callbackUrl = "/dashboard/products/new";

  if (!session) {
    redirect(`/auth/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  if (!canCreateProductsRole(session.user.role)) {
    redirect(`/auth/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}&reason=vendor`);
  }

  const isAdmin = session.user.role === "admin";

  // Admin is always allowed — skip profile fetch and sellerStatus check
  if (!isAdmin) {
    const profile = await getUserProfile(session.user.id, {
      name: session.user.name ?? undefined,
      email: session.user.email ?? undefined,
      role: session.user.role,
    });
    if (profile.sellerStatus !== "active") {
      redirect("/profile");
    }
  }

  const [categories, brands, collections] = await Promise.all([
    getCategories(),
    getBrands(),
    getCollections(),
  ]);

  return (
    <Stack spacing={3}>
      <ProductCreateForm
        categories={categories}
        brands={brands}
        collections={collections}
      />
    </Stack>
  );
}
