import { NextResponse } from "next/server";
import { authorizedBackendFetch } from "@/lib/backend";
import { checkoutUrl, dashboardUrl } from "@/lib/checkout-url";

export async function POST() {
  const meResponse = await authorizedBackendFetch("/auth/me");
  if (!meResponse?.ok) return NextResponse.json({ success: false, error: { message: "Authentication required" } }, { status: 401 });
  const me = (await meResponse.json()).data;
  if (!me || !["buyer", "seller"].includes(me.roleKey)) return NextResponse.json({ success: false, error: { message: "Member account required" } }, { status: 403 });
  const form = me.roleKey === "buyer" ? "buyers" : "sellers";
  const base = (process.env.BACKEND_URL || "http://localhost:8081").replace(/\/$/, "");
  const paymentResponse = await fetch(`${base}/api/v1/market/${form}/registration-status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: me.email }), cache: "no-store" });
  const body = await paymentResponse.json();
  if (!paymentResponse.ok) return NextResponse.json(body, { status: paymentResponse.status });
  if (body.data?.status === "paid") return NextResponse.json({ success: true, data: { status: "paid" } });
  const payment = body.data?.payment;
  if (!payment?.applicationId || !payment?.accessToken) return NextResponse.json({ success: false, error: { message: "No active payment receipt is available" } }, { status: 409 });
  const paymentUrl = checkoutUrl({
    form,
    id: payment.applicationId,
    token: payment.accessToken,
    return_url: dashboardUrl("/dashboard?payment=verified"),
  });
  return NextResponse.json({ success: true, data: { status: "pending_payment", paymentUrl } }, {
    headers: { "Cache-Control": "no-store" },
  });
}
