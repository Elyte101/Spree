'use client';

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
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
  ReceiptLongOutlined,
  SearchRounded,
  SettingsOutlined,
  ShoppingBagOutlined,
} from "@mui/icons-material";
import {
  AppBar,
  Badge,
  Box,
  Divider,
  IconButton,
  InputAdornment,
  InputBase,
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
  const router = useRouter();
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
  const [searchValue, setSearchValue] = React.useState("");

  const isAuthenticated = status === "authenticated";
  const isCartRoute = pathname === "/cart" || pathname === "/checkout" || pathname.startsWith("/checkout/");
  const isNotificationsRoute = pathname === "/notifications";
  const isFavoritesRoute = pathname === "/favorites";
  const isDashboardRoute = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isProfileRoute = pathname === "/profile";
  const isSettingsRoute = pathname === "/settings";
  const profileMenuOpen = Boolean(profileAnchorEl);
  const settingsMenuOpen = Boolean(settingsAnchorEl);

  const profileHref = isAuthenticated ? "/profile" : "/auth/sign-in?callbackUrl=%2Fprofile";
  const settingsHref = isAuthenticated ? "/settings" : "/auth/sign-in?callbackUrl=%2Fsettings";

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      router.push(`/products?search=${encodeURIComponent(searchValue.trim())}`);
    }
  };

  const getNavButtonSx = (active: boolean): SxProps<Theme> => (theme) => ({
    color: active
      ? theme.palette.primary.main
      : alpha(theme.palette.text.primary, 0.65),
    borderRadius: 999,
    backgroundColor: active
      ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.18 : 0.1)
      : "transparent",
    transition: "background-color 0.18s ease, color 0.18s ease, transform 0.18s ease",
    "&:hover": {
      backgroundColor: active
        ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.24 : 0.14)
        : alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.08 : 0.06),
      color: active ? theme.palette.primary.main : theme.palette.text.primary,
      transform: "translateY(-1px)",
    },
  });

  const navItems = [
    ...(isAuthenticated
      ? [{ label: "Dashboard", href: "/dashboard", active: isDashboardRoute, icon: <DashboardRounded />, ariaLabel: "dashboard" }]
      : []),
    { label: "Favorites", href: "/favorites", active: isFavoritesRoute, badge: favoriteCount, icon: <FavoriteBorderOutlined />, ariaLabel: "favorites" },
    { label: "Notifications", href: "/notifications", active: isNotificationsRoute, badge: notificationCount, icon: <NotificationsOutlined />, ariaLabel: "notifications" },
    { label: "Cart", href: "/cart", active: isCartRoute, badge: cartCount, icon: <ShoppingBagOutlined />, ariaLabel: "cart" },
  ];

  const closeProfileMenu = () => setProfileAnchorEl(null);
  const closeSettingsMenu = () => setSettingsAnchorEl(null);

  return (
    <AppBar
      position="fixed"
      color="transparent"
      elevation={0}
      sx={(theme) => ({
        color: theme.palette.text.primary,
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        backgroundColor: alpha(
          theme.palette.background.paper,
          theme.palette.mode === "dark" ? 0.78 : 0.88
        ),
        borderBottom: "1px solid",
        borderColor: theme.palette.divider,
      })}
    >
      <Toolbar
        sx={{
          minHeight: { xs: 64, sm: 72 },
          px: { xs: 1.5, sm: 2.5, md: 4 },
          gap: 1.5,
        }}
      >
        {/* Logo */}
        <Box
          component={Link}
          href="/"
          sx={{
            color: "inherit",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box
              sx={(theme) => ({
                position: "relative",
                width: { xs: 36, sm: 40 },
                height: { xs: 36, sm: 40 },
                borderRadius: 2,
                overflow: "hidden",
                bgcolor: "#F5F4FF",
                boxShadow:
                  theme.palette.mode === "dark"
                    ? "0 0 0 1.5px rgba(101,90,255,0.35)"
                    : "none",
                flexShrink: 0,
              })}
            >
              <Image
                src="/spreelogo.png"
                alt="Spree logo"
                fill
                sizes="40px"
                style={{ objectFit: "contain", padding: 4 }}
                priority
              />
            </Box>
            <Box sx={{ display: { xs: "none", sm: "block" } }}>
              <Typography
                variant="h6"
                sx={{
                  lineHeight: 1,
                  fontWeight: 800,
                  color: "text.primary",
                  fontSize: "1.1rem",
                  letterSpacing: "-0.02em",
                }}
              >
                Spree
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
                Shop with ease
              </Typography>
            </Box>
          </Stack>
        </Box>

        {/* Search bar — center */}
        <Box
          component="form"
          onSubmit={handleSearchSubmit}
          sx={{
            flexGrow: 1,
            maxWidth: { xs: "100%", md: 520 },
            mx: { md: "auto" },
            display: { xs: "none", sm: "flex" },
          }}
        >
          <InputBase
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search products, brands…"
            fullWidth
            startAdornment={
              <InputAdornment position="start" sx={{ ml: 0.5 }}>
                <SearchRounded fontSize="small" sx={{ color: "text.secondary" }} />
              </InputAdornment>
            }
            sx={(theme) => ({
              px: 1.5,
              py: 0.75,
              borderRadius: 999,
              border: "1.5px solid",
              borderColor: theme.palette.divider,
              backgroundColor:
                theme.palette.mode === "dark"
                  ? alpha(theme.palette.common.white, 0.05)
                  : alpha(theme.palette.primary.main, 0.04),
              fontSize: "0.875rem",
              transition: "border-color 0.2s ease, box-shadow 0.2s ease",
              "&:hover": {
                borderColor: alpha(theme.palette.primary.main, 0.4),
              },
              "&.Mui-focused": {
                borderColor: "primary.main",
                boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.12)}`,
              },
              "& .MuiInputBase-input": {
                py: 0,
                "&::placeholder": {
                  color: theme.palette.text.secondary,
                  opacity: 0.8,
                },
              },
            })}
          />
        </Box>

        {/* Mobile search icon */}
        <Tooltip title="Search">
          <IconButton
            aria-label="search"
            component={Link}
            href="/products"
            sx={getNavButtonSx(false)}
          >
            <SearchRounded />
          </IconButton>
        </Tooltip>

        <Box sx={{ flexGrow: { xs: 1, sm: 0 } }} />

        {/* Nav icons */}
        <Stack
          direction="row"
          spacing={0}
          alignItems="center"
          sx={{
            "& .MuiIconButton-root": {
              p: { xs: 0.75, sm: 0.875 },
            },
            "& .MuiSvgIcon-root": {
              fontSize: { xs: 21, sm: 22 },
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
                {"badge" in item && typeof item.badge === "number" && item.badge > 0 ? (
                  <Badge badgeContent={item.badge} color="primary" max={99}>
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

      {/* Profile menu */}
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
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            },
          },
        }}
      >
        {isAuthenticated
          ? [
              <MenuItem key="open-dashboard" component={Link} href="/dashboard" onClick={closeProfileMenu}>
                <ListItemIcon><DashboardRounded fontSize="small" /></ListItemIcon>
                <ListItemText primary="Dashboard" />
              </MenuItem>,
              <Divider key="d1" />,
              <MenuItem key="open-profile" component={Link} href={profileHref} onClick={closeProfileMenu}>
                <ListItemIcon><AccountCircleOutlined fontSize="small" /></ListItemIcon>
                <ListItemText primary="My profile" />
              </MenuItem>,
              <MenuItem key="my-orders" component={Link} href="/orders" onClick={closeProfileMenu}>
                <ListItemIcon><ReceiptLongOutlined fontSize="small" /></ListItemIcon>
                <ListItemText primary="My orders" />
              </MenuItem>,
              <Divider key="d2" />,
              <MenuItem
                key="sign-out"
                onClick={() => { closeProfileMenu(); void signOut({ callbackUrl: "/" }); }}
              >
                <ListItemIcon><LogoutRounded fontSize="small" /></ListItemIcon>
                <ListItemText primary="Sign out" />
              </MenuItem>,
            ]
          : (
            <MenuItem component={Link} href="/auth/sign-in?callbackUrl=%2Fprofile" onClick={closeProfileMenu}>
              <ListItemIcon><LoginRounded fontSize="small" /></ListItemIcon>
              <ListItemText primary="Sign in" />
            </MenuItem>
          )}
      </Menu>

      {/* Settings menu */}
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
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            },
          },
        }}
      >
        <MenuItem onClick={() => { toggleMode(); }}>
          <ListItemIcon>
            {theme.palette.mode === "dark"
              ? <Brightness7Rounded fontSize="small" />
              : <Brightness4Rounded fontSize="small" />}
          </ListItemIcon>
          <ListItemText
            primary="Appearance"
            secondary={theme.palette.mode === "dark" ? "Dark mode on" : "Light mode on"}
          />
        </MenuItem>
        <Divider />
        <MenuItem component={Link} href={settingsHref} onClick={closeSettingsMenu}>
          <ListItemIcon><SettingsOutlined fontSize="small" /></ListItemIcon>
          <ListItemText primary={isAuthenticated ? "Settings" : "Sign in"} />
        </MenuItem>
      </Menu>
    </AppBar>
  );
}
