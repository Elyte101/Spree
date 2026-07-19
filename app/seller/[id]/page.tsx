import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SellerProfilePage } from "@/components/seller/sellerProfilePage";
import { getProducts, getSellerReviews, getSellerSummary } from "@/lib/serverApi";

export const revalidate = 60;

const SELLER_PRODUCTS_LIMIT = 24;
const SELLER_REVIEWS_LIMIT = 8;

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  // getSellerSummary throws on a 404 (its getJson fallback only covers
  // 5xx/401/403) — caught here the same way app/products/[id]/page.tsx
  // already handles the identical "seller may not exist" case.
  const seller = await getSellerSummary(id).catch(() => undefined);

  if (!seller) {
    return { title: "Seller not found | Spree" };
  }

  return {
    title: `${seller.storeName} | Spree`,
    description:
      seller.storeTagline ||
      seller.storeDescription ||
      `Shop ${seller.storeName}'s products on Spree.`,
  };
}

export default async function SellerPage({ params }: PageProps) {
  const { id } = await params;
  const seller = await getSellerSummary(id).catch(() => undefined);

  if (!seller) {
    notFound();
  }

  const [catalog, reviews] = await Promise.all([
    getProducts({ vendor: id, limit: SELLER_PRODUCTS_LIMIT }),
    getSellerReviews(id, SELLER_REVIEWS_LIMIT).catch(() => []),
  ]);

  return <SellerProfilePage seller={seller} products={catalog.items} reviews={reviews} />;
}
