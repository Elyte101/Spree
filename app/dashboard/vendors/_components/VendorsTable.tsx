"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
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
import { alpha } from "@mui/material/styles";
import {
  ExpandMoreRounded,
  LocalShippingRounded,
  MoreVertRounded,
  PeopleRounded,
  PersonOffRounded,
  ShoppingBagOutlined,
  StorefrontRounded,
} from "@mui/icons-material";

import { api, ApiClientError } from "@/lib/api";
import { SellerSummary, SellerStatus, SellerType } from "@/types/types";

interface VendorsTableProps {
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

const statusColor = (
  status: SellerStatus
): "default" | "success" | "warning" | "error" | "info" => {
  switch (status) {
    case "verified":
    case "active":
      return "success";
    case "pending_verification":
    case "pending":
      return "info";
    case "rejected":
    case "suspended":
    case "removed":
      return "error";
    case "incomplete":
      return "warning";
    default:
      return "default";
  }
};

const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(value))
    : "Not started";

const formatLocation = (vendor: SellerSummary) =>
  [vendor.storeLocation.city, vendor.storeLocation.state, vendor.storeLocation.country]
    .filter(Boolean)
    .join(", ") || "Not provided";

const getInitials = (name: string) => name.slice(0, 2).toUpperCase();

const AVATAR_COLORS = [
  "#655AFF",
  "#F97316",
  "#0EA5E9",
  "#22C55E",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
];

const avatarColor = (id: string) =>
  AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length];

