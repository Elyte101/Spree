import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StoreProfilePage } from "@/components/store/storeProfilePage";
import { getSeller } from "@/lib/serverApi";

export const metadata: Metadata = {
  title: "Storefront | Spree",
  description: "Browse a seller storefront on Spree",
};

interface StorePageProps {
  params: Promise<{ id: string }>;
}

export default async function StorePage({ params }: StorePageProps) {
  const { id } = await params;
  const seller = await getSeller(id);

  if (!seller) {
    notFound();
  }

  return <StoreProfilePage initialSeller={seller} />;
}
