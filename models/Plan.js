const mongoose = require("mongoose");

const planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  publicName: {
    type: String,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },

  // Recurring related fields
  recurring: {
    type: Boolean,
    default: false,
  },
  interval: {
    type: String,
    enum: ["day", "week", "month", "year"],
    default: null,
  },
  intervalCount: {
    type: Number,
    default: 1,
  },

  // Duration for one-time OR used to calculate expiry for recurring
  duration: {
    type: String,
    enum: ["15days", "3months", "6months", "1year", "custom"],
    default: "custom",
  },
  durationInDays: {
    type: Number,
    required: true,
  },

  // Support multiple currencies
  prices: [
    {
      currency: { type: String, required: true },
      amount: { type: Number, required: true },
    },
  ],

  // VAT rates per currency/country
  vatRates: [
    {
      country: { type: String, required: true },
      currency: { type: String, required: true },
      rate: { type: Number, required: true },
    },
  ],

  // Payment provider + IDs
  paymentProvider: {
    type: String,
    enum: ["paypal", "stripe"],
    default: "paypal",
  },
  gatewayProductId: {
    type: String, // one product per plan (monthly/yearly)
    default: null,
  },
  gatewayPlanIds: {
    type: Map, // { "EUR": "planId1", "CHF": "planId2" }
    of: String,
    default: {},
  },

  // Trial support
  trialPeriodDays: {
    type: Number,
    default: 0,
  },

  features: [
    {
      type: String,
    },
  ],

  active: {
    type: Boolean,
    default: true,
  },
  visible: {
    type: Boolean,
    default: true,
  },
  metadata: {
    type: Map,
    of: String,
    default: {},
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const Plan = mongoose.model("Plan", planSchema);

module.exports = Plan;
