const { searchSimilarProblems, formatSearchResults } = require('./rts-search');

/**
 * Handle bot mention in channel
 * @param {object} slackClient - Slack WebClient
 * @param {string} channelId - Channel ID
 * @param {string} text - Message text
 * @param {string} threadTs - Thread timestamp for threaded replies
 */
async function handleBotMention(slackClient, channelId, text, threadTs = null) {
  try {
    console.log(`Processing bot mention in channel ${channelId}`);

    // Post initial response
    await slackClient.chat.postMessage({
      channel: channelId,
      text: `🔍 Searching for similar problems and solutions...`,
      thread_ts: threadTs,
    });

    // Search for similar problems
    const searchResults = await searchSimilarProblems(text);

    // Format results (pass query for relevance filtering)
    const formattedResults = formatSearchResults(searchResults, text);

    // Post results
    await slackClient.chat.postMessage({
      channel: channelId,
      text: formattedResults,
      thread_ts: threadTs,
    });

  } catch (error) {
    console.error('Error handling bot mention:', error);
    await slackClient.chat.postMessage({
      channel: channelId,
      text: `❌ Sorry, I encountered an error while searching. Please try again.`,
      thread_ts: threadTs,
    });
  }
}

/**
 * Handle direct message to bot
 * @param {object} slackClient - Slack WebClient
 * @param {string} channelId - Channel ID (DM channel)
 * @param {string} text - Message text
 */
async function handleDirectMessage(slackClient, channelId, text) {
  try {
    console.log(`Processing direct message in channel ${channelId}`);

    // Post initial response
    await slackClient.chat.postMessage({
      channel: channelId,
      text: `🔍 Searching for similar problems and solutions...`,
    });

    // Search for similar problems
    const searchResults = await searchSimilarProblems(text);

    // Format results (pass query for relevance filtering)
    const formattedResults = formatSearchResults(searchResults, text);

    // Post results
    await slackClient.chat.postMessage({
      channel: channelId,
      text: formattedResults,
    });

  } catch (error) {
    console.error('Error handling direct message:', error);
    await slackClient.chat.postMessage({
      channel: channelId,
      text: `❌ Sorry, I encountered an error while searching. Please try again.`,
    });
  }
}

module.exports = {
  handleBotMention,
  handleDirectMessage,
};
