import { redirect } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
import { formatPrice } from "@/lib/ghana";

export const metadata: Metadata = {
  title: "Products | Dashboard | Spree",
  description: "Manage your product listings",
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

export default async function DashboardProductsPage() {
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

  const [catalog, overview] = await Promise.all([
    getProducts({ limit: 24, sort: "newest", seller: sellerProfile?.id }),
    isAdmin ? getAdminOverview() : Promise.resolve(null),
  ]);

  const featuredCount = catalog.items.filter((product) =>
    product.tags.includes("featured")
  ).length;
  const saleCount = catalog.items.filter((product) => product.discount > 0).length;
  const outOfStockCount =
    overview?.outOfStockCount ??
    catalog.items.filter((product) => !product.inStock).length;
  const lowStockCount =
    overview?.lowStockCount ??
    catalog.items.filter((product) => product.stock > 0 && product.stock <= 5).length;

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

      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <Table sx={{ minWidth: 940 }}>
          <TableHead>
            <TableRow>
              <TableCell>Product</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Inventory</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Tags</TableCell>
              <TableCell>Created</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {catalog.items.map((product) => (
              <TableRow key={product.id} hover>
                <TableCell sx={{ minWidth: 260 }}>
                  <Stack spacing={0.75}>
                    <Typography
                      component="a"
                      href={`/products/${product.slug}`}
                      sx={{
                        color: "text.primary",
                        textDecoration: "none",
                        fontWeight: 900,
                        "&:hover": {
                          color: "primary.main",
                        },
                      }}
                    >
                      {product.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {product.category} · {product.brand}
                      {product.collection ? ` · ${product.collection}` : ""}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip
                      label={product.inStock ? "In stock" : "Out of stock"}
                      color={product.inStock ? "success" : "default"}
                      size="small"
                    />
                    {product.discount > 0 ? (
                      <Chip label={`${product.discount}% off`} size="small" variant="outlined" />
                    ) : null}
                    {product.badge ? (
                      <Chip label={product.badge} size="small" variant="outlined" />
                    ) : null}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography fontWeight={700}>{product.stock}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {product.variants.length} variant
                    {product.variants.length === 1 ? "" : "s"}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography fontWeight={700}>{formatPrice(product.price)}</Typography>
                  {product.originalPrice ? (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ textDecoration: "line-through" }}
                    >
                      {formatPrice(product.originalPrice)}
                    </Typography>
                  ) : null}
                </TableCell>
                <TableCell sx={{ minWidth: 200 }}>
                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                    {product.tags.length ? (
                      product.tags.slice(0, 3).map((tag) => (
                        <Chip key={tag} label={tag} size="small" variant="outlined" />
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No tags yet
                      </Typography>
                    )}
                  </Stack>
                </TableCell>
                <TableCell>{formatDate(product.createdAt)}</TableCell>
              </TableRow>
            ))}
            {catalog.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Stack spacing={1.5} alignItems="flex-start" sx={{ py: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                      No products yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Add your first product to start shaping the catalog and merchandising your storefront.
                    </Typography>
                    <Button
                      href="/dashboard/products/new"
                      variant="contained"
                      sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
                    >
                      Create your first product
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}
