require('dotenv').config();
const { IncomingWebhook } = require('@slack/webhook');

/**
 * Send deployment alert to Slack webhook
 * @param {string} message - Deployment message (e.g., "Tag 1.0.0 deployed to staging")
 * @param {string} webhookUrl - Slack incoming webhook URL
 */
async function sendDeploymentAlert(message, webhookUrl) {
  try {
    const webhook = new IncomingWebhook(webhookUrl);
    
    // Use red alert emoji for failed deployments, rocket emoji for successful ones
    const emoji = message.toLowerCase().includes('failed') ? '🚨' : '🚀';
    
    await webhook.send({
      text: `${emoji} ${message}`,
    });

    console.log('✅ Deployment alert sent successfully:', message);
  } catch (error) {
    console.error('❌ Error sending deployment alert:', error);
  }
}

// Get Slack webhook URL from environment
const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;

if (!slackWebhookUrl) {
  console.error('❌ SLACK_WEBHOOK_URL not set in environment variables');
  console.error('Please set SLACK_WEBHOOK_URL in your .env file');
  process.exit(1);
}

// Example usage - you can pass message as command line argument
const message = process.argv[2] || 'Tag 1.0.0 deployed to staging';

sendDeploymentAlert(message, slackWebhookUrl);
