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
import { canCreateProductsRole } from "@/lib/roles";
import {
  BACKEND_UNAVAILABLE_MESSAGE,
  getAdminOverview,
  getProducts,
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
  const [overview, catalog] = await Promise.all([
    isAdmin ? getAdminOverview() : Promise.resolve(null),
    canCreateProducts ? getProducts({ limit: 6, sort: "newest" }) : Promise.resolve(null),
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
          borderRadius: 4,
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
              label={canCreateProducts ? "Merchant overview" : "Account overview"}
              color="primary"
              sx={{ mb: 1.5, borderRadius: 999 }}
            />
            <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1 }}>
              Welcome back, {firstName}.
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              {canCreateProducts
                ? "Check the pulse of your catalog, keep merchandising sharp, and move quickly on the next product update."
                : "Your account is ready. Keep your profile and shopping preferences up to date here."}
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              href={canCreateProducts ? "/dashboard/products/new" : "/profile"}
              variant="contained"
              sx={{ borderRadius: 999, px: 3, textTransform: "none", fontWeight: 800 }}
            >
              {canCreateProducts ? "Create product" : "Open profile"}
            </Button>
            <Button
              href="/products"
              variant="outlined"
              sx={{ borderRadius: 999, px: 3, textTransform: "none", fontWeight: 800 }}
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

      {canCreateProducts ? (
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
              { label: "Categories", value: overview?.categoryCount ?? "Live catalog" },
              { label: "Collections", value: overview?.collectionCount ?? "Curated" },
              { label: "Avg. rating", value: overview?.averageRating ?? "Growing" },
            ].map((item) => (
              <Paper
                key={item.label}
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: 3,
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
                borderRadius: 4,
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
                    sx={{ alignSelf: "flex-start", textTransform: "none", fontWeight: 800 }}
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
                          borderRadius: 3,
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
                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
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
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 3, md: 4 },
                  borderRadius: 4,
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Stack spacing={2}>
                  <Typography variant="h5" sx={{ fontWeight: 900 }}>
                    Focus today
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    A Shopify-like admin works best when your next actions are obvious.
                  </Typography>
                  <Stack spacing={1.25}>
                    <Typography variant="body2">
                      1. Review your newest products and make sure the copy, pricing, and imagery feel consistent.
                    </Typography>
                    <Typography variant="body2">
                      2. Keep inventory healthy so out-of-stock and low-stock items do not break the storefront story.
                    </Typography>
                    <Typography variant="body2">
                      3. Use tags like `featured` and `new` to control what deserves attention first.
                    </Typography>
                  </Stack>
                </Stack>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: { xs: 3, md: 4 },
                  borderRadius: 4,
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Stack spacing={1.5}>
                  <Typography variant="h5" sx={{ fontWeight: 900 }}>
                    Account snapshot
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Name: {userName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Email: {userEmail}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Role: {session.user.role}
                  </Typography>
                </Stack>
              </Paper>
            </Stack>
          </Box>
        </>
      ) : (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: 4,
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
            sx={{ mt: 2, borderRadius: 999, textTransform: "none", fontWeight: 800 }}
          >
            Open profile
          </Button>
        </Paper>
      )}
    </Stack>
  );
}
