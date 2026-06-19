export const PROCESSING_FEE_RATE = 0.015;

export function calcProcessingFee(subtotal: number): number {
  return Math.round(subtotal * PROCESSING_FEE_RATE * 100) / 100;
}

const BRACKETS = [
  { upTo: 500,      rate: 0.08 },
  { upTo: 2000,     rate: 0.05 },
  { upTo: 5000,     rate: 0.03 },
  { upTo: Infinity, rate: 0.01 },
] as const;

export interface CommissionResult {
  commission: number;
  effectiveRate: number;
  customerPays: number;
}

export function calcCommission(payout: number): CommissionResult {
  if (!(payout > 0)) return { commission: 0, effectiveRate: 0, customerPays: 0 };
  let total = 0;
  let prev = 0;
  for (const b of BRACKETS) {
    if (payout <= prev) break;
    const slice = Math.min(payout, b.upTo) - prev;
    total += slice * b.rate;
    prev = b.upTo;
  }
  const commission = Math.round(total * 100) / 100;
  return {
    commission,
    effectiveRate: commission / payout,
    customerPays: Math.round((payout + commission) * 100) / 100,
  };
}
