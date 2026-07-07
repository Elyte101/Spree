'use client';

import * as React from "react";
import { useSession } from "next-auth/react";
import { StreamChat, type Channel as StreamChannel } from "stream-chat";
import { fetchChatToken } from "@/lib/chat";

export type ConnectStatus = "idle" | "connecting" | "connected" | "error" | "timeout";

export interface ChatConnectionContextValue {
  client: StreamChat | null;
  channel: StreamChannel | null;
  connectStatus: ConnectStatus;
  errorMsg: string | null;
  unreadCount: number;
  markRead: () => void;
  retry: () => void;
}

const ChatConnectionContext = React.createContext<ChatConnectionContextValue>({
  client: null,
  channel: null,
  connectStatus: "idle",
  errorMsg: null,
  unreadCount: 0,
  markRead: () => {},
  retry: () => {},
});

export function useChatConnection(): ChatConnectionContextValue {
  return React.useContext(ChatConnectionContext);
}

// Singleton Stream client, shared across ChatWidget and ChatPageClient.
let _sharedClient: StreamChat | null = null;

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { status: sessionStatus, data: session } = useSession();
  const [client, setClient] = React.useState<StreamChat | null>(null);
  const [channel, setChannel] = React.useState<StreamChannel | null>(null);
  const [connectStatus, setConnectStatus] = React.useState<ConnectStatus>("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [retryCount, setRetryCount] = React.useState(0);

  const currentUserId = session?.user?.id ?? null;
  const isAdmin = session?.user?.role === "admin";
  const isAuthenticated = sessionStatus === "authenticated";

  // Disconnect and reset on logout or user switch so the next session starts clean.
  const prevUserIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const prevId = prevUserIdRef.current;
    prevUserIdRef.current = currentUserId;
    if (prevId && prevId !== currentUserId && _sharedClient) {
      void _sharedClient.disconnectUser().then(() => { _sharedClient = null; });
      setClient(null);
      setChannel(null);
      setConnectStatus("idle");
      setErrorMsg(null);
      setUnreadCount(0);
    }
  }, [currentUserId]);

  // CH1: connect eagerly on login so the unread badge works before the drawer is opened.
  // Admins connect via their own AdminChatPage — skip them here.
  //
  // IMPORTANT: connectStatus is intentionally NOT in the dependency array.
  // Including it would cancel every in-flight connection attempt when status changes.
  React.useEffect(() => {
    if (!isAuthenticated || isAdmin) return;
    if (connectStatus === "connected") return;

    let cancelled = false;
    let removeListeners: (() => void) | undefined;

    setConnectStatus("connecting");
    setErrorMsg(null);

    (async () => {
      const result = await fetchChatToken(15_000);
      if (cancelled) return;

      if (!result.ok) {
        setConnectStatus(result.reason === "timeout" ? "timeout" : "error");
        setErrorMsg(result.message);
        return;
      }

      try {
        if (!_sharedClient) {
          _sharedClient = StreamChat.getInstance(result.apiKey);
        }
        if (!_sharedClient.userID) {
          await _sharedClient.connectUser({ id: result.userId }, result.token);
        }
        if (cancelled) return;

        const ch = _sharedClient.channel("support", result.channelId);
        await ch.watch();
        if (cancelled) return;

        const updateUnread = () => {
          if (!cancelled) setUnreadCount(ch.countUnread());
        };
        updateUnread();

        // CH6: register listeners once; cleanup removes them precisely (no leak on reconnect).
        _sharedClient.on("message.new", updateUnread);
        _sharedClient.on("notification.message_new", updateUnread);
        _sharedClient.on("message.read", updateUnread);
        _sharedClient.on("notification.mark_read", updateUnread);
        removeListeners = () => {
          _sharedClient?.off("message.new", updateUnread);
          _sharedClient?.off("notification.message_new", updateUnread);
          _sharedClient?.off("message.read", updateUnread);
          _sharedClient?.off("notification.mark_read", updateUnread);
        };

        setClient(_sharedClient);
        setChannel(ch);
        setConnectStatus("connected");
      } catch {
        if (!cancelled) {
          setConnectStatus("error");
          setErrorMsg("Unable to connect to support chat.");
        }
      }
    })();

    return () => {
      cancelled = true;
      removeListeners?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isAdmin, retryCount]); // connectStatus excluded — see comment above

  const markRead = React.useCallback(() => {
    if (channel) {
      void channel.markRead();
      setUnreadCount(0);
    }
  }, [channel]);

  const retry = React.useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  return (
    <ChatConnectionContext.Provider value={{ client, channel, connectStatus, errorMsg, unreadCount, markRead, retry }}>
      {children}
    </ChatConnectionContext.Provider>
  );
}
