import { Box, Container, Stack, Typography } from "@mui/material";

export const metadata = {
  title: "Privacy Policy | Spree",
  description: "Spree's Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: "-0.02em" }}>
            Privacy Policy
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Last updated: {new Date().getFullYear()}
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Spree collects the information you provide when you create an account, place an
          order, or apply to sell — such as your name, email, phone number, shipping address,
          and (for sellers) identity-verification and payout details. We use this information to
          operate the marketplace, process payments, prevent fraud, and communicate with you
          about your orders and account.
        </Typography>
        <Typography variant="body1" color="text.secondary">
          We do not sell your personal information. Sensitive data such as government ID numbers
          and payout details are encrypted at rest. This page is a placeholder summary and will
          be replaced with the full, legally-reviewed Privacy Policy before launch.
        </Typography>
      </Stack>
    </Container>
  );
}
