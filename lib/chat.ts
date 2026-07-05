export interface ChatTokenPayload {
  token: string;
  userId: string;
  channelId: string;
  apiKey: string;
}

export type ChatConnectResult =
  | ({ ok: true } & ChatTokenPayload)
  | { ok: false; reason: "timeout" | "server_error" | "network_error"; message: string };

export async function fetchChatToken(timeoutMs = 15_000): Promise<ChatConnectResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("/api/chat/token", { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      let message = "Chat is unavailable right now. Please try again later.";
      try {
        const body = await res.json();
        if (typeof body?.detail === "string") message = body.detail;
      } catch {
        // body not JSON — use default message
      }
      return { ok: false, reason: "server_error", message };
    }

    const data: ChatTokenPayload = await res.json();
    return { ok: true, ...data };
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error)?.name === "AbortError") {
      return {
        ok: false,
        reason: "timeout",
        message:
          "Connection timed out. Please check your internet connection and try again.",
      };
    }
    return {
      ok: false,
      reason: "network_error",
      message: "Unable to reach support chat. Please check your connection.",
    };
  }
}
