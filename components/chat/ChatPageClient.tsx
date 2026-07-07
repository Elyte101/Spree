'use client';

import * as React from "react";
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import {
  Chat,
  Channel,
  MessageComposerUI,
  MessageList,
  Thread,
  Window,
} from "stream-chat-react";
import "stream-chat-react/dist/css/index.css";
import { ChatBubbleRounded, RefreshRounded } from "@mui/icons-material";

import { useChatConnection } from "@/components/providers/chatProvider";

export function ChatPageClient() {
  const { client, channel, connectStatus, errorMsg, retry } = useChatConnection();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const loading = connectStatus === "idle" || connectStatus === "connecting";
  const hasError = connectStatus === "error" || connectStatus === "timeout";

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
    <Box
      sx={{
        maxWidth: 800,
        mx: "auto",
        px: { xs: 2, sm: 3 },
        py: { xs: 3, sm: 4 },
        height: "calc(100vh - 72px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5} mb={2} flexShrink={0}>
        <ChatBubbleRounded sx={{ color: "primary.main" }} />
        <Box>
          <Typography variant="h5" fontWeight={900}>Spree Support</Typography>
          <Typography variant="body2" color="text.secondary">
            We typically reply within a few hours
          </Typography>
        </Box>
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0, borderRadius: 2, overflow: "hidden", border: "1px solid", borderColor: "divider", ...streamCssVars }}>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" height="100%" spacing={1.5}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">Connecting to support…</Typography>
          </Stack>
        ) : hasError ? (
          <Stack alignItems="center" justifyContent="center" height="100%" spacing={2} p={3}>
            <Typography variant="body2" color="text.secondary" textAlign="center">
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
        ) : client && channel ? (
          <Chat client={client} theme={isDark ? "str-chat__theme-dark" : "str-chat__theme-light"}>
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
    </Box>
  );
}
