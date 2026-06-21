'use client';

import * as React from "react";
import {
  Alert,
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  AccessTimeRounded,
  PersonRounded,
  VerifiedRounded,
} from "@mui/icons-material";

import { api, ApiClientError } from "@/lib/api";
import type { VerificationQueueItem } from "@/types/types";
import { VerificationDetail } from "./VerificationDetail";

export function VerificationQueue() {
  const [items, setItems] = React.useState<VerificationQueueItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<VerificationQueueItem | null>(null);

  React.useEffect(() => {
    api.getVerificationQueue()
      .then(setItems)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load queue"))
      .finally(() => setLoading(false));
  }, []);

  function handleDecision(id: string, _approved: boolean) {
    setItems((prev) => prev.filter((item) => item.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" pt={8}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ pt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box mb={4}>
        <Typography variant="h5" fontWeight={700}>
          seller verification
        </Typography>
        <Typography color="text.secondary">
          {items.length} application{items.length !== 1 ? "s" : ""} pending review
        </Typography>
      </Box>

      {items.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 6, textAlign: "center", borderRadius: 3 }}>
          <VerifiedRounded sx={{ fontSize: 48, color: "success.main", mb: 2 }} />
          <Typography variant="h6" fontWeight={600}>All caught up!</Typography>
          <Typography color="text.secondary">No pending seller applications.</Typography>
        </Paper>
      ) : (
        <Box
          display="grid"
          gridTemplateColumns={{ xs: "1fr", lg: selected ? "360px 1fr" : "1fr" }}
          gap={3}
          alignItems="start"
        >
          {/* Queue list */}
          <Stack spacing={1.5}>
            {items.map((item) => (
              <QueueCard
                key={item.id}
                item={item}
                selected={selected?.id === item.id}
                onClick={() => setSelected(item)}
              />
            ))}
          </Stack>

          {/* Detail panel */}
          {selected && (
            <VerificationDetail
              seller={selected}
              onDecision={handleDecision}
              onClose={() => setSelected(null)}
            />
          )}
        </Box>
      )}
    </Container>
  );
}

function QueueCard({
  item,
  selected,
  onClick,
}: {
  item: VerificationQueueItem;
  selected: boolean;
  onClick: () => void;
}) {
  const location = [item.storeLocation?.city, item.storeLocation?.state]
    .filter(Boolean)
    .join(", ");

  const submittedAt = item.startedAt
    ? new Intl.DateTimeFormat("en-GH", { dateStyle: "medium" }).format(new Date(item.startedAt))
    : null;

  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        p: 2.5,
        borderRadius: 2.5,
        cursor: "pointer",
        border: "1.5px solid",
        borderColor: selected ? "primary.main" : "divider",
        bgcolor: selected ? "primary.50" : "background.paper",
        transition: "border-color 0.15s, background-color 0.15s",
        "&:hover": { borderColor: "primary.main" },
      }}
    >
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <Avatar sx={{ bgcolor: "primary.main", width: 44, height: 44 }}>
          {item.name?.[0]?.toUpperCase() || <PersonRounded />}
        </Avatar>
        <Box flex={1} minWidth={0}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Typography fontWeight={600} noWrap>{item.name}</Typography>
            <Chip
              label={item.sellerStatus?.replace(/_/g, " ")}
              size="small"
              color="warning"
              sx={{ ml: 1, flexShrink: 0 }}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary" noWrap>
            {item.storeName || "No store name"} {location ? `· ${location}` : ""}
          </Typography>
          {submittedAt && (
            <Stack direction="row" alignItems="center" gap={0.5} mt={0.5}>
              <AccessTimeRounded sx={{ fontSize: 12, color: "text.disabled" }} />
              <Typography variant="caption" color="text.disabled">
                Applied {submittedAt}
              </Typography>
            </Stack>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}
