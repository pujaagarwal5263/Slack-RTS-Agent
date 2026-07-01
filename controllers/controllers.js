const { handleEvent } = require('../helpers/event');

/**
 * Health check endpoint
 */
function healthCheck(req, res) {
  res.send('Slack Help Agent is running!');
}

/**
 * Slack events endpoint
 */
async function slackEvents(req, res) {
  const { type, challenge, event } = req.body;

  // URL verification for Slack
  if (type === 'url_verification') {
    return res.status(200).send(challenge);
  }

  // Handle events
  if (type === 'event_callback') {
    try {
      await handleEvent(event);
      res.status(200).send('OK');
    } catch (error) {
      console.error('Error handling event:', error);
      res.status(500).send('Error');
    }
  } else {
    res.status(200).send('OK');
  }
}

module.exports = {
  healthCheck,
  slackEvents,
};
