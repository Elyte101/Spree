import * as React from "react";
import { Box, CircularProgress } from "@mui/material";

import { VerifyContent } from "./verifyContent";

export default function CheckoutVerifyPage() {
  return (
    <React.Suspense
      fallback={
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CircularProgress size={56} thickness={3} />
        </Box>
      }
    >
      <VerifyContent />
    </React.Suspense>
  );
}
