import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StoreProfilePage } from "@/components/store/storeProfilePage";
import { getSeller } from "@/lib/serverApi";

interface StorePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: StorePageProps): Promise<Metadata> {
  const { id } = await params;

  try {
    const vendor = await getSeller(id);

    if (!vendor) {
      return {
        title: "Storefront | Spree",
        description: "Browse a vendor storefront on Spree",
      };
    }

    return {
      title: `${vendor.storeName} | Spree`,
      description:
        vendor.storeDescription ||
        vendor.storeTagline ||
        `Shop ${vendor.storeName}'s products on Spree, Ghana's trusted marketplace.`,
    };
  } catch {
    return {
      title: "Storefront | Spree",
      description: "Browse a vendor storefront on Spree",
    };
  }
}

export default async function StorePage({ params }: StorePageProps) {
  const { id } = await params;
  const vendor = await getSeller(id);

  if (!vendor) {
    notFound();
  }

  return <StoreProfilePage initialSeller={vendor} />;
}
