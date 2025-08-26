const Channel = require("../models/Channel");
const Session = require("../models/Session");
const QuizQuestion = require("../models/QuizQuestion");
const QuizQuestionResponse = require("../models/QuizQuestionResponse");
const VoteQuestion = require("../models/VoteQuestion");
const VoteQuestionResponse = require("../models/VoteQuestionResponse");
const QRCodeData = require("../models/QRCODEDATA"); // Adjust path as per your structure
const { deleteFileIfExists } = require("../middleware/multerQuizUploader");
async function cascadeDelete(type, id) {
  switch (type) {
    case "channel":
      try {
        const channel = await Channel.findById(id);
        if (!channel) return;

        // Delete channel logo
        deleteFileIfExists(channel.logo);

        // Delete all sessions for this channel
        const sessions = await Session.find({ channelId: id });
        for (const session of sessions) {
          await cascadeDelete("session", session._id);
        }

        await Channel.deleteOne({ _id: id });
      } catch (err) {
        console.error(`Error deleting channel ${id}:`, err);
      }
      break;

    case "session":
      try {
        const session = await Session.findById(id);
        if (!session) return;

        // Delete channel logo
        deleteFileIfExists(session.logo);

        // Delete all quiz questions for this session
        const questions = await QuizQuestion.find({ sessionId: id });
        for (const question of questions) {
          await cascadeDelete("quizQuestion", question._id);
        }

        // Delete all vote questions for this session
        const votes = await VoteQuestion.find({ sessionId: id });
        for (const vote of votes) {
          await cascadeDelete("voteQuestion", vote._id);
        }

        // Delete all QR codes associated with this session's codes
        if (session.code && session.code.length > 0) {
          const codeValues = session.code.map((c) => c.value);
          await QRCodeData.deleteMany({ code: { $in: codeValues } });
        }

        await Session.deleteOne({ _id: id });
      } catch (err) {
        console.error(`Error deleting session ${id}:`, err);
      }
      break;

    case "quizQuestion":
      try {
        const question = await QuizQuestion.findById(id);
        if (!question) return;

        // Delete uploaded files
        deleteFileIfExists(question.logo);
        deleteFileIfExists(question.questionImage);
        deleteFileIfExists(question.jackpotRewardImage);
        deleteFileIfExists(question.digitalRewardImage);

        // Delete option images
        if (question.options && question.options.length > 0) {
          question.options.forEach((option) =>
            deleteFileIfExists(option.image)
          );
        }

        // Delete all responses
        try {
          await QuizQuestionResponse.deleteMany({ questionId: id });
        } catch (respErr) {
          console.error(
            `Failed to delete responses for question ${id}:`,
            respErr
          );
        }

        await QuizQuestion.deleteOne({ _id: id });
      } catch (err) {
        console.error(`Error deleting quiz question ${id}:`, err);
      }
      break;

    case "voteQuestion":
      try {
        const vote = await VoteQuestion.findById(id);
        if (!vote) return;

        // Delete uploaded files
        deleteFileIfExists(vote.logo);
        deleteFileIfExists(vote.questionImage);

        // Delete option images
        if (vote.options && vote.options.length > 0) {
          vote.options.forEach((option) => deleteFileIfExists(option.image));
        }

        // Delete all responses
        try {
          await VoteQuestionResponse.deleteMany({ questionId: id });
        } catch (respErr) {
          console.error(
            `Failed to delete responses for vote question ${id}:`,
            respErr
          );
        }

        // Delete the vote question itself
        await VoteQuestion.deleteOne({ _id: id });
      } catch (err) {
        console.error(`Error deleting vote question ${id}:`, err);
      }
      break;
  }
}

module.exports = { cascadeDelete };
