'use client';

import * as React from "react";
import { useSession } from "next-auth/react";
import {
  Badge,
  Box,
  Drawer,
  Fab,
  IconButton,
  Paper,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ChatBubbleRounded, CloseRounded } from "@mui/icons-material";

import {
  Chat,
  Channel,
  MessageComposerUI,
  MessageList,
  Thread,
  Window,
} from "stream-chat-react";
import "stream-chat-react/dist/css/index.css";
import { StreamChat, type Channel as StreamChannel } from "stream-chat";

interface ChatTokenResponse {
  token: string;
  userId: string;
  channelId: string;
  apiKey: string;
}

// Singleton client so we don't recreate it on every render
let _client: StreamChat | null = null;

export function ChatWidget() {
  const { status } = useSession();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [open, setOpen] = React.useState(false);
  const [client, setClient] = React.useState<StreamChat | null>(null);
  const [channel, setChannel] = React.useState<StreamChannel | null>(null);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  const isAuthenticated = status === "authenticated";

  // Connect to Stream on mount (once user is authenticated)
  React.useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    async function connect() {
      try {
        const res = await fetch("/api/chat/token");
        if (!res.ok) return;

        const data: ChatTokenResponse = await res.json();
        if (cancelled) return;

        // Reuse or create the StreamChat singleton
        if (!_client) {
          _client = StreamChat.getInstance(data.apiKey);
        }

        if (!_client.userID) {
          await _client.connectUser({ id: data.userId }, data.token);
        }

        if (cancelled) return;

        const ch = _client.channel("support", data.channelId);
        await ch.watch();

        if (cancelled) return;

        setClient(_client);
        setChannel(ch);

        // Track unread count
        const updateUnread = () => {
          const count = ch.countUnread();
          setUnreadCount(count);
        };

        updateUnread();
        _client.on("message.new", updateUnread);
        _client.on("notification.message_new", updateUnread);
        _client.on("message.read", updateUnread);
      } catch (err) {
        if (!cancelled) {
          setError("Chat is unavailable right now.");
        }
      }
    }

    void connect();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // Clear unread when drawer opens
  React.useEffect(() => {
    if (open && channel) {
      void channel.markRead();
      setUnreadCount(0);
    }
  }, [open, channel]);

  // Listen for navbar chat icon click
  React.useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("spree:open-chat", handler);
    return () => window.removeEventListener("spree:open-chat", handler);
  }, []);

  // Don't render for unauthenticated or loading states
  if (status !== "authenticated") return null;

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

        {/* Stream Chat UI */}
        <Box sx={{ flex: 1, overflow: "hidden", ...streamCssVars }}>
          {error ? (
            <Box
              sx={{
                p: 3,
                textAlign: "center",
                color: "text.secondary",
                mt: 4,
              }}
            >
              <Typography variant="body2">{error}</Typography>
            </Box>
          ) : !client || !channel ? (
            <Box
              sx={{
                p: 3,
                textAlign: "center",
                color: "text.secondary",
                mt: 4,
              }}
            >
              <Typography variant="body2">Connecting to support...</Typography>
            </Box>
          ) : (
            <Chat client={client} theme={isDark ? "str-chat__theme-dark" : "str-chat__theme-light"}>
              <Channel channel={channel}>
                <Window>
                  <MessageList />
                  <MessageComposerUI />
                </Window>
                <Thread />
              </Channel>
            </Chat>
          )}
        </Box>
      </Drawer>
    </>
  );
}
