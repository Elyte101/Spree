import { describe, it, expect } from "vitest";
import { calcCommission } from "./pricing";

describe("calcCommission — marginal brackets", () => {
  it("returns zeroes for non-positive payout", () => {
    expect(calcCommission(0)).toMatchObject({ commission: 0, effectiveRate: 0, customerPays: 0 });
    expect(calcCommission(-100)).toMatchObject({ commission: 0, effectiveRate: 0, customerPays: 0 });
  });

  it("applies 8% flat within first bracket (≤ 500)", () => {
    expect(calcCommission(100).commission).toBe(8);
    expect(calcCommission(500).commission).toBe(40);
    expect(calcCommission(500).customerPays).toBe(540);
  });

  it("uses marginal brackets correctly at bracket edges", () => {
    // 500*8% + 500*5% = 40 + 25 = 65
    expect(calcCommission(1000).commission).toBe(65);
    // 500*8% + 1500*5% = 40 + 75 = 115
    expect(calcCommission(2000).commission).toBe(115);
    // 500*8% + 1500*5% + 1000*3% = 40 + 75 + 30 = 145
    expect(calcCommission(3000).commission).toBe(145);
    // 500*8% + 1500*5% + 3000*3% = 40 + 75 + 90 = 205
    expect(calcCommission(5000).commission).toBe(205);
    // 500*8% + 1500*5% + 3000*3% + 1000*1% = 40+75+90+10 = 215
    expect(calcCommission(6000).commission).toBe(215);
  });

  it("customerPays = payout + commission", () => {
    for (const p of [1, 100, 499, 500, 501, 1999, 2000, 2001, 4999, 5000, 5001, 8000]) {
      const { commission, customerPays } = calcCommission(p);
      expect(customerPays).toBeCloseTo(p + commission, 10);
    }
  });

  it("fixes the old tier-boundary exploit: payout 2000 vs 2038", () => {
    // With flat tiers, payout=2038 used to yield lower customerPays than payout=2000.
    const r2000 = calcCommission(2000);
    const r2038 = calcCommission(2038);
    expect(r2038.commission).toBeGreaterThan(r2000.commission);
    expect(r2038.customerPays).toBeGreaterThan(r2000.customerPays);
  });

  it("fixes exploit at 500-boundary (payout 500 vs 501)", () => {
    const r500 = calcCommission(500);
    const r501 = calcCommission(501);
    expect(r501.commission).toBeGreaterThan(r500.commission);
    expect(r501.customerPays).toBeGreaterThan(r500.customerPays);
  });

  it("fixes exploit at 5000-boundary (payout 5000 vs 5001)", () => {
    const r5000 = calcCommission(5000);
    const r5001 = calcCommission(5001);
    expect(r5001.commission).toBeGreaterThan(r5000.commission);
    expect(r5001.customerPays).toBeGreaterThan(r5000.customerPays);
  });

  it("commission and customerPays are strictly monotonically increasing for payouts 1–6000", () => {
    let prevCommission = -Infinity;
    let prevCustomerPays = -Infinity;
    for (let payout = 1; payout <= 6000; payout++) {
      const { commission, customerPays } = calcCommission(payout);
      expect(commission).toBeGreaterThanOrEqual(prevCommission);
      expect(customerPays).toBeGreaterThan(prevCustomerPays);
      prevCommission = commission;
      prevCustomerPays = customerPays;
    }
  });
});
