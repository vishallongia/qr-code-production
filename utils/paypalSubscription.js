const axios = require("axios");

const PAYPAL_BASE = "https://api-m.sandbox.paypal.com"; // sandbox, change to live in prod

// Get OAuth access token
async function getAccessToken() {
  try {
    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString("base64");

    const { data } = await axios.post(
      `${PAYPAL_BASE}/v1/oauth2/token`,
      "grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    return data.access_token;
  } catch (err) {
    console.error(
      "Error getting PayPal access token:",
      err.response?.data || err.message
    );
    throw err;
  }
}

// Updated ensurePaypalPlan to accept an optional token
async function ensurePaypalPlan(plan, currency, token, finalPrice) {
  try {
    if (!token) token = await getAccessToken();
    // Create product if not exists
    if (!plan.gatewayProductId) {
      console.log("Creating PayPal product...");
      const { data: productData } = await axios.post(
        `${PAYPAL_BASE}/v1/catalogs/products`,
        {
          name: plan.name,
          description: plan.description || plan.name,
          type: "SERVICE",
          category: "SOFTWARE",
          id: plan._id.toString(),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      plan.gatewayProductId = productData.id;
      await plan.save();
    }

    // Create new plan if missing
    const priceObj = plan.prices.find((p) => p.currency === currency);

    // Check existing plan
    let paypalPlanId = plan.gatewayPlanIds?.get(currency);
    if (paypalPlanId) return paypalPlanId;

    const { data: planData } = await axios.post(
      `${PAYPAL_BASE}/v1/billing/plans`,
      {
        product_id: plan.gatewayProductId,
        name: `${plan.name} (${currency})`,
        description: plan.description || plan.name,
        billing_cycles: [
          {
            frequency: {
              interval_unit: plan.interval.toUpperCase(),
              interval_count: plan.intervalCount,
            },
            tenure_type: "REGULAR",
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: {
              fixed_price: {
                value: finalPrice.toString(),
                currency_code: currency,
              },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee: { value: "0", currency_code: currency },
          setup_fee_failure_action: "CONTINUE",
          payment_failure_threshold: 3,
        },
        taxes: {
          percentage:
            plan.vatRates
              ?.find((v) => v.currency === currency)
              ?.rate?.toString() || "0",
          inclusive: false,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!plan.gatewayPlanIds) plan.gatewayPlanIds = new Map();
    plan.gatewayPlanIds.set(currency, planData.id);
    await plan.save();

    return planData.id;
  } catch (err) {
    console.error(
      "Error ensuring PayPal plan:",
      err.response?.data || err.message
    );
    throw err;
  }
}

// Updated createSubscription to accept token
async function createSubscription(planId, user, returnUrl, cancelUrl, token) {
  if (!token) token = await getAccessToken();

  const { data } = await axios.post(
    `${PAYPAL_BASE}/v1/billing/subscriptions`,
    {
      plan_id: planId,
      subscriber: {
        name: {
          given_name: user.firstName || user.fullName.split(" ")[0],
          surname: user.lastName || user.fullName.split(" ")[1] || "",
        },
        email_address: user.email,
      },
      application_context: {
        brand_name: "Your App Name",
        user_action: "SUBSCRIBE_NOW",
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  return data;
}

module.exports = { getAccessToken, ensurePaypalPlan, createSubscription };
