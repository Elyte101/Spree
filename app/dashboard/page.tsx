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
import { BACKEND_UNAVAILABLE_MESSAGE, getAdminOverview } from "@/lib/serverApi";
import { ThemedPageShell } from "@/components/ui/themedPageShell";

export default async function Dashboard() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/sign-in?callbackUrl=/dashboard");
  }

  const isAdmin = session.user.role === "admin";
  const canCreateProducts = canCreateProductsRole(session.user.role);
  const overview = isAdmin ? await getAdminOverview() : null;

  return (
    <ThemedPageShell>
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
            <Chip label="Signed in" color="primary" sx={{ width: "fit-content", borderRadius: 999 }} />
            <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1 }}>
              Welcome to the Spree dashboard.
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Keep your account details, shop information, and product tools in one place.
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body1">
                <strong>Name:</strong> {session.user.name}
              </Typography>
              <Typography variant="body1">
                <strong>Email:</strong> {session.user.email}
              </Typography>
              <Typography variant="body1">
                <strong>Account type:</strong> {session.user.role}
              </Typography>
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
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                spacing={2}
                alignItems={{ xs: "flex-start", md: "center" }}
              >
                <Box>
                  <Chip
                    label={isAdmin ? "Store overview" : "Shop tools"}
                    color="secondary"
                    sx={{ mb: 1.5, borderRadius: 999 }}
                  />
                  <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1 }}>
                    {isAdmin ? "See how your shop is doing" : "Your shop is ready for new items"}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                    {isAdmin
                      ? "View a quick summary of your products, collections, and shoppers."
                      : "Add products and keep your shop fresh whenever you're ready."}
                  </Typography>
                </Box>
                <Button
                  href="/dashboard/products/new"
                  variant="contained"
                  sx={{ borderRadius: 999, px: 3, textTransform: "none", fontWeight: 800 }}
                >
                  Create product
                </Button>
              </Stack>
            </Paper>

            {isAdmin && overview ? (
              <>
                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "repeat(4, minmax(0, 1fr))",
                    },
                  }}
                >
                  {[
                    { label: "Products", value: overview.productCount },
                    { label: "Categories", value: overview.categoryCount },
                    { label: "Brands", value: overview.brandCount },
                    { label: "Users", value: overview.userCount },
                    { label: "Collections", value: overview.collectionCount },
                    { label: "Low stock", value: overview.lowStockCount },
                    { label: "Out of stock", value: overview.outOfStockCount },
                    { label: "Avg. rating", value: overview.averageRating },
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
                      <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.75 }}>
                        {item.value}
                      </Typography>
                    </Paper>
                  ))}
                </Box>

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
                      Recently created products
                    </Typography>
                    <Stack spacing={1.5}>
                      {overview.recentProducts.map((product) => (
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
                            spacing={1}
                          >
                            <Box>
                              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                {product.name}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {product.slug}
                              </Typography>
                            </Box>
                            <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap">
                              <Chip label={`Stock ${product.stock}`} size="small" />
                              <Chip label={`$${product.price}`} size="small" variant="outlined" />
                            </Stack>
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  </Stack>
                </Paper>
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
                  Ready to add something new?
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Your shop is set up. Start adding items whenever you&apos;re ready.
                </Typography>
              </Paper>
            )}
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
              {isAdmin ? "Shop details are limited right now" : "Account dashboard"}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Your account is ready. Visit your profile when you want to set up shop details and add products.
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
    </ThemedPageShell>
  );
}
