'use client';

import Link from "next/link";
import { CheckCircleRounded, EastRounded } from "@mui/icons-material";
import { alpha, Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";

export default function CheckoutSuccessPage() {
  return (
    <Box
      sx={(theme) => ({
        minHeight: "790px",
        px: { xs: 2, sm: 3, md: 5 },
        py: { xs: 3, md: 5 },
        display: "grid",
        placeItems: "center",
        background: `radial-gradient(circle at top left, ${alpha(
          theme.palette.primary.main,
          theme.palette.mode === "dark" ? 0.16 : 0.08
        )}, transparent 24%), linear-gradient(180deg, ${
          theme.palette.background.default
        } 0%, ${theme.palette.background.paper} 100%)`,
      })}
    >
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 720,
          p: { xs: 3, md: 5 },
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          textAlign: "center",
        }}
      >
        <Stack spacing={2.5} alignItems="center">
          <Chip icon={<CheckCircleRounded />} label="Order Confirmed" color="success" />
          <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1 }}>
            Your order has been placed.
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 520 }}>
            You’ll typically show tracking details, delivery estimates, and next steps here after checkout.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              component={Link}
              href="/products"
              variant="contained"
              endIcon={<EastRounded />}
              sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
            >
              Continue shopping
            </Button>
            <Button
              component={Link}
              href="/notifications"
              variant="outlined"
              sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
            >
              View updates
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
