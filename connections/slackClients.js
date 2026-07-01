require('dotenv').config();
const { WebClient } = require('@slack/web-api');

let slackClientInstance = null;
let botClientInstance = null;
let userClientInstance = null;

/**
 * Get Slack client instance (singleton)
 * @returns {WebClient} Slack WebClient instance
 */
function getSlackClient() {
  if (!slackClientInstance) {
    slackClientInstance = new WebClient(process.env.SLACK_BOT_TOKEN, {
      retryConfig: {
        retries: 0, // Disable automatic retries
      },
    });
  }
  return slackClientInstance;
}

/**
 * Get Bot client instance (singleton)
 * @returns {WebClient} Bot WebClient instance
 */
function getBotClient() {
  if (!botClientInstance) {
    botClientInstance = new WebClient(process.env.SLACK_BOT_TOKEN, {
      retryConfig: {
        retries: 0, // Disable automatic retries
      },
    });
  }
  return botClientInstance;
}

/**
 * Get User client instance (singleton)
 * @returns {WebClient} User WebClient instance
 */
function getUserClient() {
  if (!userClientInstance) {
    userClientInstance = new WebClient(process.env.SLACK_USER_TOKEN, {
      retryConfig: {
        retries: 0, // Disable automatic retries
      },
    });
  }
  return userClientInstance;
}

module.exports = {
  getSlackClient,
  getBotClient,
  getUserClient,
};
