import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Stack } from "@mui/material";

import { ProductCreateForm } from "@/components/admin/productCreateForm";
import { ThemedPageShell } from "@/components/ui/themedPageShell";
import { authOptions } from "@/lib/auth";
import { canCreateProductsRole } from "@/lib/roles";
import { getBrands, getCategories, getCollections } from "@/lib/serverApi";

export const metadata: Metadata = {
  title: "Create Product | Spree",
  description: "Add a new item to your shop",
};

export default async function AdminProductCreatePage() {
  const session = await getServerSession(authOptions);
  const callbackUrl = "/dashboard/products/new";

  if (!session) {
    redirect(`/auth/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  if (!canCreateProductsRole(session.user.role)) {
    redirect(`/auth/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}&reason=seller`);
  }

  const [categories, brands, collections] = await Promise.all([
    getCategories(),
    getBrands(),
    getCollections(),
  ]);

  return (
    <ThemedPageShell>
      <Stack spacing={3}>
        <ProductCreateForm
          categories={categories}
          brands={brands}
          collections={collections}
        />
      </Stack>
    </ThemedPageShell>
  );
}
