'use client';

import * as React from "react";

/**
 * Returns the current total unread chat message count for the authenticated user.
 * Reads from the StreamChat singleton that ChatWidget creates.
 *
 * Returns 0 if Stream Chat is not yet connected (e.g. widget not mounted yet,
 * or user is unauthenticated).
 */
export function useChatUnread(): number {
  const [unread, setUnread] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    async function subscribe() {
      try {
        const { StreamChat } = await import("stream-chat");
        // StreamChat maintains a global singleton registry keyed by API key.
        // We access it via the static _instances map; if no client exists yet,
        // the import will have no effect and we simply return 0.
        const instances = (StreamChat as unknown as { _instances?: Map<string, InstanceType<typeof StreamChat>> })._instances;
        if (!instances || instances.size === 0) return;

        const client = instances.values().next().value;
        if (!client || !client.userID) return;

        const updateCount = () => {
          if (cancelled) return;
          const total = Object.values(client.activeChannels as Record<string, { countUnread: () => number }>).reduce(
            (acc, ch) => acc + (ch.countUnread() ?? 0),
            0
          );
          setUnread(total);
        };

        updateCount();
        client.on("message.new", updateCount);
        client.on("notification.message_new", updateCount);
        client.on("message.read", updateCount);
        client.on("notification.mark_read", updateCount);

        cleanup = () => {
          client.off("message.new", updateCount);
          client.off("notification.message_new", updateCount);
          client.off("message.read", updateCount);
          client.off("notification.mark_read", updateCount);
        };
      } catch {
        // Stream not configured or not yet connected — silently no-op.
      }
    }

    // Delay slightly so ChatWidget has time to connect first
    const timer = setTimeout(() => { void subscribe(); }, 1000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      cleanup?.();
    };
  }, []);

  return unread;
}
