import { redirect } from "next/navigation";
import { Chip, Paper, Stack, Typography } from "@mui/material";

import type { Metadata } from "next";
import { auth } from "@/auth";
import { getAdminSellers } from "@/lib/serverApi";
import { SellersTable } from "./_components/SellersTable";

export const metadata: Metadata = {
  title: "Sellers | Dashboard | Spree",
  description: "Manage vendor accounts",
};

interface PageProps {
  searchParams: Promise<{ filter?: string }>;
}

export default async function DashboardSellersPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session) {
    redirect("/auth/sign-in?callbackUrl=/dashboard/sellers");
  }

  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }

  const { filter = "all" } = await searchParams;
  const validFilter = ["all", "blacklisted", "inactive"].includes(filter)
    ? (filter as "all" | "blacklisted" | "inactive")
    : "all";

  const sellers = await getAdminSellers(validFilter);

  return (
    <Stack spacing={3}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 2.5 },
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Chip label="Admin only" color="secondary" sx={{ mb: 1.5, borderRadius: 999 }} />
        <Typography variant="h4" sx={{ fontWeight: 900 }}>
          vendor management
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
          Review vendor health, monitor follower and purchase counts, and jump into individual vendor
          cases.
        </Typography>
      </Paper>

      <SellersTable sellers={sellers} filter={validFilter} />
    </Stack>
  );
}
