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

import type { Metadata } from "next";
import { auth } from "@/auth";
import { canCreateProductsRole } from "@/lib/roles";
import {
  BACKEND_UNAVAILABLE_MESSAGE,
  getAdminOverview,
  getProducts,
  getUserProfile,
} from "@/lib/serverApi";
import { ProductsTable } from "./_components/ProductsTable";

export const metadata: Metadata = {
  title: "Products | Dashboard | Spree",
  description: "Manage your product listings",
};

interface PageProps {
  searchParams: Promise<{ filter?: string }>;
}

export default async function DashboardProductsPage({ searchParams }: PageProps) {
  const session = await auth();
  const callbackUrl = "/dashboard/products";

  if (!session) {
    redirect(`/auth/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  if (!canCreateProductsRole(session.user.role)) {
    redirect("/dashboard");
  }

  const isAdmin = session.user.role === "admin";
  const sellerProfile = isAdmin
    ? null
    : await getUserProfile(session.user.id, {
        name: session.user.name ?? undefined,
        email: session.user.email ?? undefined,
        role: session.user.role,
      });

  if (sellerProfile && sellerProfile.sellerStatus !== "active") {
    redirect("/profile");
  }

  const { filter = "all" } = await searchParams;

  const [catalog, overview] = await Promise.all([
    getProducts(
      {
        limit: 48,
        sort: "newest",
        vendor: sellerProfile?.id,
        includeBlacklisted: isAdmin,
      },
      session.user.id
    ),
    isAdmin ? getAdminOverview(session.user.id) : Promise.resolve(null),
  ]);

  const featuredCount = catalog.items.filter((p) => p.tags.includes("featured")).length;
  const saleCount = catalog.items.filter((p) => p.discount > 0).length;
  const outOfStockCount = overview?.outOfStockCount ?? catalog.items.filter((p) => !p.inStock).length;
  const lowStockCount =
    overview?.lowStockCount ??
    catalog.items.filter((p) => p.stock > 0 && p.stock <= 5).length;

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
          <Box>
            <Chip
              label="Catalog workspace"
              color="secondary"
              sx={{ mb: 1.5, borderRadius: 999 }}
            />
            <Typography variant="h4" sx={{ fontWeight: 900 }}>
              {isAdmin ? "Products" : "Your products"}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              {isAdmin
                ? "Review the latest catalog entries, spot stock risks, and jump straight into product creation."
                : "Manage the products attached to your approved storefront."}
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              href="/dashboard/products/new"
              variant="contained"
              sx={{ borderRadius: 999, px: 2, textTransform: "none", fontWeight: 900, whiteSpace: "nowrap" }}
            >
              Create product
            </Button>
            <Button
              href={sellerProfile?.storeSlug ? `/stores/${sellerProfile.storeSlug}` : "/products"}
              variant="outlined"
              sx={{ borderRadius: 999, px: 2, textTransform: "none", fontWeight: 900, whiteSpace: "nowrap" }}
            >
              Open storefront
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {isAdmin && !overview ? (
        <Alert severity="warning" sx={{ borderRadius: 3 }}>
          {BACKEND_UNAVAILABLE_MESSAGE}
        </Alert>
      ) : null}

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
          { label: "Products", value: overview?.productCount ?? catalog.total, tone: "primary" },
          { label: "Featured now", value: featuredCount, tone: "secondary" },
          { label: "On sale", value: saleCount, tone: "warning" },
          { label: "Stock risks", value: lowStockCount + outOfStockCount, tone: "info" },
        ].map((item) => (
          <Paper
            key={item.label}
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              backgroundColor: item.tone === "primary" ? "action.hover" : "background.paper",
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

      <ProductsTable
        products={catalog.items}
        filter={filter}
        role={session.user.role}
        userId={session.user.id}
      />
    </Stack>
  );
}
