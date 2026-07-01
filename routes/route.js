const { healthCheck, slackEvents } = require('../controllers/controllers');

/**
 * Setup routes for the Express app
 * @param {object} app - Express app instance
 */
function setupRoutes(app) {
  // Health check endpoint
  app.get('/', healthCheck);

  // Slack events endpoint
  app.post('/slack/events', slackEvents);
}

module.exports = {
  setupRoutes,
};
