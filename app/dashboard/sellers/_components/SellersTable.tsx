"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from "@mui/material";

import { api, ApiClientError } from "@/lib/api";
import { SellerSummary, SellerType } from "@/types/types";

interface SellersTableProps {
  sellers: SellerSummary[];
  filter: string;
}

type FilterTab = "all" | "blacklisted" | "inactive";

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "blacklisted", label: "Blacklisted" },
  { value: "inactive", label: "Inactive (3+ months)" },
];

const sellerTypeLabels: Record<SellerType, string> = {
  retail: "Retail",
  wholesale: "Wholesale",
};

const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(value))
    : "Not started";

const formatStoreLocation = (seller: SellerSummary) =>
  [seller.storeLocation.city, seller.storeLocation.state, seller.storeLocation.country]
    .filter(Boolean)
    .join(", ") || "Not provided";

export function SellersTable({ sellers, filter }: SellersTableProps) {
  const router = useRouter();
  const currentFilter = (FILTER_TABS.some((t) => t.value === filter) ? filter : "all") as FilterTab;

  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [activeSellerId, setActiveSellerId] = React.useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = React.useState<SellerSummary | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState("");

  const [blacklistTarget, setBlacklistTarget] = React.useState<SellerSummary | null>(null);
  const [blacklisting, setBlacklisting] = React.useState(false);
  const [blacklistError, setBlacklistError] = React.useState("");

  const openMenu = (event: React.MouseEvent<HTMLElement>, sellerId: string) => {
    setMenuAnchor(event.currentTarget);
    setActiveSellerId(sellerId);
  };

  const closeMenu = () => {
    setMenuAnchor(null);
    setActiveSellerId(null);
  };

  const activeSeller = activeSellerId ? sellers.find((s) => s.id === activeSellerId) : null;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await api.deleteAdminSeller(deleteTarget.id);
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof ApiClientError ? err.message : "Failed to delete seller.");
    } finally {
      setDeleting(false);
    }
  };

  const handleBlacklist = async () => {
    if (!blacklistTarget) return;
    setBlacklisting(true);
    setBlacklistError("");
    try {
      await api.blacklistAdminSeller(blacklistTarget.id, !blacklistTarget.isBlacklisted);
      setBlacklistTarget(null);
      router.refresh();
    } catch (err) {
      setBlacklistError(
        err instanceof ApiClientError ? err.message : "Failed to update blacklist status."
      );
    } finally {
      setBlacklisting(false);
    }
  };

  return (
    <>
      <Tabs
        value={currentFilter}
        sx={{ borderBottom: 1, borderColor: "divider" }}
        textColor="primary"
        indicatorColor="primary"
      >
        {FILTER_TABS.map((tab) => (
          <Tab
            key={tab.value}
            label={tab.label}
            value={tab.value}
            component={Link}
            href={`?filter=${tab.value}`}
            sx={{ textTransform: "none", fontWeight: 700 }}
          />
        ))}
      </Tabs>

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
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sellers.map((seller) => (
              <TableRow
                key={seller.id}
                hover
                sx={seller.isBlacklisted ? { opacity: 0.6, bgcolor: "action.hover" } : undefined}
              >
                <TableCell sx={{ minWidth: 280 }}>
                  <Stack spacing={0.5}>
                    <Typography
                      component="a"
                      href={`/dashboard/sellers/${seller.id}`}
                      sx={{
                        color: "text.primary",
                        textDecoration: "none",
                        fontWeight: 900,
                        "&:hover": { color: "primary.main" },
                      }}
                    >
                      {seller.storeName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {seller.name} · {seller.email}
                    </Typography>
                    {seller.isBlacklisted ? (
                      <Chip label="Blacklisted" color="error" size="small" sx={{ width: "fit-content" }} />
                    ) : null}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Chip label={seller.sellerStatus} size="small" />
                </TableCell>
                <TableCell>
                  <Chip
                    label={sellerTypeLabels[seller.sellerType]}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>{formatStoreLocation(seller)}</TableCell>
                <TableCell>
                  {seller.sellerBadge ? (
                    <Chip
                      label={seller.sellerBadge}
                      size="small"
                      color="success"
                      variant="outlined"
                    />
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
                <TableCell sx={{ minWidth: 200 }}>
                  <Typography variant="body2" color="text.secondary">
                    {seller.sellerNotice || "No active notice"}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={(e) => openMenu(e, seller.id)}
                    aria-label={`Actions for ${seller.storeName}`}
                    sx={{ cursor: "pointer" }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {sellers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11}>
                  <Stack spacing={1} sx={{ py: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                      {currentFilter === "blacklisted"
                        ? "No blacklisted sellers"
                        : currentFilter === "inactive"
                          ? "No inactive sellers"
                          : "No sellers yet"}
                    </Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Action menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      >
        <MenuItem component={Link} href={`/dashboard/sellers/${activeSellerId}`} onClick={closeMenu}>
          Edit seller
        </MenuItem>
        <MenuItem
          component={Link}
          href={`/dashboard/products?seller=${activeSellerId}`}
          onClick={closeMenu}
        >
          View products
        </MenuItem>
        {activeSeller?.isBlacklisted ? (
          <MenuItem
            onClick={() => { setBlacklistTarget(activeSeller); closeMenu(); }}
            sx={{ gap: 1 }}
          >
            Restore seller
          </MenuItem>
        ) : (
          <MenuItem
            onClick={() => { if (activeSeller) { setBlacklistTarget(activeSeller); closeMenu(); } }}
            sx={{ gap: 1, color: "warning.main" }}
          >
            Blacklist seller
          </MenuItem>
        )}
        <MenuItem
          onClick={() => { if (activeSeller) { setDeleteTarget(activeSeller); closeMenu(); } }}
          sx={{ gap: 1, color: "error.main" }}
        >
          Delete seller
        </MenuItem>
      </Menu>

      {/* Delete confirmation */}
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 900 }}>Delete seller?</DialogTitle>
        <DialogContent>
          {deleteError ? (
            <Alert severity="error" sx={{ mb: 2 }}>{deleteError}</Alert>
          ) : null}
          <Typography>
            <strong>{deleteTarget?.storeName}</strong> ({deleteTarget?.name}) and all their data will
            be permanently removed. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setDeleteTarget(null)}
            disabled={deleting}
            sx={{ textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ textTransform: "none", fontWeight: 900 }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Blacklist/Restore confirmation */}
      <Dialog
        open={Boolean(blacklistTarget)}
        onClose={() => !blacklisting && setBlacklistTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 900 }}>
          {blacklistTarget?.isBlacklisted ? "Restore seller?" : "Blacklist seller?"}
        </DialogTitle>
        <DialogContent>
          {blacklistError ? (
            <Alert severity="error" sx={{ mb: 2 }}>{blacklistError}</Alert>
          ) : null}
          <Typography>
            {blacklistTarget?.isBlacklisted
              ? `Remove the blacklist on "${blacklistTarget?.storeName}" and restore their access?`
              : `Blacklisting "${blacklistTarget?.storeName}" will hide their store and all their products immediately.`}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setBlacklistTarget(null)}
            disabled={blacklisting}
            sx={{ textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color={blacklistTarget?.isBlacklisted ? "primary" : "warning"}
            onClick={handleBlacklist}
            disabled={blacklisting}
            startIcon={blacklisting ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ textTransform: "none", fontWeight: 900 }}
          >
            {blacklistTarget?.isBlacklisted ? "Restore" : "Blacklist"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
