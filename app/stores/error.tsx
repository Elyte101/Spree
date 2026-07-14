'use client';

import { Box, Button, Paper, Stack, Typography } from "@mui/material";

export default function StoresError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <Box sx={{ px: { xs: 1.5, sm: 3, md: 5 }, py: { xs: 3, md: 5 } }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack spacing={2}>
          <Typography variant="h4" sx={{ fontWeight: 900 }}>
            We couldn’t load this store.
          </Typography>
          <Typography variant="body1" color="text.secondary">
            This looks like a temporary problem on our end, not a missing store. Please try again in a moment.
          </Typography>
          <Button
            onClick={reset}
            variant="contained"
            sx={{ alignSelf: "flex-start", borderRadius: 999, textTransform: "none", fontWeight: 900 }}
          >
            Try again
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
