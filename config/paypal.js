const checkoutNodeJssdk = require("@paypal/checkout-server-sdk");

function environment() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const mode = process.env.PAYPAL_MODE || "sandbox"; // 'sandbox' or 'live'

  console.log(mode);
  if (mode.toLowerCase().trim() === "live") {
    return new checkoutNodeJssdk.core.LiveEnvironment(clientId, clientSecret);
  } else {
    return new checkoutNodeJssdk.core.SandboxEnvironment(
      clientId,
      clientSecret
    );
  }
}

function client() {
  return new checkoutNodeJssdk.core.PayPalHttpClient(environment());
}

module.exports = { client };
