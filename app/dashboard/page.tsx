import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { authOptions } from "@/lib/auth";
import { ResponsiveDisclosurePanel } from "@/components/ui/responsiveDisclosurePanel";
import { canCreateProductsRole } from "@/lib/roles";
import {
  BACKEND_UNAVAILABLE_MESSAGE,
  getAdminOverview,
  getProducts,
  getUserProfile,
} from "@/lib/serverApi";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

export default async function Dashboard() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/sign-in?callbackUrl=/dashboard");
  }

  const isAdmin = session.user.role === "admin";
  const canCreateProducts = canCreateProductsRole(session.user.role);
  const userName = session.user.name ?? "Spree user";
  const userEmail = session.user.email ?? "Not available";
  const sellerProfile =
    canCreateProducts && !isAdmin
      ? await getUserProfile(session.user.id, {
          name: session.user.name ?? undefined,
          email: session.user.email ?? undefined,
          role: session.user.role,
        })
      : null;
  const canManageProducts = isAdmin || sellerProfile?.sellerStatus === "active";
  const [overview, catalog] = await Promise.all([
    isAdmin ? getAdminOverview() : Promise.resolve(null),
    canManageProducts
      ? getProducts({ limit: 6, sort: "newest", seller: sellerProfile?.id })
      : Promise.resolve(null),
  ]);
  const firstName = userName.split(" ")[0] ?? userName;
  const recentProducts =
    overview?.recentProducts ??
    catalog?.items.map((product) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      stock: product.stock,
      createdAt: product.createdAt,
    })) ??
    [];
  const productCount = overview?.productCount ?? catalog?.total ?? 0;

  return (
    <Stack spacing={3}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={2.5}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", lg: "center" }}
        >
          <Box sx={{ maxWidth: 720 }}>
            <Chip
              label={canManageProducts ? "Merchant overview" : "Account overview"}
              color="primary"
              sx={{ mb: 1.5, borderRadius: 999 }}
            />
            <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1 }}>
              Welcome back, {firstName}.
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              {canManageProducts
                ? "Check the pulse of your catalog, keep merchandising sharp, and move quickly on the next product update."
                : "Your account is ready. Keep your profile and shopping preferences up to date here."}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.5}>
            <Button
              href={canManageProducts ? "/dashboard/products/new" : "/profile"}
              variant="contained"
              sx={{ borderRadius: 999, px: 2, textTransform: "none", fontWeight: 900, whiteSpace: "nowrap" }}
            >
              {canManageProducts ? "Create product" : "Open profile"}
            </Button>
            <Button
              href="/products"
              variant="outlined"
              sx={{ borderRadius: 999, px: 2, textTransform: "none", fontWeight: 900, whiteSpace: "nowrap" }}
            >
              View storefront
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {isAdmin && !overview ? (
        <Alert severity="warning" sx={{ borderRadius: 3 }}>
          {BACKEND_UNAVAILABLE_MESSAGE}
        </Alert>
      ) : null}

      {canManageProducts ? (
        <>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
                xl: "repeat(4, minmax(0, 1fr))",
              },
            }}
          >
            {[
              { label: "Products", value: productCount },
              {
                label: isAdmin ? "Sellers" : "Categories",
                value: isAdmin ? overview?.sellerCount ?? 0 : overview?.categoryCount ?? "Live catalog",
              },
              {
                label: isAdmin ? "Active sellers" : "Collections",
                value: isAdmin ? overview?.activeSellerCount ?? 0 : overview?.collectionCount ?? "Curated",
              },
              {
                label: isAdmin ? "Open reports" : "Avg. rating",
                value: isAdmin ? overview?.openSellerReportCount ?? 0 : overview?.averageRating ?? "Growing",
              },
            ].map((item) => (
              <Paper
                key={item.label}
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {item.label}
                </Typography>
                <Typography variant="h4" sx={{ mt: 0.75, fontWeight: 900 }}>
                  {item.value}
                </Typography>
              </Paper>
            ))}
          </Box>

          <Box
            sx={{
              display: "grid",
              gap: 3,
              gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1.45fr) minmax(320px, 0.9fr)" },
            }}
          >
            <Paper
              elevation={0}
              sx={{
                p: { xs: 3, md: 4 },
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack spacing={2.5}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  justifyContent="space-between"
                  spacing={1.5}
                >
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 900 }}>
                      Recent catalog activity
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Your newest additions and the items worth checking first.
                    </Typography>
                  </Box>
                  <Button
                    href="/dashboard/products"
                    variant="text"
                    sx={{ alignSelf: "flex-start", textTransform: "none", fontWeight: 900 }}
                  >
                    Open product workspace
                  </Button>
                </Stack>

                <Stack spacing={1.5}>
                  {recentProducts.length ? (
                    recentProducts.map((product) => (
                      <Paper
                        key={product.id}
                        elevation={0}
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          justifyContent="space-between"
                          spacing={1.5}
                        >
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                              {product.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {product.slug} · Added {formatDate(product.createdAt)}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                            <Chip label={`Stock ${product.stock}`} size="small" />
                            <Chip
                              label={formatPrice(product.price)}
                              size="small"
                              variant="outlined"
                            />
                          </Stack>
                        </Stack>
                      </Paper>
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Products will appear here as soon as you add them.
                    </Typography>
                  )}
                </Stack>
              </Stack>
            </Paper>

            <Stack spacing={3}>
              <ResponsiveDisclosurePanel
                title="Focus today"
                titleVariant="h5"
                collapseBelow="xl"
                paperSx={{ p: { xs: 2, sm: 2.5, md: 4 } }}
              >
                <Stack spacing={2}>
                  <Typography variant="body2" color="text.secondary">
                    A Spree admin works best when your next actions are obvious.
                  </Typography>
                  <Stack spacing={1.25}>
                    <Typography variant="body2">
                      1. Review your newest products and make sure the copy, pricing, and imagery feel consistent.
                    </Typography>
                    <Typography variant="body2">
                      2. Keep inventory healthy so out-of-stock and low-stock items do not break the storefront story.
                    </Typography>
                    <Typography variant="body2">
                      3. Watch seller reports, follower growth, and top products so marketplace trust stays strong.
                    </Typography>
                  </Stack>
                </Stack>
              </ResponsiveDisclosurePanel>

              <ResponsiveDisclosurePanel
                title="Account snapshot"
                titleVariant="h5"
                collapseBelow="xl"
                paperSx={{ p: { xs: 2, sm: 2.5, md: 4 } }}
              >
                <Stack spacing={1.5}>
                  <Typography variant="body2" color="text.secondary">
                    Name: {userName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Email: {userEmail}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Role: {session.user.role}
                  </Typography>
                  {sellerProfile ? (
                    <>
                      <Typography variant="body2" color="text.secondary">
                        Seller status: {sellerProfile.sellerStatus}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Seller badge: {sellerProfile.sellerBadge || "Not assigned"}
                      </Typography>
                    </>
                  ) : null}
                  {isAdmin ? (
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ pt: 1 }}>
                      <Button
                        href="/dashboard/sellers"
                        variant="outlined"
                        sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
                      >
                        Manage sellers
                      </Button>
                      <Button
                        href="/dashboard/products/top"
                        variant="contained"
                        sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
                      >
                        Review top products
                      </Button>
                    </Stack>
                  ) : null}
                </Stack>
              </ResponsiveDisclosurePanel>
            </Stack>
          </Box>
        </>
      ) : (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>
            Account dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Keep your profile, shipping details, and payment preferences current so checkout stays smooth.
          </Typography>
          <Button
            href="/profile"
            variant="outlined"
            sx={{ mt: 2, borderRadius: 999, textTransform: "none", fontWeight: 900 }}
          >
            Open profile
          </Button>
        </Paper>
      )}
    </Stack>
  );
}