export function VendorsTable({ sellers, filter }: VendorsTableProps) {
  const router = useRouter();
  const currentFilter = (
    FILTER_TABS.some((t) => t.value === filter) ? filter : "all"
  ) as FilterTab;

  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [activeSellerId, setActiveSellerId] = React.useState<string | null>(null);
  const [expandedCards, setExpandedCards] = React.useState<Set<string>>(new Set());

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

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeSeller = activeSellerId
    ? sellers.find((s) => s.id === activeSellerId)
    : null;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await api.deleteAdminSeller(deleteTarget.id);
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      setDeleteError(
        err instanceof ApiClientError ? err.message : "Failed to delete vendor."
      );
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
        err instanceof ApiClientError
          ? err.message
          : "Failed to update blacklist status."
      );
    } finally {
      setBlacklisting(false);
    }
  };

  const emptyTitle =
    currentFilter === "blacklisted"
      ? "No blacklisted sellers"
      : currentFilter === "inactive"
        ? "No inactive sellers"
        : "No sellers yet";

  const emptyBody =
    currentFilter === "all"
      ? "Once sellers register and submit for verification, they will appear here."
      : "Adjust the filter above to see other sellers.";

  // ── shared kebab menu items ────────────────────────────────────────────────
  const actionMenu = (
    <Menu
      anchorEl={menuAnchor}
      open={Boolean(menuAnchor)}
      onClose={closeMenu}
      transformOrigin={{ horizontal: "right", vertical: "top" }}
      anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      slotProps={{
        paper: {
          sx: { minWidth: 180, borderRadius: 2, border: "1px solid", borderColor: "divider" },
        },
      }}
    >
      <MenuItem
        component={Link}
        href={`/dashboard/vendors/${activeSellerId}`}
        onClick={closeMenu}
      >
        Edit vendor
      </MenuItem>
      <MenuItem
        component={Link}
        href={`/dashboard/products?vendor=${activeSellerId}`}
        onClick={closeMenu}
      >
        View products
      </MenuItem>
      {activeSeller?.isBlacklisted ? (
        <MenuItem
          onClick={() => {
            setBlacklistTarget(activeSeller);
            closeMenu();
          }}
        >
          Restore vendor
        </MenuItem>
      ) : (
        <MenuItem
          onClick={() => {
            if (activeSeller) {
              setBlacklistTarget(activeSeller);
              closeMenu();
            }
          }}
          sx={{ color: "warning.main" }}
        >
          Blacklist vendor
        </MenuItem>
      )}
      <MenuItem
        onClick={() => {
          if (activeSeller) {
            setDeleteTarget(activeSeller);
            closeMenu();
          }
        }}
        sx={{ color: "error.main" }}
      >
        Delete vendor
      </MenuItem>
    </Menu>
  );

  return (
    <>
      {/* Filter tabs */}
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
            sx={{ textTransform: "none", fontWeight: 700, minHeight: 48 }}
          />
        ))}
      </Tabs>

      {/* ── DESKTOP TABLE (md+) ──────────────────────────────────────────── */}
      <Box sx={{ display: { xs: "none", md: "block" } }}>
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            overflowX: "auto",
            maxWidth: "100%",
            WebkitOverflowScrolling: "touch",
            // Subtle scroll affordance via inset shadow when content overflows
            backgroundImage: "none",
          }}
        >
          <Table sx={{ minWidth: 960 }} aria-label="vendor management table">
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}>
                <TableCell component="th" scope="col">vendor</TableCell>
                <TableCell component="th" scope="col">Status</TableCell>
                <TableCell component="th" scope="col">Type</TableCell>
                <TableCell component="th" scope="col">Location</TableCell>
                <TableCell component="th" scope="col">Badge</TableCell>
                <TableCell component="th" scope="col" align="right">Followers</TableCell>
                <TableCell component="th" scope="col" align="right">Purchases</TableCell>
                <TableCell component="th" scope="col" align="right">Deliveries</TableCell>
                <TableCell component="th" scope="col">Started</TableCell>
                <TableCell component="th" scope="col">Notice</TableCell>
                <TableCell component="th" scope="col" align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sellers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} sx={{ border: 0 }}>
                    <Stack spacing={1.5} alignItems="center" justifyContent="center" sx={{ py: 7 }}>
                      <PersonOffRounded sx={{ fontSize: 44, color: "text.disabled" }} />
                      <Typography variant="h6" fontWeight={700}>
                        {emptyTitle}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320, textAlign: "center" }}>
                        {emptyBody}
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : (
                sellers.map((vendor) => (
                  <TableRow
                    key={vendor.id}
                    hover
                    sx={
                      vendor.isBlacklisted
                        ? { opacity: 0.65, bgcolor: "action.hover" }
                        : undefined
                    }
                  >
                    {/* vendor identity */}
                    <TableCell sx={{ minWidth: 220 }}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar
                          aria-hidden
                          sx={{ bgcolor: avatarColor(vendor.id), width: 34, height: 34, fontSize: "0.75rem", flexShrink: 0 }}
                        >
                          {getInitials(vendor.storeName)}
                        </Avatar>
                        <Stack spacing={0.2} minWidth={0}>
                          <Typography
                            component="a"
                            href={`/dashboard/vendors/${vendor.id}`}
                            sx={{
                              color: "text.primary",
                              textDecoration: "none",
                              fontWeight: 700,
                              fontSize: "0.875rem",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              "&:hover": { color: "primary.main" },
                            }}
                          >
                            {vendor.storeName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {vendor.name} · {vendor.email}
                          </Typography>
                          {vendor.isBlacklisted && (
                            <Chip
                              label="Blacklisted"
                              color="error"
                              size="small"
                              sx={{ width: "fit-content", height: 18, fontSize: "0.65rem" }}
                            />
                          )}
                        </Stack>
                      </Stack>
                    </TableCell>

                    <TableCell>
                      <Chip
                        label={vendor.sellerStatus}
                        size="small"
                        color={statusColor(vendor.sellerStatus)}
                      />
                    </TableCell>

                    <TableCell>
                      <Chip
                        label={sellerTypeLabels[vendor.sellerType]}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>

                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {formatLocation(vendor)}
                    </TableCell>

                    <TableCell>
                      {vendor.sellerBadge ? (
                        <Chip
                          label={vendor.sellerBadge}
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                      ) : (
                        <Typography variant="body2" color="text.disabled">—</Typography>
                      )}
                    </TableCell>

                    <TableCell align="right">{vendor.followerCount.toLocaleString()}</TableCell>
                    <TableCell align="right">{vendor.purchaseCount.toLocaleString()}</TableCell>
                    <TableCell align="right">{vendor.completedDeliveries.toLocaleString()}</TableCell>

                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {formatDate(vendor.startedAt)}
                    </TableCell>

                    <TableCell sx={{ maxWidth: 200 }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        title={vendor.sellerNotice || undefined}
                        sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {vendor.sellerNotice || "—"}
                      </Typography>
                    </TableCell>

                    <TableCell align="right">
                      <IconButton
                        onClick={(e) => openMenu(e, vendor.id)}
                        aria-label={`Actions for ${vendor.storeName}`}
                        size="medium"
                        sx={{ width: 44, height: 44 }}
                      >
                        <MoreVertRounded fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* ── MOBILE CARD LIST (below md) ─────────────────────────────────── */}
      <Stack spacing={1.5} sx={{ display: { xs: "flex", md: "none" } }}>
        {sellers.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: { xs: 4, sm: 6 },
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              textAlign: "center",
            }}
          >
            <PersonOffRounded sx={{ fontSize: 44, color: "text.disabled", mb: 1.5 }} />
            <Typography variant="h6" fontWeight={700} mb={0.75}>
              {emptyTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300, mx: "auto" }}>
              {emptyBody}
            </Typography>
          </Paper>
        ) : (
          sellers.map((vendor) => {
            const expanded = expandedCards.has(vendor.id);
            return (
              <Paper
                key={vendor.id}
                elevation={0}
                sx={(theme) => ({
                  borderRadius: 2,
                  border: "1.5px solid",
                  borderColor: vendor.isBlacklisted
                    ? alpha(theme.palette.error.main, 0.35)
                    : theme.palette.divider,
                  overflow: "hidden",
                  opacity: vendor.isBlacklisted ? 0.82 : 1,
                })}
              >
                {/* Card header — primary info */}
                <Stack
                  direction="row"
                  spacing={1.5}
                  alignItems="flex-start"
                  sx={{ p: 1.5 }}
                >
                  <Avatar
                    aria-hidden
                    sx={{
                      bgcolor: avatarColor(vendor.id),
                      width: 40,
                      height: 40,
                      flexShrink: 0,
                      mt: 0.25,
                    }}
                  >
                    {getInitials(vendor.storeName)}
                  </Avatar>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      component="a"
                      href={`/dashboard/vendors/${vendor.id}`}
                      sx={{
                        color: "text.primary",
                        textDecoration: "none",
                        fontWeight: 700,
                        fontSize: "0.9375rem",
                        display: "block",
                        "&:hover": { color: "primary.main" },
                      }}
                    >
                      {vendor.storeName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" noWrap>
                      {vendor.name} · {vendor.email}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={0.75}
                      mt={0.75}
                      useFlexGap
                      flexWrap="wrap"
                    >
                      <Chip
                        label={vendor.sellerStatus}
                        size="small"
                        color={statusColor(vendor.sellerStatus)}
                        sx={{ height: 22 }}
                      />
                      <Chip
                        label={sellerTypeLabels[vendor.sellerType]}
                        size="small"
                        variant="outlined"
                        sx={{ height: 22 }}
                      />
                      {vendor.isBlacklisted && (
                        <Chip
                          label="Blacklisted"
                          color="error"
                          size="small"
                          sx={{ height: 22 }}
                        />
                      )}
                    </Stack>
                  </Box>

                  <IconButton
                    onClick={(e) => openMenu(e, vendor.id)}
                    aria-label={`Actions for ${vendor.storeName}`}
                    size="medium"
                    sx={{ width: 44, height: 44, flexShrink: 0 }}
                  >
                    <MoreVertRounded />
                  </IconButton>
                </Stack>

                <Divider />

                {/* Stats row — secondary info */}
                <Box
                  role="list"
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    "& > *": {
                      borderRight: "1px solid",
                      borderColor: "divider",
                      "&:last-child": { borderRight: "none" },
                    },
                  }}
                >
                  {[
                    { icon: <PeopleRounded sx={{ fontSize: 14 }} />, label: "Followers", value: vendor.followerCount },
                    { icon: <ShoppingBagOutlined sx={{ fontSize: 14 }} />, label: "Purchases", value: vendor.purchaseCount },
                    { icon: <LocalShippingRounded sx={{ fontSize: 14 }} />, label: "Deliveries", value: vendor.completedDeliveries },
                  ].map(({ icon, label, value }) => (
                    <Box
                      key={label}
                      role="listitem"
                      sx={{ textAlign: "center", px: 1, py: 1.25 }}
                    >
                      <Stack direction="row" justifyContent="center" alignItems="center" spacing={0.5} mb={0.25}>
                        <Box sx={{ color: "text.secondary", display: "flex" }} aria-hidden>{icon}</Box>
                        <Typography variant="subtitle1" fontWeight={800} lineHeight={1}>
                          {value.toLocaleString()}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">{label}</Typography>
                    </Box>
                  ))}
                </Box>

                {/* Location row */}
                <Stack
                  direction="row"
                  spacing={0.75}
                  alignItems="center"
                  sx={{ px: 1.5, pb: 1.25, pt: 0.5 }}
                >
                  <StorefrontRounded sx={{ fontSize: 14, color: "text.secondary", flexShrink: 0 }} aria-hidden />
                  <Typography variant="caption" color="text.secondary">
                    {formatLocation(vendor)}
                  </Typography>
                </Stack>

                {/* Expand toggle for tertiary info */}
                <Box
                  component="button"
                  type="button"
                  onClick={() => toggleExpand(vendor.id)}
                  aria-expanded={expanded}
                  aria-label={
                    expanded
                      ? `Collapse details for ${vendor.storeName}`
                      : `Show more details for ${vendor.storeName}`
                  }
                  sx={(theme) => ({
                    display: "flex",
                    width: "100%",
                    alignItems: "center",
                    gap: 0.75,
                    px: 1.5,
                    minHeight: 44,
                    border: "none",
                    borderTop: "1px solid",
                    borderColor: theme.palette.divider,
                    bgcolor: "action.hover",
                    cursor: "pointer",
                    color: "text.secondary",
                    fontFamily: "inherit",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textAlign: "left",
                    "&:focus-visible": {
                      outline: "2.5px solid",
                      outlineColor: "primary.main",
                      outlineOffset: -2,
                    },
                  })}
                >
                  <ExpandMoreRounded
                    sx={{
                      fontSize: 16,
                      transition: "transform 0.2s ease",
                      transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                    aria-hidden
                  />
                  {expanded ? "Hide details" : "More details"}
                </Box>

                {/* Tertiary info */}
                <Collapse in={expanded}>
                  <Stack
                    spacing={1}
                    divider={<Divider />}
                    sx={{ px: 1.5, py: 1.25, borderTop: "1px solid", borderColor: "divider" }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        Started
                      </Typography>
                      <Typography variant="caption" fontWeight={700}>
                        {formatDate(vendor.startedAt)}
                      </Typography>
                    </Stack>
                    {vendor.sellerBadge ? (
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                          Badge
                        </Typography>
                        <Chip
                          label={vendor.sellerBadge}
                          size="small"
                          color="success"
                          variant="outlined"
                          sx={{ height: 22 }}
                        />
                      </Stack>
                    ) : null}
                    {vendor.sellerNotice ? (
                      <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                          Notice
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.25 }}>
                          {vendor.sellerNotice}
                        </Typography>
                      </Box>
                    ) : null}
                  </Stack>
                </Collapse>
              </Paper>
            );
          })
        )}
      </Stack>

      {/* ── SHARED ACTION MENU ────────────────────────────────────────── */}
      {actionMenu}

      {/* ── DELETE CONFIRMATION ────────────────────────────────────────── */}
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 900 }}>Delete vendor?</DialogTitle>
        <DialogContent>
          {deleteError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          ) : null}
          <Typography>
            <strong>{deleteTarget?.storeName}</strong> ({deleteTarget?.name}) and all their data
            will be permanently removed. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ fontWeight: 900 }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── BLACKLIST / RESTORE CONFIRMATION ─────────────────────────── */}
      <Dialog
        open={Boolean(blacklistTarget)}
        onClose={() => !blacklisting && setBlacklistTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 900 }}>
          {blacklistTarget?.isBlacklisted ? "Restore vendor?" : "Blacklist vendor?"}
        </DialogTitle>
        <DialogContent>
          {blacklistError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {blacklistError}
            </Alert>
          ) : null}
          <Typography>
            {blacklistTarget?.isBlacklisted
              ? `Remove the blacklist on "${blacklistTarget?.storeName}" and restore their access?`
              : `Blacklisting "${blacklistTarget?.storeName}" will hide their store and all their products immediately.`}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setBlacklistTarget(null)} disabled={blacklisting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={blacklistTarget?.isBlacklisted ? "primary" : "warning"}
            onClick={handleBlacklist}
            disabled={blacklisting}
            startIcon={blacklisting ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ fontWeight: 900 }}
          >
            {blacklistTarget?.isBlacklisted ? "Restore" : "Blacklist"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
