// Order IDs are formatted "order-<16 hex chars>" (backend/app/services/orders.py).
// Slicing from the end always lands in the random hex portion regardless of
// the literal "order-" prefix's length — slicing from the start (an earlier
// bug) took 6 chars of "order-" plus only 2 random hex chars, a 256-value
// space that collided constantly across a real order list.
export function formatOrderNumber(orderId: string): string {
  return `#${orderId.slice(-8).toUpperCase()}`;
}
