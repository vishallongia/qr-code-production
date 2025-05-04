const mongoose = require("mongoose");

const planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: "USD",
  },
  duration: {
    type: String,
    enum: ["15days", "3months", "6months", "1year"],
    required: true,
  },
  durationInDays: {
    type: Number,
    required: true, // Useful for calculating `validUntil`
  },
  features: [
    {
      type: String, // Each feature will be a string; you can also use an array of objects for more details
    },
  ],
  active: {
    type: Boolean,
    default: true,
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
