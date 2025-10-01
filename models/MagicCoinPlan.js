const mongoose = require("mongoose");

const magicCoinPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
  },
  coinsOffered: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: "USD",
  },
  active: {
    type: Boolean,
    default: true,
  },
  vatRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
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

const MagicCoinPlan = mongoose.model("MagicCoinPlan", magicCoinPlanSchema);

module.exports = MagicCoinPlan;
