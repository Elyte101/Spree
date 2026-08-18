import type { OrderStatus } from "@/types/types";

export type OrderStatusColor = "warning" | "info" | "success" | "error" | "default";

export interface OrderStatusMeta {
  label: string;
  color: OrderStatusColor;
}

interface OrderStatusEntry extends OrderStatusMeta {
  // Vendor-facing wording for the same underlying status, when the
  // buyer-facing label would be misleading from a seller's point of view
  // (e.g. "paid" is a payment receipt to a buyer but an action item — ship
  // it — to a seller). Both describe the exact same state; only the framing
  // differs. Omit to use `label` for both roles.
  vendorLabel?: string;
}

// Single source of truth for order status -> display label + color, shared
// by the buyer order history/detail pages and the vendor orders page — they
// used to keep independent copies of this map, which had already drifted
// (vendorOrdersPage.tsx labeled "paid" as "Awaiting shipment" while the
// buyer pages labeled the identical status "Payment confirmed").
const ORDER_STATUS_META: Record<OrderStatus, OrderStatusEntry> = {
  pending: { label: "Pending payment", color: "warning" },
  pending_payment: { label: "Pending payment", color: "warning" },
  paid: { label: "Payment confirmed", vendorLabel: "Awaiting shipment", color: "warning" },
  in_transit: { label: "In transit", color: "info" },
  delivered: { label: "Delivered", color: "success" },
  confirmed: { label: "Delivery confirmed", color: "success" },
  paid_out: { label: "Payout released", color: "success" },
  cancelled: { label: "Cancelled", color: "error" },
  refunded: { label: "Refunded", color: "error" },
};

// Pre-state-machine statuses that can still exist on old rows — only the
// vendor orders page has historically tolerated these.
const LEGACY_ORDER_STATUS_META: Record<string, OrderStatusMeta> = {
  shipped: { label: "Shipped", color: "info" },
  completed: { label: "Completed", color: "success" },
};

const UNKNOWN_STATUS_META: OrderStatusMeta = { label: "Unknown", color: "default" };

export function getOrderStatusMeta(
  status: string,
  role: "buyer" | "vendor" = "buyer"
): OrderStatusMeta {
  const entry = (ORDER_STATUS_META as Record<string, OrderStatusEntry>)[status];
  if (entry) {
    return { label: role === "vendor" && entry.vendorLabel ? entry.vendorLabel : entry.label, color: entry.color };
  }
  return LEGACY_ORDER_STATUS_META[status] ?? UNKNOWN_STATUS_META;
}
