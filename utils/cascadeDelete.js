const Channel = require("../models/Channel");
const Session = require("../models/Session");
const QuizQuestion = require("../models/QuizQuestion");
const QuizQuestionResponse = require("../models/QuizQuestionResponse");
const VoteQuestion = require("../models/VoteQuestion");
const VoteQuestionResponse = require("../models/VoteQuestionResponse");
const Applause = require("../models/Applause");
const ApplauseResponse = require("../models/ApplauseResponse");
const MagicScreen = require("../models/MagicScreen");
const MagicScreenResponse = require("../models/MagicScreenResponse");
const Comment = require("../models/Comments");
const CommentResponse = require("../models/CommentResponse");
const Portfolio = require("../models/Portfolios");
const PortfolioResponse = require("../models/PortfolioResponse");

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

        const applauseQuestions = await Applause.find({ sessionId: id });
        for (const q of applauseQuestions) {
          await cascadeDelete("applauseQuestion", q._id);
        }

        const magicScreens = await MagicScreen.find({ sessionId: id });
        for (const m of magicScreens) {
          await cascadeDelete("magicScreen", m._id);
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
          // await QuizQuestionResponse.deleteMany({ questionId: id });
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
          // await VoteQuestionResponse.deleteMany({ questionId: id });
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

    case "applauseQuestion":
      try {
        const question = await Applause.findById(id);
        if (!question) return;

        deleteFileIfExists(question.logo);
        deleteFileIfExists(question.questionImage);
        deleteFileIfExists(question.questionLogo);

        // Delete all responses
        try {
          // await ApplauseResponse.deleteMany({ questionId: id });
        } catch (respErr) {
          console.error(
            `Failed to delete responses for applause ${id}:`,
            respErr
          );
        }

        if (question.options && question.options.length > 0) {
          question.options.forEach((option) =>
            deleteFileIfExists(option.image)
          );
        }

        await Applause.deleteOne({ _id: id });
      } catch (err) {
        console.error(`Error deleting applause question ${id}:`, err);
      }
      break;

    case "magicScreen":
      try {
        const question = await MagicScreen.findById(id);
        if (!question) return;

        deleteFileIfExists(question.logo);
        deleteFileIfExists(question.questionImage);
        deleteFileIfExists(question.questionLogo);

        if (question.options?.length) {
          question.options.forEach((option) =>
            deleteFileIfExists(option.image)
          );
        }

        // Delete all responses
        try {
          await MagicScreenResponse.deleteMany({ questionId: id });
        } catch (respErr) {
          console.error(
            `Failed to delete responses for magic screen ${id}:`,
            respErr
          );
        }

        await MagicScreen.deleteOne({ _id: id });
      } catch (err) {
        console.error(`Error deleting magic screen ${id}:`, err);
      }
      break;

    case "commentQuestion":
      try {
        const question = await Comment.findById(id);
        if (!question) return;

        // Helper to check if image is from /comment-logos/
        const shouldDelete = (path) => {
          return path && !path.includes("/comment-logos/");
        };

        // Delete main images
        if (shouldDelete(question.logo)) deleteFileIfExists(question.logo);
        if (shouldDelete(question.questionImage))
          deleteFileIfExists(question.questionImage);
        if (shouldDelete(question.questionLogo))
          deleteFileIfExists(question.questionLogo);

        // Delete option images (if any)
        if (question.options?.length) {
          question.options.forEach((option) => {
            if (shouldDelete(option.image)) deleteFileIfExists(option.image);
          });
        }

        // Delete all responses
        try {
          await CommentResponse.deleteMany({ questionId: id });
        } catch (respErr) {
          console.error(
            `Failed to delete responses for comment ${id}:`,
            respErr
          );
        }

        await Comment.deleteOne({ _id: id });
      } catch (err) {
        console.error(`Error deleting comment question ${id}:`, err);
      }
      break;

    case "portfolioQuestion":
      try {
        const question = await Portfolio.findById(id);
        if (!question) return;

        // Helper to check if image is from /portfolio-logos/
        const shouldDelete = (path) => {
          return path && !path.includes("/portfolio-logos/");
        };

        // Delete main images
        if (shouldDelete(question.logo)) deleteFileIfExists(question.logo);
        if (shouldDelete(question.questionImage))
          deleteFileIfExists(question.questionImage);
        if (shouldDelete(question.questionLogo))
          deleteFileIfExists(question.questionLogo);

        // Delete option images (if any)
        if (question.options?.length) {
          question.options.forEach((option) => {
            if (shouldDelete(option.image)) deleteFileIfExists(option.image);
          });
        }

        // Delete all responses
        try {
          await PortfolioResponse.deleteMany({ questionId: id });
        } catch (respErr) {
          console.error(
            `Failed to delete responses for portfolio ${id}:`,
            respErr
          );
        }

        await Portfolio.deleteOne({ _id: id });
      } catch (err) {
        console.error(`Error deleting portfolio question ${id}:`, err);
      }
      break;
  }
}

module.exports = { cascadeDelete };
