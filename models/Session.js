const mongoose = require("mongoose");
const generateCode = require("../utils/codeGenerator");

const codeSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ["quiz", "voting", "shopping", "brand"],
    },
    value: { type: String, required: true },
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    logo: { type: String, default: null },
    logoTitle: { type: String, default: "" },
    description: { type: String, default: "" },
    link: { type: String, default: null },
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
    },

    // Array of codes instead of single code
    code: { type: [codeSchema], default: [] },
  },
  { timestamps: true }
);

sessionSchema.pre("validate", async function (next) {
  if (this.code && this.code.length > 0) return next(); // Already set manually

  const types = ["quiz", "voting", "shopping", "brand"];
  const generatedCodes = [];

  for (const type of types) {
    let unique = false;
    let newCode;

    while (!unique) {
      newCode = generateCode();

      const sessionExists = await mongoose.models.Session.findOne({
        "code.value": newCode,
      });

      const qrExists = await mongoose.models.QRCodeData?.findOne({
        code: newCode,
      });

      if (!sessionExists && !qrExists) {
        unique = true;
      }
    }

    generatedCodes.push({ type, value: newCode });
  }

  this.code = generatedCodes;
  next();
});

module.exports = mongoose.model("Session", sessionSchema);
