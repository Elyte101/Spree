'use client';

import { useChatConnection } from "@/components/providers/chatProvider";

/**
 * Returns the current unread message count for the authenticated user.
 * Reads from the shared ChatProvider connection — no private Stream APIs needed.
 * Returns 0 when not connected or unauthenticated.
 */
export function useChatUnread(): number {
  return useChatConnection().unreadCount;
}
