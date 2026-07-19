'use client';

import NextLink from "next/link";
import { VerifiedRounded } from "@mui/icons-material";
import {
  Avatar,
  Box,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { ProductCard } from "@/components/product/productCard";
import { StarRating } from "@/components/ui/starRating";
import { Product, SellerReview, SellerSummary } from "@/types/types";

interface SellerProfilePageProps {
  seller: SellerSummary;
  products: Product[];
  reviews: SellerReview[];
}

const sellerTypeLabels: Record<SellerSummary["sellerType"], string> = {
  retail: "Retail vendor",
  wholesale: "Wholesale vendor",
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(value));

const formatReviewDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(value)
  );

export function SellerProfilePage({ seller, products, reviews }: SellerProfilePageProps) {
  const locationParts = [seller.storeLocation.city, seller.storeLocation.state, seller.storeLocation.country]
    .filter(Boolean);

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 3, md: 4 } }}>
      <Stack spacing={4}>
        {/* ── Header ── */}
        <Paper
          elevation={0}
          sx={{ p: { xs: 2.5, md: 4 }, borderRadius: 3, border: "1px solid", borderColor: "divider" }}
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5} alignItems={{ xs: "flex-start", sm: "center" }}>
            {/* No dedicated store logo/avatar field on sellers yet — initials
                stand in, same fallback pattern Avatar uses elsewhere. */}
            <Avatar sx={{ width: 72, height: 72, fontSize: "1.75rem", fontWeight: 800, bgcolor: "primary.main" }}>
              {(seller.storeName || seller.name).charAt(0).toUpperCase()}
            </Avatar>

            <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="h4" sx={{ fontWeight: 900 }}>
                  {seller.storeName}
                </Typography>
                {seller.governmentIdVerified && (
                  <Stack direction="row" spacing={0.25} alignItems="center">
                    <VerifiedRounded sx={{ fontSize: 20, color: "success.main" }} />
                    <Typography variant="body2" color="success.main" fontWeight={700}>
                      Verified
                    </Typography>
                  </Stack>
                )}
                {seller.sellerBadge && (
                  <Chip label={seller.sellerBadge} color="success" size="small" variant="outlined" />
                )}
              </Stack>

              {seller.storeTagline && (
                <Typography variant="body1" color="text.secondary">
                  {seller.storeTagline}
                </Typography>
              )}

              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" sx={{ rowGap: 0.5 }}>
                {seller.sellerReviewsCount > 0 ? (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <StarRating value={seller.sellerRating} size={16} />
                    <Typography variant="body2" fontWeight={700}>
                      {seller.sellerRating.toFixed(1)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      ({seller.sellerReviewsCount} review{seller.sellerReviewsCount === 1 ? "" : "s"})
                    </Typography>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.disabled" fontStyle="italic">
                    No reviews yet
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary">
                  {sellerTypeLabels[seller.sellerType]}
                </Typography>
                {seller.startedAt && (
                  <Typography variant="body2" color="text.secondary">
                    Member since {formatDate(seller.startedAt)}
                  </Typography>
                )}
                {locationParts.length > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    {locationParts.join(", ")}
                  </Typography>
                )}
              </Stack>

              {seller.storeDescription && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {seller.storeDescription}
                </Typography>
              )}
            </Stack>
          </Stack>
        </Paper>

        {/* ── Products ── */}
        <Stack spacing={2}>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Products ({products.length})
          </Typography>
          {products.length > 0 ? (
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              }}
            >
              {products.map((product) => (
                <ProductCard key={product.id} product={product} size="micro" />
              ))}
            </Box>
          ) : (
            <Paper elevation={0} sx={{ p: 4, textAlign: "center", borderRadius: 2, bgcolor: "action.hover" }}>
              <Typography color="text.secondary">This seller has no active products right now.</Typography>
            </Paper>
          )}
        </Stack>

        <Divider />

        {/* ── Recent reviews ── */}
        <Stack spacing={2}>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Recent reviews
          </Typography>
          {reviews.length > 0 ? (
            <Stack spacing={2}>
              {reviews.map((review) => (
                <Paper
                  key={review.id}
                  elevation={0}
                  sx={{ p: 2.5, borderRadius: 2, border: "1px solid", borderColor: "divider" }}
                >
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" useFlexGap>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar sx={{ width: 32, height: 32, fontSize: "0.875rem" }}>
                          {review.authorName.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={700}>
                            {review.authorName}
                          </Typography>
                          {review.rating !== null && <StarRating value={review.rating} size={13} />}
                        </Box>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {formatReviewDate(review.createdAt)}
                      </Typography>
                    </Stack>
                    <Typography variant="body2">{review.body}</Typography>
                    <Typography
                      component={NextLink}
                      href={`/products/${review.productSlug}`}
                      variant="caption"
                      color="primary.main"
                      sx={{ textDecoration: "none", "&:hover": { textDecoration: "underline" }, width: "fit-content" }}
                    >
                      On {review.productName}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Paper elevation={0} sx={{ p: 4, textAlign: "center", borderRadius: 2, bgcolor: "action.hover" }}>
              <Typography color="text.secondary">No reviews yet for this seller&apos;s products.</Typography>
            </Paper>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
