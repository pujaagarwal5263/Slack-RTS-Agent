require('dotenv').config();
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const path = require('path');

let mcpClientInstance = null;
let isConnecting = false;

/**
 * Get or create the MCP client singleton connected to slack-mcp-server via stdio.
 * @returns {Promise<Client>} Connected MCP client
 */
async function getMcpClient() {
  if (mcpClientInstance) {
    return mcpClientInstance;
  }

  if (isConnecting) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return getMcpClient();
  }

  isConnecting = true;
  try {
    const serverBin = path.join(__dirname, '..', 'node_modules', '.bin', 'slack-mcp-server');

    const transport = new StdioClientTransport({
      command: serverBin,
      args: ['-no-cache'],
      env: {
        ...process.env,
        SLACK_MCP_XOXP_TOKEN: process.env.SLACK_USER_TOKEN,
        SLACK_MCP_ENABLED_TOOLS: 'conversations_replies,conversations_history,conversations_search_messages',
        SLACK_MCP_LOG_LEVEL: 'error',
      },
    });

    const client = new Client(
      { name: 'slack-rts-agent', version: '1.0.0' },
      { capabilities: {} }
    );

    await client.connect(transport);
    console.log('MCP client connected to slack-mcp-server');

    mcpClientInstance = client;
    return client;
  } finally {
    isConnecting = false;
  }
}

/**
 * Call an MCP tool by name with given arguments.
 * @param {string} toolName - MCP tool name
 * @param {object} args - Tool arguments
 * @returns {Promise<object>} Tool result content
 */
async function callMcpTool(toolName, args) {
  const client = await getMcpClient();
  console.log(`Calling MCP tool: ${toolName}`, args);
  const result = await client.callTool({ name: toolName, arguments: args });
  return result;
}

/**
 * Close the MCP client connection (for graceful shutdown).
 */
async function closeMcpClient() {
  if (mcpClientInstance) {
    await mcpClientInstance.close();
    mcpClientInstance = null;
    console.log('MCP client disconnected');
  }
}

module.exports = {
  getMcpClient,
  callMcpTool,
  closeMcpClient,
};
