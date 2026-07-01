const { getSlackClient } = require('../connections/slackClients');
const { handleBotMention, handleDirectMessage } = require('./bot');

/**
 * Handle Slack events
 * @param {object} event - Slack event object
 */
async function handleEvent(event) {
  console.log('Received event:', event.type);

  const slackClient = getSlackClient();

  // Handle app mentions
  if (event.type === 'app_mention') {
    const channelId = event.channel;
    const text = event.text.replace(/<@\w+>/g, '').trim();
    const threadTs = event.ts;
    
    console.log(`Bot mentioned in channel ${channelId} with text: "${text}"`);
    
    // Call bot function to handle mention
    await handleBotMention(slackClient, channelId, text, threadTs);
  }

  // Handle direct messages
  if (event.type === 'message' && event.channel_type === 'im') {
    const channelId = event.channel;
    const text = event.text;
    
    // Skip if message is from the bot itself to prevent infinite loops
    if (event.bot_id || event.subtype === 'bot_message') {
      console.log('Skipping bot message to prevent infinite loop');
      return;
    }
    
    // Skip if message looks like bot response (contains emoji indicators)
    if (text.includes(':mag:') || text.includes(':x:') || text.includes('Searching') || text.includes('Sorry, I encountered')) {
      console.log('Skipping likely bot response to prevent infinite loop');
      return;
    }
    
    console.log(`Direct message received: "${text}"`);
    
    // Call bot function to handle direct message
    await handleDirectMessage(slackClient, channelId, text);
  }

  // Handle regular channel messages (respond to all messages in any public channel)
  // DISABLED: Causing rate limit issues due to excessive API calls
  // if (event.type === 'message' && event.channel_type === 'channel' && !event.bot_id && !event.subtype) {
  //   const channelId = event.channel;
  //   const text = event.text;
  //   
  //   // Respond to all substantive messages (not just questions)
  //   if (text.length > 10) {
  //     console.log(`Message detected in channel ${channelId}: "${text}"`);
  //     
  //     // Respond in thread to avoid cluttering the channel
  //     const threadTs = event.ts;
  //     await handleBotMention(slackClient, channelId, text, threadTs);
  //   }
  // }
}

module.exports = {
  handleEvent,
};
