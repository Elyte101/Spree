/**
 * Mobile-money name-enquiry providers.
 *
 * Active provider is selected by MOMO_PROVIDER env var:
 *   mock        – returns a fake name (default; safe for dev with no credentials)
 *   flutterwave – uses FLW /v3/accounts/resolve (recommended for Ghana)
 *   paystack    – uses Paystack /bank/resolve
 *
 * Required env vars per provider:
 *   mock:        none
 *   flutterwave: FLUTTERWAVE_SECRET_KEY=FLWSECK_...
 *   paystack:    PAYSTACK_SECRET_KEY=sk_live_...    (already used for checkout)
 */

export interface MomoResolveResult {
  name: string;
}

export interface MomoProvider {
  readonly providerName: string;
  resolve(phoneNumber: string, network: string): Promise<MomoResolveResult>;
}

// ── Network code maps ─────────────────────────────────────────────────────────
// Keys are our internal MOMO_NETWORKS values (mtn / telecel / airteltigo).

const FLW_NETWORK: Record<string, string> = {
  mtn: "MTN",
  telecel: "VDF",
  airteltigo: "ATL",
};

const PAYSTACK_NETWORK: Record<string, string> = {
  mtn: "MTN",
  telecel: "VOD",
  airteltigo: "ATL",
};

// ── Mock (dev / no credentials) ───────────────────────────────────────────────

export class MockMomoProvider implements MomoProvider {
  readonly providerName = "mock";

  async resolve(phoneNumber: string): Promise<MomoResolveResult> {
    await new Promise((r) => setTimeout(r, 700));
    const seed = parseInt(phoneNumber.slice(-2), 10) % 6;
    const names = ["Kofi Mensah", "Ama Asante", "Kwame Boateng", "Akosua Adom", "Yaw Darko", "Abena Owusu"];
    return { name: names[seed] };
  }
}

// ── Flutterwave ───────────────────────────────────────────────────────────────

export class FlutterwaveMomoProvider implements MomoProvider {
  readonly providerName = "flutterwave";
  constructor(private readonly secretKey: string) {}

  async resolve(phoneNumber: string, network: string): Promise<MomoResolveResult> {
    const bankCode = FLW_NETWORK[network.toLowerCase()];
    if (!bankCode) throw new Error(`Unsupported network for Flutterwave: ${network}`);

    const number = phoneNumber.startsWith("+233") ? "0" + phoneNumber.slice(4) : phoneNumber;

    const res = await fetch("https://api.flutterwave.com/v3/accounts/resolve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.secretKey}`,
      },
      body: JSON.stringify({ account_number: number, account_bank: bankCode }),
    });

    const data = (await res.json()) as {
      status: string;
      message: string;
      data?: { account_number: string; account_name: string };
    };

    if (data.status !== "success" || !data.data?.account_name) {
      throw new Error(data.message || "Name enquiry failed");
    }
    return { name: data.data.account_name };
  }
}

// ── Paystack ──────────────────────────────────────────────────────────────────

export class PaystackMomoProvider implements MomoProvider {
  readonly providerName = "paystack";
  constructor(private readonly secretKey: string) {}

  async resolve(phoneNumber: string, network: string): Promise<MomoResolveResult> {
    const bankCode = PAYSTACK_NETWORK[network.toLowerCase()];
    if (!bankCode) throw new Error(`Unsupported network for Paystack: ${network}`);

    const number = phoneNumber.startsWith("+233") ? "0" + phoneNumber.slice(4) : phoneNumber;

    const url = `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(number)}&bank_code=${encodeURIComponent(bankCode)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.secretKey}` },
    });

    const data = (await res.json()) as {
      status: boolean;
      message: string;
      data?: { account_number: string; account_name: string };
    };

    if (!data.status || !data.data?.account_name) {
      throw new Error(data.message || "Name enquiry failed");
    }
    return { name: data.data.account_name };
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createMomoProvider(): MomoProvider {
  const providerName = (process.env.MOMO_PROVIDER ?? "mock").toLowerCase();

  switch (providerName) {
    case "flutterwave": {
      const key = process.env.FLUTTERWAVE_SECRET_KEY;
      if (!key) throw new Error("MOMO_PROVIDER=flutterwave but FLUTTERWAVE_SECRET_KEY is not set");
      return new FlutterwaveMomoProvider(key);
    }
    case "paystack": {
      const key = process.env.PAYSTACK_SECRET_KEY;
      if (!key) throw new Error("MOMO_PROVIDER=paystack but PAYSTACK_SECRET_KEY is not set");
      return new PaystackMomoProvider(key);
    }
    case "mock":
    default:
      return new MockMomoProvider();
  }
}
