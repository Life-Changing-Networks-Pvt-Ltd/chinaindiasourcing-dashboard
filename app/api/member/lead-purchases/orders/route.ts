import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizedBackendFetch } from "@/lib/backend";
import { checkoutUrl, dashboardUrl } from "@/lib/checkout-url";

export async function POST(request: Request) {
  const secret = process.env.CIS_LEAD_CHECKOUT_SECRET;
  if (!secret) {
    return NextResponse.json({ success: false, error: { message: "Lead checkout is unavailable" } }, { status: 503 });
  }

  const response = await authorizedBackendFetch("/member/lead-purchases/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(await request.json()),
  });
  if (!response) return NextResponse.json({ success: false }, { status: 401 });

  const body = await response.json();
  if (!response.ok || body.data?.alreadyPurchased) {
    return NextResponse.json(body, { status: response.status });
  }

  const { key, orderId, amount, currency, pricing } = body.data;
  const payload = Buffer.from(JSON.stringify({
    key, orderId, amount, currency, pricing,
    returnUrl: dashboardUrl("/explore-buyers"),
    expiresAt: Date.now() + 30 * 60 * 1000,
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  const paymentUrl = checkoutUrl({ lead: `${payload}.${signature}` });
  return NextResponse.json({ success: true, data: { paymentUrl, orderId } }, {
    status: response.status,
    headers: { "Cache-Control": "no-store" },
  });
}
