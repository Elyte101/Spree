/**
 * Builds the public storefront link for a product's seller.
 *
 * storeSlug is the ONLY valid /stores/[id] identifier here — the backend
 * resolves that route by store slug (or store name), and a seller with no
 * store record has neither. Falling back to a raw sellerId/user id looks
 * plausible (the route also accepts a user id) but 404s for any vendor who
 * hasn't been given a storeSlug, which includes the seed admin account used
 * to author demo/test products. Never add that fallback back in.
 */
export function getSellerStoreHref(product: { storeSlug?: string | null }): string | null {
  return product.storeSlug ? `/stores/${product.storeSlug}` : null;
}
