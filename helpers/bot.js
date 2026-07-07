const { searchSimilarProblems, formatSearchResults } = require('./rts-search');
const { readThreadFromPermalink } = require('./thread-reader');

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

    // Fetch thread replies for each result via MCP
    const threadDetails = await fetchThreadReplies(searchResults);

    // Combine formatted results with thread details
    const fullResponse = formattedResults + threadDetails;

    // Post results
    await slackClient.chat.postMessage({
      channel: channelId,
      text: fullResponse,
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

    // Fetch thread replies for each result via MCP
    const threadDetails = await fetchThreadReplies(searchResults);

    // Combine formatted results with thread details
    const fullResponse = formattedResults + threadDetails;

    // Post results
    await slackClient.chat.postMessage({
      channel: channelId,
      text: fullResponse,
    });

  } catch (error) {
    console.error('Error handling direct message:', error);
    await slackClient.chat.postMessage({
      channel: channelId,
      text: `❌ Sorry, I encountered an error while searching. Please try again.`,
    });
  }
}

/**
 * Fetch thread replies for top search results via MCP.
 * @param {object} searchResults - Raw search results from RTS API
 * @returns {Promise<string>} Formatted thread details string
 */
async function fetchThreadReplies(searchResults) {
  const messages = searchResults.results?.messages || [];
  if (messages.length === 0) return '';

  // Only fetch threads for top 3 results to avoid rate limits
  const topMessages = messages
    .filter(m => !m.is_author_bot && m.permalink)
    .slice(0, 3);

  if (topMessages.length === 0) return '';

  let threadSection = '\n---\n🧵 *Thread Details (via MCP):*\n\n';
  let hasAnyReplies = false;

  const BOT_NAMES = ['poc app', 'demo app', 'slack help agent'];

  for (const [index, message] of topMessages.entries()) {
    const replies = await readThreadFromPermalink(message.permalink);
    // Skip root message (index 0 is usually the parent), filter out bot replies
    const replyMessages = replies.slice(1).filter(r =>
      !BOT_NAMES.includes((r.author || '').toLowerCase())
    );
    if (replyMessages.length === 0) continue;

    hasAnyReplies = true;
    const author = message.author_name || 'Unknown';
    threadSection += `*Thread ${index + 1}* (from ${author}):\n`;
    replyMessages.slice(0, 5).forEach(reply => {
      threadSection += `  • *${reply.author}*: ${reply.text.substring(0, 150)}${reply.text.length > 150 ? '...' : ''}\n`;
    });
    threadSection += `\n`;
  }

  return hasAnyReplies ? threadSection : '';
}

module.exports = {
  handleBotMention,
  handleDirectMessage,
};
