'use client';

import * as React from "react";
import { Box, Typography } from "@mui/material";
import { ChatBubbleRounded } from "@mui/icons-material";

interface State {
  hasError: boolean;
}

export class ChatErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ChatErrorBoundary]", error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            position: "fixed",
            bottom: { xs: 20, sm: 28 },
            right: { xs: 20, sm: 28 },
            zIndex: 1200,
            width: 56,
            height: 56,
            borderRadius: "50%",
            backgroundColor: "action.disabledBackground",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Chat is currently unavailable"
          aria-label="Chat unavailable"
        >
          <ChatBubbleRounded sx={{ color: "action.disabled", fontSize: 22 }} />
        </Box>
      );
    }
    return this.props.children;
  }
}
