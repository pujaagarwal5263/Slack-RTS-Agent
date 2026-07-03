# Slack Help Agent POC

A Slack agent that uses the Real-Time Search (RTS) API to help users find solutions to past problems in a help channel.

## Features

- **Real-Time Search**: Searches Slack messages in real-time using the RTS API
- **Bot Mentions**: Responds when @mentioned in channels
- **Direct Messages**: Handles direct messages for private queries
- **Context-Aware**: Returns relevant past conversations with solutions

## Setup

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Slack app with the following scopes:
  - `assistant.search.context` (for RTS API)
  - `channels:history`
  - `channels:read`
  - `chat:write`
  - `im:write`

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your Slack credentials:
   ```env
   SLACK_BOT_TOKEN=xoxb-your-bot-token
   SLACK_USER_TOKEN=xoxp-your-user-token
   PORT=3000
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   BOTS_TO_IGNORE=POC App,Demo Bot,Test Bot
   ```

### Running the App

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The app will start on `http://localhost:3000`

## Usage

### In a Channel

1. Invite the bot to your help channel
2. Mention the bot with your problem:
   ```
   @Help-Agent My database connection is timing out
   ```
3. The bot will search for similar past problems and return relevant solutions

### Direct Message

1. Open a direct message with the bot
2. Describe your problem:
   ```
   I'm getting a 404 error when accessing the API
   ```
3. The bot will search and return relevant past solutions

## Testing the Webhook (Development Only)

The project includes a script for testing Slack webhook notifications. This is intended for development/testing purposes only.

### Setup

1. Add your Slack incoming webhook URL to your `.env` file:
   ```env
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```

2. Run the deployment alert script with a test message:
   ```bash
   node scripts/send-deployment-alert.js "Test deployment tag 2.3.4 to staging failed"
   ```

   You can also test a failed deployment message:
   ```bash
   node scripts/send-deployment-alert.js "Deployment tag 2.3.4 failed on production successfully"
   ```

**Note**: This webhook testing script is for development purposes only and should not be used in production environments.

## Project Structure

```
slack-poc/
├── .env                  # Environment variables (tokens)
├── .gitignore           # Git ignore file
├── package.json         # Dependencies
├── server.js            # Express server for Slack events
├── bot.js               # Bot logic for handling messages
├── rts-search.js        # Real-Time Search API integration
└── README.md            # Documentation
```

## Technologies Used

- **Slack Real-Time Search API**: For searching messages in real-time
- **Slack Bolt SDK**: For Slack app integration
- **Express**: For HTTP server
- **Node.js**: Runtime environment

## Hackathon Submission

This project is submitted for the **Slack Agent Builder Challenge** in the **New Slack Agent** track.

### Technologies Used
- ✅ Real-Time Search API

### Track
- New Slack Agent

## Future Enhancements

- Integrate with an LLM to synthesize and summarize search results
- Add MCP Server integration for standardized tool access
- Implement feedback mechanism to improve search relevance
- Add support for file search (attachments, documents)
- Create a knowledge base from resolved issues
