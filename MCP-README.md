# Slack Search MCP Server

This MCP server exposes Slack Real-Time Search (RTS) functionality as MCP tools, allowing AI assistants and IDEs to search your Slack workspace for messages, files, and solutions.

## Available MCP Tools

### 1. `search_slack_messages`
Search Slack messages for similar problems and solutions.

**Parameters:**
- `query` (required): Search query to find similar problems
- `channelName` (optional): Specific channel name to search in (e.g., "help-channel")

**Example:**
```json
{
  "query": "database connection timeout",
  "channelName": "help-channel"
}
```

### 2. `search_slack_files`
Search Slack files and extract key information (amounts, costs, numbers).

**Parameters:**
- `query` (required): Search query to find relevant files
- `channelName` (optional): Specific channel name to search in

**Example:**
```json
{
  "query": "budget limits",
  "channelName": "finance"
}
```

### 3. `search_slack_all`
Search both Slack messages and files comprehensively.

**Parameters:**
- `query` (required): Search query to find relevant content
- `channelName` (optional): Specific channel name to search in

**Example:**
```json
{
  "query": "API authentication error"
}
```

## Setup

### Prerequisites

1. Ensure your `.env` file is configured with Slack credentials:
   ```env
   SLACK_BOT_TOKEN=xoxb-your-bot-token
   SLACK_USER_TOKEN=xoxp-your-user-token
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   BOTS_TO_IGNORE=POC App,Demo Bot,Test Bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Running the MCP Server

### Standalone Mode (for testing)
```bash
npm run mcp
```

### Connecting to IDE

The MCP server uses stdio transport, which is the standard way IDEs connect to MCP servers.

#### For Cursor/Windsurf IDE:

1. Open your IDE settings
2. Navigate to MCP configuration
3. Add a new MCP server with the following configuration:

```json
{
  "mcpServers": {
    "slack-search": {
      "command": "node",
      "args": ["/Users/puagrawal/Desktop/slack-poc/mcp-server.js"],
      "cwd": "/Users/puagrawal/Desktop/slack-poc"
    }
  }
}
```

4. Save and restart your IDE
5. The Slack search tools will now be available in your IDE's MCP client

#### For Claude Desktop:

Add to your Claude Desktop MCP configuration file:

```json
{
  "mcpServers": {
    "slack-search": {
      "command": "node",
      "args": ["/Users/puagrawal/Desktop/slack-poc/mcp-server.js"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-your-bot-token",
        "SLACK_USER_TOKEN": "xoxp-your-user-token"
      }
    }
  }
}
```

## Usage Examples

### Example 1: Search for technical solutions
```
Use the search_slack_messages tool with query "database connection timeout"
```

### Example 2: Find financial information in files
```
Use the search_slack_files tool with query "budget limits 2024"
```

### Example 3: Comprehensive search
```
Use the search_slack_all tool with query "API authentication error"
```

## Features

- **Real-Time Search**: Uses Slack's RTS API for fast, accurate results
- **File Content Extraction**: Extracts key information from files (amounts, costs, numbers)
- **Context-Aware**: Returns relevant past conversations with solutions
- **Channel Filtering**: Search specific channels or entire workspace
- **Relevance Filtering**: Filters results by relevance to query

## Troubleshooting

### Server won't start
- Ensure all dependencies are installed: `npm install`
- Check that `.env` file exists and contains valid Slack tokens
- Verify Node.js version (v14 or higher required)

### Tools not appearing in IDE
- Check MCP server configuration in IDE settings
- Ensure the path to `mcp-server.js` is correct
- Restart your IDE after configuration changes
- Check IDE logs for connection errors

### Search returns no results
- Verify your Slack tokens have the required scopes:
  - `assistant.search.context` (for RTS API)
  - `channels:history`
  - `channels:read`
  - `files:read`
- Ensure the bot has access to the channels you're searching
- Check that the search query is specific enough

## Development

### Adding new tools

To add a new MCP tool:

1. Add the tool definition in `mcp-server.js` in the `ListToolsRequestSchema` handler
2. Add the tool implementation in the `CallToolRequestSchema` handler
3. Restart the MCP server

### Testing

Test the MCP server by running it and using your IDE's MCP client to call the tools.

## Architecture

```
mcp-server.js          # MCP server implementation
├── MCP SDK            # Model Context Protocol SDK
├── rts-search.js      # Slack RTS API integration
└── bot.js             # Bot logic helpers
```

## License

MIT
