'use client';

import * as React from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import {
  Badge,
  Box,
  Button,
  CircularProgress,
  Drawer,
  Fab,
  IconButton,
  Paper,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ChatBubbleRounded, CloseRounded, RefreshRounded } from "@mui/icons-material";

import {
  Chat,
  Channel,
  MessageComposerUI,
  MessageList,
  Thread,
  Window,
} from "stream-chat-react";
import "stream-chat-react/dist/css/index.css";

import { useChatConnection } from "@/components/providers/chatProvider";

export function ChatWidget() {
  const { status: sessionStatus, data: session } = useSession();
  const { client, channel, connectStatus, errorMsg, unreadCount, markRead, retry } = useChatConnection();
  const pathname = usePathname();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [open, setOpen] = React.useState(false);

  // CH9: admins use the full admin chat page — no FAB for them
  const isAdmin = session?.user?.role === "admin";
  // CH10: suppress the FAB when a full-page chat is already on screen
  const isChatPage = pathname === "/chat" || pathname === "/dashboard/chat";

  // Clear unread when drawer opens
  React.useEffect(() => {
    if (open && channel) markRead();
  }, [open, channel, markRead]);

  // Support programmatic open (e.g. from nav bar toggle)
  React.useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("spree:open-chat", handler);
    return () => window.removeEventListener("spree:open-chat", handler);
  }, []);

  // CH9: hide for admins; CH10: hide on full-page chat routes
  if (sessionStatus !== "authenticated" || isAdmin || isChatPage) return null;

  // Stream CSS variable overrides to match Spree's palette
  const streamCssVars: React.CSSProperties = {
    "--str-chat__primary-color": "#655AFF",
    "--str-chat__active-primary-color": "#4740CC",
    "--str-chat__surface-color": isDark ? "#17161F" : "#FFFFFF",
    "--str-chat__secondary-surface-color": isDark ? "#0C0B14" : "#F5F4FF",
    "--str-chat__primary-surface-color": isDark ? "rgba(101,90,255,0.12)" : "rgba(101,90,255,0.08)",
    "--str-chat__primary-surface-color-low-emphasis": isDark ? "rgba(101,90,255,0.06)" : "rgba(101,90,255,0.04)",
    "--str-chat__text-color": isDark ? "#F0EEFF" : "#0F0E1A",
    "--str-chat__secondary-text-color": isDark ? "#9B96B8" : "#5B5675",
    "--str-chat__disabled-color": isDark ? "rgba(240,238,255,0.3)" : "rgba(15,14,26,0.3)",
    "--str-chat__border-radius-circle": "999px",
    "--str-chat__font-family": '"Rubik", "Nunito Sans", sans-serif',
  } as React.CSSProperties;

  return (
    <>
      {/* Floating Action Button */}
      <Fab
        aria-label="Open support chat"
        onClick={() => setOpen(true)}
        sx={{
          position: "fixed",
          bottom: { xs: 20, sm: 28 },
          right: { xs: 20, sm: 28 },
          zIndex: 1200,
          backgroundColor: "#655AFF",
          color: "#fff",
          width: 56,
          height: 56,
          boxShadow: "0 4px 24px rgba(101,90,255,0.45)",
          "&:hover": {
            backgroundColor: "#4740CC",
            transform: "translateY(-2px)",
            boxShadow: "0 8px 32px rgba(101,90,255,0.55)",
          },
          transition: "all 0.2s ease",
        }}
      >
        <Badge
          badgeContent={unreadCount}
          color="error"
          max={99}
          invisible={unreadCount === 0}
        >
          <ChatBubbleRounded fontSize="medium" />
        </Badge>
      </Fab>

      {/* Chat Drawer */}
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{
          paper: {
            sx: {
              width: { xs: "100vw", sm: 400 },
              maxWidth: "100vw",
              display: "flex",
              flexDirection: "column",
              backgroundColor: isDark ? "#17161F" : "#FFFFFF",
              borderLeft: "1px solid",
              borderColor: isDark ? "rgba(101,90,255,0.14)" : "rgba(101,90,255,0.10)",
            },
          },
        }}
      >
        {/* Drawer header */}
        <Paper
          elevation={0}
          sx={(t) => ({
            px: 2.5,
            py: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid",
            borderColor: t.palette.divider,
            backgroundColor: alpha(t.palette.primary.main, isDark ? 0.12 : 0.06),
            flexShrink: 0,
          })}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={900}>
              Spree Support
            </Typography>
            <Typography variant="caption" color="text.secondary">
              We typically reply within a few hours
            </Typography>
          </Box>
          <IconButton
            aria-label="Close chat"
            size="small"
            onClick={() => setOpen(false)}
            sx={{ color: "text.secondary" }}
          >
            <CloseRounded fontSize="small" />
          </IconButton>
        </Paper>

        {/* Chat body */}
        <Box sx={{ flex: 1, overflow: "hidden", ...streamCssVars }}>
          {connectStatus === "idle" || connectStatus === "connecting" ? (
            <Stack
              alignItems="center"
              justifyContent="center"
              height="100%"
              spacing={1.5}
            >
              <CircularProgress size={28} sx={{ color: "#655AFF" }} />
              <Typography variant="body2" color="text.secondary">
                Connecting to support...
              </Typography>
            </Stack>
          ) : connectStatus === "error" || connectStatus === "timeout" ? (
            <Stack
              alignItems="center"
              justifyContent="center"
              height="100%"
              spacing={2}
              p={3}
            >
              <Typography
                variant="body2"
                color="text.secondary"
                textAlign="center"
              >
                {errorMsg}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<RefreshRounded />}
                onClick={retry}
                sx={{ borderColor: "#655AFF", color: "#655AFF" }}
              >
                Try again
              </Button>
            </Stack>
          ) : connectStatus === "connected" && client && channel ? (
            <Chat
              client={client}
              theme={isDark ? "str-chat__theme-dark" : "str-chat__theme-light"}
            >
              <Channel channel={channel}>
                <Window>
                  <MessageList />
                  <MessageComposerUI />
                </Window>
                <Thread />
              </Channel>
            </Chat>
          ) : null}
        </Box>
      </Drawer>
    </>
  );
}
