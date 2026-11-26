export function checkoutUrl(params: Record<string, string>) {
  const url = new URL(
    "/payments/chinaindiasourcing",
    process.env.SELLERSLOGIN_PAYMENT_ORIGIN || "https://sellerslogin.com",
  );
  url.hash = new URLSearchParams(params).toString();
  return url.href;
}

export function dashboardUrl(path: string) {
  return new URL(path, process.env.CIS_DASHBOARD_URL || "http://localhost:3002").href;
}
