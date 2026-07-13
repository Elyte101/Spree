'use client';

import * as React from "react";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ArrowBackRounded, RefreshRounded } from "@mui/icons-material";

import {
  Chat,
  Channel,
  ChannelHeader,
  ChannelList,
  MessageComposer,
  MessageList,
  Thread,
  Window,
  useChatContext as useStreamChatContext,
} from "stream-chat-react";
import "stream-chat-react/dist/css/index.css";
import { StreamChat } from "stream-chat";

interface AdminTokenResponse {
  token: string;
  userId: string;
  apiKey: string;
}

// Singleton so the admin connection survives re-renders within a session.
let _adminClient: StreamChat | null = null;

// Child component that watches the active channel in Stream context to switch
// mobile view from list → channel pane when the user selects a conversation.
function MobileViewWatcher({ onChannelSelected }: { onChannelSelected: () => void }) {
  const { channel } = useStreamChatContext();
  const prevId = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    if (channel?.id && channel.id !== prevId.current) {
      prevId.current = channel.id;
      onChannelSelected();
    }
  }, [channel?.id, onChannelSelected]);
  return null;
}

export function AdminChatPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  // CH8a: track mobile view so we can show either the list or the channel pane
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileView, setMobileView] = React.useState<"list" | "channel">("list");

  const [client, setClient] = React.useState<StreamChat | null>(null);
  const [adminId, setAdminId] = React.useState<string>("spree-admin");
  const [error, setError] = React.useState<string | null>(null);
  // CH8b: retryCount triggers a fresh connection attempt
  const [retryCount, setRetryCount] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;

    async function connect() {
      setError(null);
      try {
        // CH8c: abort fetch after 15 s
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15_000);
        let res: Response;
        try {
          res = await fetch("/api/chat/admin-token", {
            method: "POST",
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }

        if (!res.ok) {
          if (!cancelled) setError("Failed to get admin chat token.");
          return;
        }
        const data: AdminTokenResponse = await res.json();
        if (cancelled) return;

        if (!_adminClient) {
          _adminClient = StreamChat.getInstance(data.apiKey);
        }
        if (!_adminClient.userID) {
          await _adminClient.connectUser({ id: data.userId }, data.token);
        }
        if (!cancelled) {
          setAdminId(data.userId);
          setClient(_adminClient);
        }
      } catch {
        if (!cancelled) setError("Chat is unavailable right now.");
      }
    }

    void connect();

    // CH8e: disconnect on unmount — null the ref immediately so a retry sees a clean slate.
    // Update state first so React unmounts the Stream components (Chat/Channel/
    // MessageComposer) that reference this client. Their cleanup effects
    // (messageComposer.clear(), which reads channel.getConfig()) must run while
    // the client is still connected, otherwise Stream throws "can't use channel
    // after client.disconnect()" — deferring disconnectUser() to the next
    // macrotask (after React's passive effect cleanups have fired) prevents
    // that error. Same pattern as chatProvider.tsx's user-switch effect.
    return () => {
      cancelled = true;
      const clientToDisconnect = _adminClient;
      _adminClient = null;
      setClient(null);
      if (clientToDisconnect) setTimeout(() => void clientToDisconnect.disconnectUser(), 0);
    };
  }, [retryCount]);

  const handleChannelSelected = React.useCallback(() => {
    if (isMobile) setMobileView("channel");
  }, [isMobile]);

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

  // CH8g: filter by members so only channels this admin belongs to appear
  const filters = { type: "support", members: { $in: [adminId] } };
  const sort = { last_message_at: -1 as const };

  if (error) {
    return (
      <Paper
        elevation={0}
        sx={(t) => ({
          p: 4,
          borderRadius: 2,
          border: "1px solid",
          borderColor: t.palette.divider,
          textAlign: "center",
        })}
      >
        <Typography color="text.secondary" mb={2}>{error}</Typography>
        {/* CH8b: retry button */}
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshRounded />}
          onClick={() => setRetryCount((c) => c + 1)}
          sx={{ borderColor: "#655AFF", color: "#655AFF" }}
        >
          Retry
        </Button>
      </Paper>
    );
  }

  if (!client) {
    return (
      <Paper
        elevation={0}
        sx={(t) => ({
          p: 4,
          borderRadius: 2,
          border: "1px solid",
          borderColor: t.palette.divider,
          textAlign: "center",
        })}
      >
        <Stack alignItems="center" spacing={1.5}>
          <CircularProgress size={28} sx={{ color: "#655AFF" }} />
          <Typography color="text.secondary">Connecting to chat...</Typography>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={(t) => ({
        borderRadius: 2,
        border: "1px solid",
        borderColor: t.palette.divider,
        overflow: "hidden",
        height: "calc(100vh - 220px)",
        minHeight: 480,
        ...streamCssVars,
      })}
    >
      <Chat
        client={client}
        theme={isDark ? "str-chat__theme-dark" : "str-chat__theme-light"}
      >
        {/* CH8a: watch active channel to switch mobile view */}
        <MobileViewWatcher onChannelSelected={handleChannelSelected} />

        <Box
          sx={{
            display: "grid",
            // CH8a: on mobile, show only one panel at a time
            gridTemplateColumns: isMobile ? "1fr" : "300px 1fr",
            height: "100%",
            overflow: "hidden",
          }}
        >
          {/* Channel list — always rendered; hidden on mobile when viewing a channel */}
          <Box
            sx={{
              borderRight: isMobile ? "none" : "1px solid",
              borderColor: isDark ? "rgba(101,90,255,0.14)" : "rgba(101,90,255,0.10)",
              overflow: "hidden",
              display: isMobile && mobileView === "channel" ? "none" : "flex",
              flexDirection: "column",
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 1.5,
                borderBottom: "1px solid",
                borderColor: isDark ? "rgba(101,90,255,0.14)" : "rgba(101,90,255,0.10)",
                backgroundColor: alpha("#655AFF", isDark ? 0.12 : 0.06),
                flexShrink: 0,
              }}
            >
              <Typography variant="subtitle2" fontWeight={900}>
                Support Conversations
              </Typography>
            </Box>
            <Box sx={{ flex: 1, overflow: "hidden" }}>
              <ChannelList filters={filters} sort={sort} />
            </Box>
          </Box>

          {/* Active channel — hidden on mobile when viewing the list */}
          <Box
            sx={{
              overflow: "hidden",
              display: isMobile && mobileView === "list" ? "none" : "flex",
              flexDirection: "column",
            }}
          >
            {/* CH8a: back button for mobile */}
            {isMobile && mobileView === "channel" && (
              <Box
                sx={{
                  px: 1,
                  py: 0.5,
                  borderBottom: "1px solid",
                  borderColor: isDark ? "rgba(101,90,255,0.14)" : "rgba(101,90,255,0.10)",
                  backgroundColor: alpha("#655AFF", isDark ? 0.08 : 0.04),
                  flexShrink: 0,
                }}
              >
                <IconButton
                  size="small"
                  onClick={() => setMobileView("list")}
                  aria-label="Back to conversations"
                  sx={{ color: "primary.main" }}
                >
                  <ArrowBackRounded fontSize="small" />
                </IconButton>
              </Box>
            )}
            <Box sx={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <Channel>
                <Window>
                  <ChannelHeader />
                  <MessageList />
                  <MessageComposer audioRecordingEnabled={false} />
                </Window>
                <Thread />
              </Channel>
            </Box>
          </Box>
        </Box>
      </Chat>
    </Paper>
  );
}
