import { createHmac } from "crypto";
import { randomUUID } from "crypto";

const SANDBOX_BASE = "https://api.sandbox.paynow.pl";
const PRODUCTION_BASE = "https://api.paynow.pl";

function getBaseUrl(): string {
  return process.env.PAYNOW_SANDBOX !== "false"
    ? SANDBOX_BASE
    : PRODUCTION_BASE;
}

function getApiKey(): string {
  const key = process.env.PAYNOW_API_KEY;
  if (!key) throw new Error("PAYNOW_API_KEY environment variable is required");
  return key;
}

function getSignatureKey(): string {
  const key = process.env.PAYNOW_SIGNATURE_KEY;
  if (!key)
    throw new Error("PAYNOW_SIGNATURE_KEY environment variable is required");
  return key;
}

/**
 * Calculate PayNow HMAC-SHA256 signature for outgoing payment requests.
 * The signature covers: headers (Api-Key + Idempotency-Key, alphabetical),
 * parameters (empty map), and the JSON-encoded request body.
 */
function calculateRequestSignature(
  apiKey: string,
  idempotencyKey: string,
  body: object,
): string {
  const signatureKey = getSignatureKey();
  const payload = JSON.stringify({
    headers: { "Api-Key": apiKey, "Idempotency-Key": idempotencyKey },
    parameters: {},
    body: JSON.stringify(body),
  });
  return createHmac("sha256", signatureKey).update(payload).digest("base64");
}

/**
 * Verify the HMAC-SHA256 signature of an incoming PayNow notification webhook.
 * PayNow signs the raw request body with your Signature-Key.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
): boolean {
  const signatureKey = getSignatureKey();
  const expected = createHmac("sha256", signatureKey)
    .update(rawBody)
    .digest("base64");
  // Constant-time comparison to prevent timing attacks
  if (expected.length !== signatureHeader.length) return false;
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);
  if (expectedBuf.length !== actualBuf.length) return false;
  let diff = 0;
  for (let i = 0; i < expectedBuf.length; i++) {
    diff |= expectedBuf[i] ^ actualBuf[i];
  }
  return diff === 0;
}

export interface CreatePaymentParams {
  amount: number; // in grosz (1 PLN = 100 grosz)
  externalId: string; // your internal order/user id
  description: string;
  buyerEmail: string;
  continueUrl: string;
  /** BCP-47 locale for the PayNow checkout page, e.g. 'pl', 'en', 'uk' */
  locale?: string;
}

export interface CreatePaymentResult {
  redirectUrl: string;
  paymentId: string;
  status: string;
}

/**
 * Create a payment in PayNow and return the redirect URL to send the user to.
 */
export async function createPaynowPayment(
  params: CreatePaymentParams,
): Promise<CreatePaymentResult> {
  const apiKey = getApiKey();
  const idempotencyKey = randomUUID();
  const baseUrl = getBaseUrl();

  const body = {
    amount: params.amount,
    currency: "PLN",
    externalId: params.externalId,
    description: params.description,
    continueUrl: params.continueUrl,
    buyer: {
      email: params.buyerEmail,
      ...(params.locale ? { locale: params.locale } : {}),
    },
    validityTime: 900, // 15 minutes
  };

  const signature = calculateRequestSignature(apiKey, idempotencyKey, body);

  const response = await fetch(`${baseUrl}/v3/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Api-Key": apiKey,
      Signature: signature,
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `PayNow payment creation failed (${response.status}): ${errorText}`,
    );
  }

  const data = await response.json();
  return {
    redirectUrl: data.redirectUrl,
    paymentId: data.paymentId,
    status: data.status,
  };
}

export function getPaymentAmount(): number {
  const raw = process.env.PAYNOW_AMOUNT
  const parsed = raw ? parseInt(raw, 10) : NaN
  return isNaN(parsed) ? 199900 : parsed
}

/**
 * Check the current status of a PayNow payment.
 * For GET requests the body is an empty string in the signature.
 */
export async function checkPaymentStatus(
  paymentId: string,
): Promise<{ paymentId: string; status: string }> {
  const apiKey = getApiKey();
  const idempotencyKey = randomUUID();
  const baseUrl = getBaseUrl();

  // GET request: sign with empty body string
  const signatureKey = getSignatureKey();
  const signaturePayload = JSON.stringify({
    headers: { "Api-Key": apiKey, "Idempotency-Key": idempotencyKey },
    parameters: {},
    body: "",
  });
  const signature = createHmac("sha256", signatureKey)
    .update(signaturePayload)
    .digest("base64");

  const response = await fetch(`${baseUrl}/v3/payments/${paymentId}/status`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Api-Key": apiKey,
      Signature: signature,
      "Idempotency-Key": idempotencyKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `PayNow status check failed (${response.status}): ${errorText}`,
    );
  }

  const data = await response.json();
  return { paymentId: data.paymentId ?? paymentId, status: data.status };
}
