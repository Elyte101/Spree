# Chat/Messaging System Audit — 2026-07-07

Scope: ChatWidget, ChatPageClient, AdminChatPage, useChatUnread, storeAppBar chat entry points, /chat + /dashboard/chat pages, Next API chat routes, backend chat.py (tokens + Stream webhook + AI reply).

## Critical / functional breakage

### CH1 — Unread badge system doesn't work at all until chat is manually opened
Two compounding problems:
- `ChatWidget` only connects to Stream when the drawer is **opened**. Until then there is no client, no socket, no events.
- `useChatUnread` (navbar badge) runs **once**, 1 second after mount, grabs the Stream singleton via the **private `_instances` API**, and silently gives up if no client exists yet — it never re-checks. Since the widget hasn't connected at that point, the badge is permanently 0 for every user who hasn't opened the chat drawer in the current page session.
Net effect: a buyer who gets an admin/AI reply while browsing (or after returning to the site) sees no badge anywhere and misses it.
**Fix:** connect the Stream client eagerly on login (once, app-level — e.g. a small ChatProvider in layout), have both the widget and the hook consume that shared connection via public APIs, and drop the `_instances` hack and the 1 s timeout.

### CH2 — `/chat` page redirects unauthenticated users to a 404
`app/chat/page.tsx`: `redirect("/login?next=/chat")` — there is no `/login` route (sign-in lives at `/auth/sign-in` and expects `callbackUrl`). Guests clicking Support Chat land on a 404.
**Fix:** `redirect("/auth/sign-in?callbackUrl=/chat")`.

### CH3 — AI auto-reply may never run on Vercel (BackgroundTasks after response)
`stream_webhook` schedules `_post_ai_reply` via FastAPI `BackgroundTasks`, which runs **after** the response is sent. On Vercel serverless the function may be frozen/terminated as soon as the response returns — the AI reply silently never posts in production. Same serverless class of bug as C4 from the main audit.
**Fix:** run the reply inline before returning (Stream tolerates a few seconds; keep the message-id dedup), or use a durable mechanism (queue table + cron). Verify on the deployed environment.

### CH4 — Webhook AI reply not restricted to support channels
`_post_ai_reply` posts to whatever `channel_type`/`channel_id` the event carries. Signature verification makes forgery hard, but any future channel type (or Stream dashboard test events) will get bot replies.
**Fix:** early-return unless `channel_type == "support"` and `channel_id.startswith("support-")`, and ignore senders who aren't the channel owner (`sender_id != channel_id.removeprefix("support-")`).

## High

### CH5 — No notification bridge: offline users never learn about replies
Spree has a full notifications service (in-app + email via Resend) but chat is completely disconnected from it. If a user is offline when the admin/AI replies, nothing tells them — no in-app notification, no email. Conversely, the admin only gets a dev-notifier email for the *first* message of a channel; subsequent user messages while no admin is watching go nowhere.
**Fix:** in the Stream webhook, when the recipient isn't currently online/watching, call `notify_safe` (event_type e.g. "chat_reply" for the user; "chat_message_admin" for admin) respecting notification preferences.

### CH6 — Widget event listeners leak and duplicate on every reconnect
`ChatWidget` calls `_client.on("message.new", updateUnread)` etc. inside `connect()` with no matching `.off()` — every retry/user-switch/reopen adds another handler bound to a stale `ch` closure. Unread counts fire multiple times and reference dead channels.
**Fix:** register listeners once per established connection and clean them up in the effect cleanup / disconnect path.

### CH7 — No AI/webhook rate limiting — chat spam burns Anthropic credits
Every user message triggers a Claude call (dedup only covers webhook retries). A user (or script with a valid session) sending 100 messages gets 100 Claude calls. Rate-limit AI replies per channel (e.g. max 1 per N seconds, max M per hour) using the DB-backed `RateLimitEvent` mechanism from C4. Also skip AI when message text is empty (attachment-only messages currently still call Claude with blank content appended).

### CH8 — Admin chat page: no channel list on mobile, no retry, shared identity
`AdminChatPage`: (a) the channel list is `display:none` below `md`, and `<Channel>` has no fallback channel — mobile admins see an empty pane with no way to select a conversation; (b) on error there's no retry button (widget has one); (c) fetch has no timeout; (d) all admins connect as the single shared `spree-admin` user — no per-admin attribution in replies; (e) `_adminClient` singleton is never disconnected on unmount/logout; (f) `catch (err)` unused-var lint warning; (g) `ChannelList` filter `{type:"support"}` should also filter `members: {$in: [adminId]}` for correctness under Stream permissions.

## Medium

### CH9 — Widget is shown to admins and AI replies to the admin's own support channel
An admin browsing the storefront gets the FAB widget, opens `support-<adminUserId>` (their own "support ticket"), and the AI bot replies to them (the skip-check only matches the shared Stream admin id `spree-admin`, not the admin's real user id). Hide the widget for `role === "admin"` (they have /dashboard/chat) or skip AI for admin-role senders.

### CH10 — Widget FAB overlaps the /chat page
On `/chat` (and `/dashboard/chat`), the globally-mounted widget FAB floats over the full-page chat — two chat UIs for the same channel on one screen. Hide the FAB on chat routes.

### CH11 — First-message check does a synchronous Stream query on every message
The dev-notification block queries channel history inline in the webhook for **every** user message just to detect "first message" — added latency before the 200 response. Move it into the background/AI task, or use Stream's `channel.created` event instead.

### CH12 — Dead import + dedup set wipe
`_post_ai_reply` has `import json as _json  # noqa: F401` (unused, self-admitted). `_processed_message_ids.clear()` at 1000 entries wipes the entire dedup memory at once (momentary duplicate window) — use an LRU/deque trim instead. Cosmetic.

### CH13 — AI conversation history capped at 10-message window with 8 used
Fine for now, but the system prompt embeds only the user id — the bot can't answer "where is my order" even though the data exists. Optional enhancement: give the bot the user's recent orders (status, tracking) in the system prompt, fetched server-side by `user_id_from_channel`. Big support-quality win, zero UI work.

### CH14 — External config dependencies undocumented
Chat requires: Stream app with `support` channel type + permissions, `STREAM_API_KEY/SECRET`, `STREAM_WEBHOOK_SECRET`, webhook URL pointed at `<backend>/webhooks/stream`, `ANTHROPIC_API_KEY`, `STREAM_ADMIN_USER_ID`. None of this is in README/`.env.example` beyond the bare vars. Document the setup checklist; add all keys to both `.env.example` files.

## Verified OK
Token endpoints properly gated (internal key + actor headers, admin role check); webhook fail-closed in production (C6); HMAC compare_digest; channel membership strictly user+admin; M1 disconnect-on-user-switch in widget; M2 real display names; buyer↔seller DMs impossible by construction (G25); admin page gated server-side by role; CSS/theming consistent.
