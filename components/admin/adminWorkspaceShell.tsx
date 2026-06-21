'use client';

import * as React from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AddBoxRounded,
  CloseRounded,
  Inventory2Rounded,
  ManageAccountsRounded,
  MenuRounded,
  ReceiptLongOutlined,
  SettingsRounded,
  SpaceDashboardRounded,
  StorefrontRounded,
} from "@mui/icons-material";
import {
  alpha,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { UserRole } from "@/types/types";

interface AdminWorkspaceShellProps {
  children: ReactNode;
  userName: string;
  userRole: UserRole;
  canManageCatalog: boolean;
}

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

const roleLabelMap: Record<UserRole, string> = {
  admin: "Admin",
  vendor: "vendor",
  customer: "Customer",
};

const isActivePath = (pathname: string, href: string) => {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
};

export function AdminWorkspaceShell({
  children,
  userName,
  userRole,
  canManageCatalog,
}: AdminWorkspaceShellProps) {
  const pathname = usePathname();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = React.useState(false);
  const navItems: NavItem[] = [
    {
      label: "Overview",
      href: "/dashboard",
      icon: <SpaceDashboardRounded fontSize="small" />,
    },
    ...(canManageCatalog
      ? [
          {
            label: "Products",
            href: "/dashboard/products",
            icon: <Inventory2Rounded fontSize="small" />,
          },
          {
            label: "Create product",
            href: "/dashboard/products/new",
            icon: <AddBoxRounded fontSize="small" />,
          },
          {
            label: "Orders",
            href: "/dashboard/orders",
            icon: <ReceiptLongOutlined fontSize="small" />,
          },
        ]
      : []),
    ...(userRole === "admin"
      ? [
          {
            label: "Vendors",
            href: "/dashboard/vendors",
            icon: <ManageAccountsRounded fontSize="small" />,
          },
          {
            label: "Top products",
            href: "/dashboard/products/top",
            icon: <StorefrontRounded fontSize="small" />,
          },
        ]
      : []),
    {
      label: "Storefront",
      href: "/products",
      icon: <StorefrontRounded fontSize="small" />,
    },
    {
      label: "Profile",
      href: "/profile",
      icon: <ManageAccountsRounded fontSize="small" />,
    },
    {
      label: "Settings",
      href: "/settings",
      icon: <SettingsRounded fontSize="small" />,
    },
  ];
  const activeNavItem = navItems.find((item) => isActivePath(pathname, item.href));

  const renderWorkspaceNavigation = (closeOnNavigate = false) => (
    <Stack spacing={2}>
      <Box>
        <Typography variant="overline" color="text.secondary">
          Navigate
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          Workspace
        </Typography>
      </Box>

      <Stack spacing={1}>
        {navItems.map((item) => {
          const active = isActivePath(pathname, item.href);

          return (
            <Button
              key={item.href}
              component={Link}
              href={item.href}
              fullWidth
              startIcon={item.icon}
              onClick={closeOnNavigate ? () => setWorkspaceMenuOpen(false) : undefined}
              sx={(theme) => ({
                justifyContent: "flex-start",
                px: 1.5,
                py: 1.1,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: active ? 900 : 700,
                color: active
                  ? theme.palette.primary.main
                  : theme.palette.text.primary,
                backgroundColor: active
                  ? alpha(
                      theme.palette.primary.main,
                      theme.palette.mode === "dark" ? 0.18 : 0.12
                    )
                  : "transparent",
                "&:hover": {
                  backgroundColor: active
                    ? alpha(
                        theme.palette.primary.main,
                        theme.palette.mode === "dark" ? 0.24 : 0.16
                      )
                    : alpha(
                        theme.palette.text.primary,
                        theme.palette.mode === "dark" ? 0.08 : 0.05
                      ),
                },
              })}
            >
              {item.label}
            </Button>
          );
        })}
      </Stack>

      <Divider />

      <Paper
        elevation={0}
        sx={(theme) => ({
          p: 2,
          borderRadius: 1.3,
          backgroundColor: alpha(
            theme.palette.info.main,
            theme.palette.mode === "dark" ? 0.12 : 0.08
          ),
        })}
      >
        <Stack spacing={1}>
          <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
            Focus today
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {canManageCatalog
              ? "Refresh your newest products, keep stock healthy, and make sure featured items tell the right story."
              : "Review your account details and keep your storefront preferences current."}
          </Typography>
        </Stack>
      </Paper>
    </Stack>
  );

  return (
    <Box
      sx={(theme) => ({
        minHeight: "100vh",
        px: { xs: 1.5, sm: 3, md: 5 },
        py: { xs: 3, md: 4 },
        background: `radial-gradient(circle at top left, ${alpha(
          theme.palette.primary.main,
          theme.palette.mode === "dark" ? 0.18 : 0.1
        )} 0%, transparent 26%), radial-gradient(circle at 100% 0%, ${alpha(
          theme.palette.info.main,
          theme.palette.mode === "dark" ? 0.12 : 0.08
        )} 0%, transparent 24%), linear-gradient(180deg, ${
          theme.palette.background.default
        } 0%, ${theme.palette.background.paper} 100%)`,
      })}
    >
      <Stack spacing={3}>
        <Paper
          elevation={0}
          sx={(theme) => ({
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            background: `linear-gradient(135deg, ${alpha(
              theme.palette.background.paper,
              theme.palette.mode === "dark" ? 0.94 : 0.98
            )} 0%, ${alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.16 : 0.08)} 100%)`,
          })}
        >
          <Stack
            direction={{ xs: "column", xl: "row" }}
            spacing={2.5}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", xl: "center" }}
          >
            <Stack spacing={1.5} sx={{ maxWidth: 720 }}>
              <Chip
                label={canManageCatalog ? "Merchant workspace" : "Account center"}
                color="primary"
                sx={{ width: "fit-content", borderRadius: 999, fontWeight: 900 }}
              />
              <Typography variant="h4" sx={{ fontWeight: 900 }}>
                {canManageCatalog
                  ? "Run your shop from one focused control room."
                  : "Keep your account details and storefront preferences together."}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {canManageCatalog
                  ? "Catalog work, merchandising decisions, and store health all live here so you can move faster with less context switching."
                  : "Your profile, settings, and shopping essentials are organized in one place."}
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Chip
                  label={roleLabelMap[userRole]}
                  variant="outlined"
                  sx={{ borderRadius: 999 }}
                />
                <Chip
                  label={`Signed in as ${userName}`}
                  variant="outlined"
                  sx={{ borderRadius: 999 }}
                />
              </Stack>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button
                component={Link}
                href={canManageCatalog ? "/dashboard/products/new" : "/profile"}
                variant="contained"
                sx={{ borderRadius: 999, px: 3, textTransform: "none", fontWeight: 900 }}
              >
                {canManageCatalog ? "Add product" : "Update profile"}
              </Button>
              <Button
                component={Link}
                href="/products"
                variant="outlined"
                sx={{ borderRadius: 999, px: 3, textTransform: "none", fontWeight: 900 }}
              >
                Shop products
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Box
          sx={{
            display: "grid",
            gap: 3,
            gridTemplateColumns: { xs: "1fr", lg: "280px minmax(0, 1fr)" },
            alignItems: "start",
          }}
        >
          <Paper
            elevation={0}
            sx={(theme) => ({
              display: { xs: "block", lg: "none" },
              p: 1.5,
              borderRadius: 2,
              border: "1px solid",
              borderColor: alpha(theme.palette.common.white, theme.palette.mode === "dark" ? 0.12 : 0.5),
              backgroundColor: alpha(
                theme.palette.background.paper,
                theme.palette.mode === "dark" ? 0.58 : 0.7
              ),
              backdropFilter: "blur(10px) saturate(145%)",
              boxShadow:
                theme.palette.mode === "dark"
                  ? "0 20px 60px rgba(0, 0, 0, 0.24)"
                  : "0 20px 60px rgba(15, 23, 42, 0.1)",
            })}
          >
            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1 }}>
                  Navigate
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                  Workspace
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {activeNavItem?.label ?? "Current section"}
                </Typography>
              </Box>
              <Button
                startIcon={<MenuRounded />}
                variant="outlined"
                onClick={() => setWorkspaceMenuOpen(true)}
                sx={{
                  borderRadius: 999,
                  textTransform: "none",
                  fontWeight: 900,
                  whiteSpace: "nowrap",
                }}
              >
                Menu
              </Button>
            </Stack>
          </Paper>

          <Drawer
            anchor="left"
            open={workspaceMenuOpen}
            onClose={() => setWorkspaceMenuOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{ display: { xs: "block", lg: "none" } }}
            slotProps={{
              paper: {
                sx: (theme) => ({
                  width: "min(86vw, 320px)",
                  p: 2,
                  boxSizing: "border-box",
                  borderRight: "1px solid",
                  borderColor: alpha(theme.palette.common.white, theme.palette.mode === "dark" ? 0.12 : 0.52),
                  backgroundColor: alpha(
                    theme.palette.background.paper,
                    theme.palette.mode === "dark" ? 0.72 : 0.78
                  ),
                  backdropFilter: "blur(22px) saturate(150%)",
                  WebkitBackdropFilter: "blur(22px) saturate(150%)",
                }),
              },
            }}
          >
            <Stack spacing={2}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                  Workspace menu
                </Typography>
                <IconButton
                  aria-label="Close workspace menu"
                  onClick={() => setWorkspaceMenuOpen(false)}
                  size="small"
                >
                  <CloseRounded fontSize="small" />
                </IconButton>
              </Stack>
              {renderWorkspaceNavigation(true)}
            </Stack>
          </Drawer>

          <Paper
            component="aside"
            elevation={0}
            sx={(theme) => ({
              display: { xs: "none", lg: "block" },
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: alpha(theme.palette.common.white, theme.palette.mode === "dark" ? 0.12 : 0.52),
              backgroundColor: alpha(
                theme.palette.background.paper,
                theme.palette.mode === "dark" ? 0.6 : 0.72
              ),
              backdropFilter: "blur(18px) saturate(145%)",
              boxShadow:
                theme.palette.mode === "dark"
                  ? "0 24px 70px rgba(0, 0, 0, 0.22)"
                  : "0 24px 70px rgba(15, 23, 42, 0.1)",
              position: { lg: "sticky" },
              top: { lg: 96 },
            })}
          >
            {renderWorkspaceNavigation()}
          </Paper>

          <Stack component="section" spacing={3} sx={{ minWidth: 0, overflow: "hidden" }}>
            {children}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
