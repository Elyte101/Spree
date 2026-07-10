import { Box, Container, Stack, Typography } from "@mui/material";

export const metadata = {
  title: "Terms of Service | Spree",
  description: "Spree's Terms of Service",
};

export default function TermsPage() {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: "-0.02em" }}>
            Terms of Service
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Last updated: {new Date().getFullYear()}
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          By creating an account or using Spree, you agree to shop and sell in good faith,
          provide accurate information, and comply with applicable Ghanaian consumer-protection
          and e-commerce law. Sellers are responsible for the accuracy of their listings and for
          fulfilling orders in a timely manner. Buyers are responsible for providing accurate
          delivery details and for reviewing an order before confirming receipt.
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Spree may suspend or remove accounts that violate these terms, engage in fraud, or
          otherwise abuse the platform. This page is a placeholder summary and will be replaced
          with the full, legally-reviewed Terms of Service before launch.
        </Typography>
      </Stack>
    </Container>
  );
}
