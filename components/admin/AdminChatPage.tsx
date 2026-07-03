'use client';

import * as React from "react";
import {
  Box,
  Paper,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import {
  Chat,
  Channel,
  ChannelHeader,
  ChannelList,
  MessageComposerUI,
  MessageList,
  Thread,
  Window,
} from "stream-chat-react";
import "stream-chat-react/dist/css/index.css";
import { StreamChat, type Channel as StreamChannel } from "stream-chat";

interface AdminTokenResponse {
  token: string;
  userId: string;
  apiKey: string;
}

let _adminClient: StreamChat | null = null;

export function AdminChatPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [client, setClient] = React.useState<StreamChat | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        const res = await fetch("/api/chat/admin-token", { method: "POST" });
        if (!res.ok) {
          setError("Failed to get admin chat token.");
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
          setClient(_adminClient);
        }
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
  }, []);

  // Stream CSS variable overrides to match Spree palette
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

  const filters = { type: "support" };
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
        <Typography color="text.secondary">{error}</Typography>
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
        <Typography color="text.secondary">Connecting to chat...</Typography>
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
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "300px 1fr" },
            height: "100%",
            overflow: "hidden",
          }}
        >
          {/* Channel list */}
          <Box
            sx={{
              borderRight: "1px solid",
              borderColor: isDark ? "rgba(101,90,255,0.14)" : "rgba(101,90,255,0.10)",
              overflow: "hidden",
              display: { xs: "none", md: "block" },
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 1.5,
                borderBottom: "1px solid",
                borderColor: isDark ? "rgba(101,90,255,0.14)" : "rgba(101,90,255,0.10)",
                backgroundColor: alpha("#655AFF", isDark ? 0.12 : 0.06),
              }}
            >
              <Typography variant="subtitle2" fontWeight={900}>
                Support Conversations
              </Typography>
            </Box>
            <ChannelList filters={filters} sort={sort} />
          </Box>

          {/* Active channel */}
          <Box sx={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <Channel>
              <Window>
                <ChannelHeader />
                <MessageList />
                <MessageComposerUI />
              </Window>
              <Thread />
            </Channel>
          </Box>
        </Box>
      </Chat>
    </Paper>
  );
}
