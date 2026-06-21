/**
 * Mobile-money name-enquiry providers.
 *
 * Active provider is selected by MOMO_PROVIDER env var:
 *   paystack    – uses Paystack /bank/resolve (recommended; reuses PAYSTACK_SECRET_KEY)
 *   flutterwave – uses FLW /v3/accounts/resolve
 *
 * When MOMO_PROVIDER is unset or set to any other value, the endpoint returns
 * { resolved: false } so the UI falls back to manual name entry — no fake names
 * are ever generated.
 *
 * Required env vars:
 *   paystack:    PAYSTACK_SECRET_KEY=sk_live_...   (already used for checkout)
 *   flutterwave: FLUTTERWAVE_SECRET_KEY=FLWSECK_...
 */

const FETCH_TIMEOUT_MS = 8_000;

export interface MomoResolveResult {
  name: string;
}

export interface MomoProvider {
  readonly providerName: string;
  resolve(phoneNumber: string, network: string): Promise<MomoResolveResult>;
}

// ── Network code maps ─────────────────────────────────────────────────────────

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

// ── Not-configured (safe default) ────────────────────────────────────────────

class NotConfiguredProvider implements MomoProvider {
  readonly providerName = "none";

  resolve(): Promise<MomoResolveResult> {
    throw new Error(
      "MoMo name enquiry is not configured. " +
      "Set MOMO_PROVIDER=paystack and PAYSTACK_SECRET_KEY (or MOMO_PROVIDER=flutterwave and FLUTTERWAVE_SECRET_KEY).",
    );
  }
}

// ── Paystack ──────────────────────────────────────────────────────────────────

export class PaystackMomoProvider implements MomoProvider {
  readonly providerName = "paystack";
  constructor(private readonly secretKey: string) {}

  async resolve(phoneNumber: string, network: string): Promise<MomoResolveResult> {
    const bankCode = PAYSTACK_NETWORK[network.toLowerCase()];
    if (!bankCode) throw new Error(`Unsupported network: ${network}`);

    const number = phoneNumber.startsWith("+233") ? "0" + phoneNumber.slice(4) : phoneNumber;

    const url =
      `https://api.paystack.co/bank/resolve` +
      `?account_number=${encodeURIComponent(number)}` +
      `&bank_code=${encodeURIComponent(bankCode)}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.secretKey}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    const data = (await res.json()) as {
      status: boolean;
      message: string;
      data?: { account_number: string; account_name: string };
    };

    if (!data.status || !data.data?.account_name) {
      throw new Error(data.message || "Account not found");
    }
    return { name: data.data.account_name };
  }
}

// ── Flutterwave ───────────────────────────────────────────────────────────────

export class FlutterwaveMomoProvider implements MomoProvider {
  readonly providerName = "flutterwave";
  constructor(private readonly secretKey: string) {}

  async resolve(phoneNumber: string, network: string): Promise<MomoResolveResult> {
    const bankCode = FLW_NETWORK[network.toLowerCase()];
    if (!bankCode) throw new Error(`Unsupported network: ${network}`);

    const number = phoneNumber.startsWith("+233") ? "0" + phoneNumber.slice(4) : phoneNumber;

    const res = await fetch("https://api.flutterwave.com/v3/accounts/resolve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.secretKey}`,
      },
      body: JSON.stringify({ account_number: number, account_bank: bankCode }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    const data = (await res.json()) as {
      status: string;
      message: string;
      data?: { account_number: string; account_name: string };
    };

    if (data.status !== "success" || !data.data?.account_name) {
      throw new Error(data.message || "Account not found");
    }
    return { name: data.data.account_name };
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createMomoProvider(): MomoProvider {
  const providerName = (process.env.MOMO_PROVIDER ?? "").toLowerCase();

  switch (providerName) {
    case "paystack": {
      const key = process.env.PAYSTACK_SECRET_KEY;
      if (!key) throw new Error("MOMO_PROVIDER=paystack but PAYSTACK_SECRET_KEY is not set");
      return new PaystackMomoProvider(key);
    }
    case "flutterwave": {
      const key = process.env.FLUTTERWAVE_SECRET_KEY;
      if (!key) throw new Error("MOMO_PROVIDER=flutterwave but FLUTTERWAVE_SECRET_KEY is not set");
      return new FlutterwaveMomoProvider(key);
    }
    default:
      return new NotConfiguredProvider();
  }
}
