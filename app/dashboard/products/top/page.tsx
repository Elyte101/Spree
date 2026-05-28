import { redirect } from "next/navigation";
import {
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

import { auth } from "@/auth";
import { getAdminTopProducts } from "@/lib/serverApi";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);

interface TopProductsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function TopProductsPage({ searchParams }: TopProductsPageProps) {
  const session = await auth();

  if (!session) {
    redirect("/auth/sign-in?callbackUrl=/dashboard/products/top");
  }

  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }

  const { page } = await searchParams;
  const currentPage = Math.max(1, Number(page ?? "1") || 1);
  const ranked = await getAdminTopProducts(currentPage, 100);

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
        <Chip label="Admin ranking" color="secondary" sx={{ mb: 1.5, borderRadius: 999 }} />
        <Typography variant="h4" sx={{ fontWeight: 900 }}>
          Top 500 most buyable products
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
          Ranked in batches of 100 using recorded purchase activity, review depth, rating, and recency.
        </Typography>
      </Paper>

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
        <Table sx={{ minWidth: 900 }}>
          <TableHead>
            <TableRow>
              <TableCell>Rank</TableCell>
              <TableCell>Product</TableCell>
              <TableCell>Seller</TableCell>
              <TableCell>Purchases</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Stock</TableCell>
              <TableCell>Rating</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {ranked.items.map((product, index) => (
              <TableRow key={product.id} hover>
                <TableCell>{(ranked.page - 1) * ranked.limit + index + 1}</TableCell>
                <TableCell sx={{ minWidth: 260 }}>
                  <Stack spacing={0.5}>
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
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell>
                  {product.storeSlug ? (
                    <Typography
                      component="a"
                      href={`/stores/${product.storeSlug}`}
                      sx={{
                        color: "text.primary",
                        textDecoration: "none",
                        "&:hover": {
                          color: "primary.main",
                        },
                      }}
                    >
                      {product.storeName ?? product.sellerName ?? "Marketplace seller"}
                    </Typography>
                  ) : (
                    product.storeName ?? product.sellerName ?? "Marketplace seller"
                  )}
                </TableCell>
                <TableCell>{product.purchaseCount}</TableCell>
                <TableCell>{formatPrice(product.price)}</TableCell>
                <TableCell>{product.stock}</TableCell>
                <TableCell>{product.rating.toFixed(1)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
        <Button
          href={`/dashboard/products/top?page=${Math.max(1, currentPage - 1)}`}
          variant="outlined"
          disabled={currentPage <= 1}
          sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
        >
          Previous 100
        </Button>
        <Button
          href={`/dashboard/products/top?page=${Math.min(ranked.totalPages, currentPage + 1)}`}
          variant="contained"
          disabled={currentPage >= ranked.totalPages}
          sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
        >
          Next 100
        </Button>
        <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
          Page {ranked.page} of {Math.max(1, ranked.totalPages)}
        </Typography>
      </Stack>
    </Stack>
  );
}
