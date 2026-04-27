'use client';

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  AccountCircleOutlined,
  Brightness4Rounded,
  Brightness7Rounded,
  DashboardRounded,
  FavoriteBorderOutlined,
  LoginRounded,
  LogoutRounded,
  NotificationsOutlined,
  SettingsOutlined,
  ShoppingBagOutlined,
} from "@mui/icons-material";
import {
  AppBar,
  Badge,
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  SxProps,
  Theme,
  Toolbar,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import { useCart } from "@/components/providers/cartProvider";
import { useFavorites } from "@/components/providers/favoritesProvider";
import { useNotificationsQuery } from "@/lib/hooks/useStorefrontQueries";
import { useThemeContext } from "@/theme/themeContext";

export function StoreAppBar() {
  const pathname = usePathname();
  const { status } = useSession();
  const theme = useTheme();
  const { toggleMode } = useThemeContext();
  const { itemCount: cartCount } = useCart();
  const { favoriteCount } = useFavorites();
  const notificationsQuery = useNotificationsQuery();
  const notificationCount =
    notificationsQuery.data?.filter((item) => !item.isRead).length ?? 0;
  const [profileAnchorEl, setProfileAnchorEl] = React.useState<HTMLElement | null>(null);
  const [settingsAnchorEl, setSettingsAnchorEl] = React.useState<HTMLElement | null>(null);

  const isAuthenticated = status === "authenticated";
  const isCartRoute =
    pathname === "/cart" ||
    pathname === "/checkout" ||
    pathname.startsWith("/checkout/");
  const isNotificationsRoute = pathname === "/notifications";
  const isFavoritesRoute = pathname === "/favorites";
  const isDashboardRoute =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isProfileRoute = pathname === "/profile";
  const isSettingsRoute = pathname === "/settings";
  const profileMenuOpen = Boolean(profileAnchorEl);
  const settingsMenuOpen = Boolean(settingsAnchorEl);

  const profileHref = isAuthenticated
    ? "/profile"
    : "/auth/sign-in?callbackUrl=%2Fprofile";
  const settingsHref = isAuthenticated
    ? "/settings"
    : "/auth/sign-in?callbackUrl=%2Fsettings";

  const getNavButtonSx = (active: boolean): SxProps<Theme> => (theme) => ({
    color: active
      ? theme.palette.primary.main
      : alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.86 : 0.72),
    borderRadius: 999,
    backgroundColor: active
      ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.18 : 0.12)
      : "transparent",
    transition: "background-color 0.2s ease, color 0.2s ease, transform 0.2s ease",
    "&:hover": {
      backgroundColor: active
        ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.24 : 0.16)
        : alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.1 : 0.06),
      color: active ? theme.palette.primary.main : theme.palette.text.primary,
      transform: "translateY(-1px)",
    },
  });

  const navItems = [
    ...(isAuthenticated
      ? [
          {
            label: "Dashboard",
            href: "/dashboard",
            active: isDashboardRoute,
            icon: <DashboardRounded />,
            ariaLabel: "dashboard",
          },
        ]
      : []),
    {
      label: "Favorites",
      href: "/favorites",
      active: isFavoritesRoute,
      badge: favoriteCount,
      icon: <FavoriteBorderOutlined />,
      ariaLabel: "favorites",
    },
    {
      label: "Notifications",
      href: "/notifications",
      active: isNotificationsRoute,
      badge: notificationCount,
      icon: <NotificationsOutlined />,
      ariaLabel: "notifications",
    },
    {
      label: "Cart",
      href: "/cart",
      active: isCartRoute,
      badge: cartCount,
      icon: <ShoppingBagOutlined />,
      ariaLabel: "cart",
    },
  ];

  const closeProfileMenu = () => setProfileAnchorEl(null);
  const closeSettingsMenu = () => setSettingsAnchorEl(null);

  return (
    <AppBar
      position="sticky"
      color="transparent"
      elevation={0}
      sx={(theme) => ({
        color: theme.palette.text.primary,
        backdropFilter: "blur(18px)",
        backgroundColor: alpha(theme.palette.background.paper, 0.82),
        borderBottom: "1px solid",
        borderColor: "divider",
      })}
    >
      <Toolbar
        sx={{
          minHeight: { xs: 64, sm: 72, md: 80 },
          px: { xs: 1.25, sm: 3, md: 5 },
          gap: { xs: 1, sm: 1.5 },
        }}
      >
        <Box
          component={Link}
          href="/"
          sx={{
            color: "inherit",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          <Stack direction="row" spacing={{ xs: 1, sm: 1.5 }} alignItems="center">
            <Box
              sx={{
                position: "relative",
                width: { xs: 40, sm: 46 },
                height: { xs: 40, sm: 46 },
                borderRadius: { xs: 2.5, sm: 3 },
                overflow: "hidden",
                border: "1px solid",
                borderColor: "divider",
                background: (theme) =>
                  `linear-gradient(145deg, ${alpha(
                    theme.palette.primary.main,
                    theme.palette.mode === "dark" ? 0.28 : 0.16
                  )}, ${alpha(
                    theme.palette.background.paper,
                    theme.palette.mode === "dark" ? 0.94 : 0.98
                  )})`,
              }}
            >
              <Image
                src="/spreelogo.svg"
                alt="Spree logo"
                fill
                sizes="(max-width: 600px) 40px, 46px"
                style={{ objectFit: "contain", padding: 4 }}
                priority
              />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="h6"
                sx={{
                  lineHeight: 1,
                  fontWeight: 900,
                  color: "text.primary",
                  fontSize: { xs: "1rem", sm: "1.25rem" },
                }}
              >
                Spree
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: { xs: "none", sm: "block" } }}
              >
                Shop with ease
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        <Stack
          direction="row"
          spacing={{ xs: 0, sm: 1 }}
          alignItems="center"
          sx={{
            "& .MuiIconButton-root": {
              p: { xs: 0.75, sm: 1 },
            },
            "& .MuiSvgIcon-root": {
              fontSize: { xs: 22, sm: 24 },
            },
          }}
        >
          {navItems.map((item) => (
            <Tooltip key={item.ariaLabel} title={item.label}>
              <IconButton
                aria-label={item.ariaLabel}
                color="inherit"
                component={Link}
                href={item.href}
                sx={getNavButtonSx(item.active)}
              >
                {"badge" in item && typeof item.badge === "number" ? (
                  <Badge badgeContent={item.badge} color="primary">
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )}
              </IconButton>
            </Tooltip>
          ))}

          <Tooltip title="Profile">
            <IconButton
              aria-label="profile"
              color="inherit"
              onClick={(event) => setProfileAnchorEl(event.currentTarget)}
              sx={getNavButtonSx(isProfileRoute || profileMenuOpen)}
            >
              <AccountCircleOutlined />
            </IconButton>
          </Tooltip>

          <Tooltip title="Settings">
            <IconButton
              aria-label="settings"
              color="inherit"
              onClick={(event) => setSettingsAnchorEl(event.currentTarget)}
              sx={getNavButtonSx(isSettingsRoute || settingsMenuOpen)}
            >
              <SettingsOutlined />
            </IconButton>
          </Tooltip>
        </Stack>
      </Toolbar>

      <Menu
        anchorEl={profileAnchorEl}
        open={profileMenuOpen}
        onClose={closeProfileMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              minWidth: 220,
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
            },
          },
        }}
      >
        {isAuthenticated ? (
          [
            <MenuItem
              key="open-dashboard"
              component={Link}
              href="/dashboard"
              onClick={closeProfileMenu}
            >
              <ListItemIcon>
                <DashboardRounded fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Open dashboard" />
            </MenuItem>,
            <Divider key="dashboard-divider" />,
            <MenuItem
              key="open-profile"
              component={Link}
              href={profileHref}
              onClick={closeProfileMenu}
            >
              <ListItemIcon>
                <AccountCircleOutlined fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Open profile" />
            </MenuItem>,
            <Divider key="profile-divider" />,
            <MenuItem
              key="sign-out"
              onClick={() => {
                closeProfileMenu();
                void signOut({ callbackUrl: "/" });
              }}
            >
              <ListItemIcon>
                <LogoutRounded fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Sign out" />
            </MenuItem>,
          ]
        ) : (
          <MenuItem
            component={Link}
            href="/auth/sign-in?callbackUrl=%2Fprofile"
            onClick={closeProfileMenu}
          >
            <ListItemIcon>
              <LoginRounded fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Sign in" />
          </MenuItem>
        )}
      </Menu>

      <Menu
        anchorEl={settingsAnchorEl}
        open={settingsMenuOpen}
        onClose={closeSettingsMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              minWidth: 240,
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
            },
          },
        }}
      >
        <MenuItem
          onClick={() => {
            toggleMode();
          }}
        >
          <ListItemIcon>
            {theme.palette.mode === "dark" ? (
              <Brightness7Rounded fontSize="small" />
            ) : (
              <Brightness4Rounded fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText
            primary="Theme"
            secondary={
              theme.palette.mode === "dark"
                ? "Dark appearance is on"
                : "Light appearance is on"
            }
          />
        </MenuItem>
        <Divider />
        <MenuItem
          component={Link}
          href={settingsHref}
          onClick={closeSettingsMenu}
        >
          <ListItemIcon>
            <SettingsOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={isAuthenticated ? "Open settings" : "Sign in"} />
        </MenuItem>
      </Menu>
    </AppBar>
  );
}
