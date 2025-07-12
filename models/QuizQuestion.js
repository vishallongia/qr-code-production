const mongoose = require("mongoose");

const optionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
  },
  image: {
    type: String, // URL or path to the option image
    default: null,
  },
});

const quizQuestionSchema = new mongoose.Schema(
  {
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
    },
    question: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [optionSchema],
      validate: {
        validator: (val) => val.length >= 2,
        message: "At least 2 options are required.",
      },
    },
    correctAnswerIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    questionImage: {
      type: String, // Optional image URL or path
      default: null,
    },
    questionImageLink: {
      type: String, // Optional clickable link for the image
      default: null,
    },
    questionLogo: {
      type: String, // Optional logo image
      default: null,
    },
    magicCoinDeducted: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("QuizQuestion", quizQuestionSchema);
