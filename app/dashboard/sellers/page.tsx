import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import {
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

import { authOptions } from "@/lib/auth";
import { getAdminSellers } from "@/lib/serverApi";
import { SellerType } from "@/types/types";

const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(value))
    : "Not started";

const sellerTypeLabels: Record<SellerType, string> = {
  retail: "Retail",
  wholesale: "Wholesale",
};

const formatStoreLocation = (seller: { storeLocation: { city: string; state: string; country: string } }) =>
  [
    seller.storeLocation.city,
    seller.storeLocation.state,
    seller.storeLocation.country,
  ].filter(Boolean).join(", ") || "Not provided";

export default async function DashboardSellersPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/sign-in?callbackUrl=/dashboard/sellers");
  }

  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }

  const sellers = await getAdminSellers();

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
        <Chip label="Admin only" color="secondary" sx={{ mb: 1.5, borderRadius: 999 }} />
        <Typography variant="h4" sx={{ fontWeight: 900 }}>
          Seller management
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
          Review seller health, monitor follower and purchase counts, and jump into individual seller cases.
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
        <Table sx={{ minWidth: 1120 }}>
          <TableHead>
            <TableRow>
              <TableCell>Seller</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Badge</TableCell>
              <TableCell>Followers</TableCell>
              <TableCell>Purchases</TableCell>
              <TableCell>Deliveries</TableCell>
              <TableCell>Started</TableCell>
              <TableCell>Notice</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sellers.map((seller) => (
              <TableRow key={seller.id} hover>
                <TableCell sx={{ minWidth: 280 }}>
                  <Stack spacing={0.5}>
                    <Typography
                      component="a"
                      href={`/dashboard/sellers/${seller.id}`}
                      sx={{
                        color: "text.primary",
                        textDecoration: "none",
                        fontWeight: 900,
                        "&:hover": {
                          color: "primary.main",
                        },
                      }}
                    >
                      {seller.storeName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {seller.name} · {seller.email}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Chip label={seller.sellerStatus} size="small" />
                </TableCell>
                <TableCell>
                  <Chip label={sellerTypeLabels[seller.sellerType]} size="small" variant="outlined" />
                </TableCell>
                <TableCell>{formatStoreLocation(seller)}</TableCell>
                <TableCell>
                  {seller.sellerBadge ? (
                    <Chip label={seller.sellerBadge} size="small" color="success" variant="outlined" />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No badge
                    </Typography>
                  )}
                </TableCell>
                <TableCell>{seller.followerCount}</TableCell>
                <TableCell>{seller.purchaseCount}</TableCell>
                <TableCell>{seller.completedDeliveries}</TableCell>
                <TableCell>{formatDate(seller.startedAt)}</TableCell>
                <TableCell sx={{ minWidth: 240 }}>
                  <Typography variant="body2" color="text.secondary">
                    {seller.sellerNotice || "No active notice"}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}
