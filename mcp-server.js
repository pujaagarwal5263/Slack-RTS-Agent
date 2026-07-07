require('dotenv').config();
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { getUserClient } = require('./connections/slackClients');

// MCP-specific search functions (isolated from bot flow)

/**
 * Search Slack using Real-Time Search API (MCP version)
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @returns {Promise<object>} Search results
 */
async function searchSlackMCP(query, options = {}) {
  try {
    const {
      channel_types = ['public_channel', 'private_channel'],
      content_types = ['messages'],
      limit = 10,
      include_context_messages = true,
    } = options;

    console.error(`[MCP] Searching Slack with query: "${query}"`);

    const userClient = getUserClient();
    const result = await userClient.apiCall('assistant.search.context', {
      query: query,
      channel_types: channel_types,
      content_types: content_types,
      limit: limit,
      include_context_messages: include_context_messages,
      count: limit,
    });

    const msgCount = result.results?.messages?.length || 0;
    const fileCount = result.results?.files?.length || 0;
    console.error(`[MCP] Found ${msgCount} messages, ${fileCount} files`);
    return result;
  } catch (error) {
    console.error('[MCP] Error searching Slack:', error);
    throw error;
  }
}

/**
 * Search for similar problems (MCP version)
 * @param {string} problem - User's problem description
 * @param {string} channelName - Specific channel to search (optional)
 * @param {boolean} searchFilesOnly - If true, search only files
 * @returns {Promise<object>} Search results
 */
async function searchSimilarProblemsMCP(problem, channelName = null, searchFilesOnly = false) {
  try {
    let query = problem;
    let searchFiles = searchFilesOnly;
    let searchMessages = !searchFilesOnly;

    // If channel name is provided, add it to query
    if (channelName) {
      query = `in:${channelName} ${query}`;
    }

    const contentTypes = [];
    if (searchMessages) contentTypes.push('messages');
    if (searchFiles) contentTypes.push('files');

    const results = await searchSlackMCP(query, {
      channel_types: ['public_channel', 'private_channel'],
      content_types: contentTypes,
      limit: 10,
      include_context_messages: true,
    });

    // If searching files, fetch file content
    if (searchFiles && results.results?.files) {
      results.results.files = await fetchFileContentMCP(results.results.files);
    }

    return results;
  } catch (error) {
    console.error('[MCP] Error searching similar problems:', error);
    throw error;
  }
}

/**
 * Fetch content for files (MCP version)
 * @param {Array} files - Array of file objects from search
 * @returns {Promise<Array>} Files with content added
 */
async function fetchFileContentMCP(files) {
  const userClient = getUserClient();
  const filesWithContent = await Promise.all(
    files.map(async (file) => {
      try {
        const fileId = file.file_id || file.id;
        if (!fileId) {
          console.error('[MCP] No file ID found in file object:', file);
          return file;
        }

        const fileInfo = await userClient.files.info({
          file: fileId,
        });

        if (fileInfo.file) {
          const content = fileInfo.file.preview || fileInfo.file.plain_text || null;
          
          if (content) {
            return {
              ...file,
              content: content,
              size: fileInfo.file.size,
              mimetype: fileInfo.file.mimetype,
              extractedInfo: extractKeyInfoMCP(content),
            };
          } else {
            return {
              ...file,
              content: null,
              size: fileInfo.file.size,
              mimetype: fileInfo.file.mimetype,
              extractedInfo: null,
              note: 'Binary file - content not extractable via Slack API',
            };
          }
        }
        return file;
      } catch (error) {
        console.error(`[MCP] Error fetching content for file ${file.file_id || file.id}:`, error.message);
        return file;
      }
    })
  );
  
  return filesWithContent;
}

/**
 * Extract key information from file content (MCP version)
 * @param {string} content - File content
 * @returns {object} Extracted key information
 */
function extractKeyInfoMCP(content) {
  const info = {
    amounts: [],
    costs: [],
    numbers: [],
    keyData: []
  };

  const moneyPatterns = [
    /\$\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
    /(?:INR|USD|EUR|GBP|rupees?|rs?|dollars?)\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
    /([0-9,]+(?:\.[0-9]{2})?)\s*(?:USD|dollars?|rupees?|rs?|INR|EUR|GBP)/gi,
    /(?:cost|price|amount|fee|charge|budget|limit).*?[:\s]*([0-9,]+(?:\.[0-9]{2})?)/gi,
    /(?:maximum|minimum).*?(?:INR|USD|EUR|GBP|rupees?|rs?|dollars?)\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
    /(?:maximum|minimum).*?([0-9,]+(?:\.[0-9]{2})?)\s*(?:INR|USD|EUR|GBP|rupees?|rs?|dollars?)/gi
  ];

  moneyPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const number = match.replace(/[^\d.]/g, '');
        if (number && !info.amounts.includes(number)) {
          info.amounts.push(number);
        }
      });
    }
  });

  const numberPattern = /\b\d{3,}(?:,\d{3})*(?:\.\d{2})?\b/g;
  const numbers = content.match(numberPattern);
  if (numbers) {
    numbers.forEach(num => {
      const cleanNum = num.replace(/,/g, '');
      if (!info.numbers.includes(cleanNum)) {
        info.numbers.push(cleanNum);
      }
    });
  }

  const keyDataPatterns = [
    /(?:maximum|minimum|limit|allowance|quota|budget).*?[:\s]*([0-9,]+(?:\.[0-9]{2})?)\s*(?:USD|dollars?|rupees?|rs?|INR|EUR|GBP)?/gi,
    /(?:maximum|minimum|limit|allowance|quota|budget).*?(?:INR|USD|EUR|GBP|rupees?|rs?|dollars?)\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
    /(?:shall be|should be|is|are)\s*(?:maximum|minimum|limit|of)?\s*(?:INR|USD|EUR|GBP|rupees?|rs?|dollars?)?\s*([0-9,]+(?:\.[0-9]{2})?)/gi
  ];

  keyDataPatterns.forEach(pattern => {
    const keyMatches = content.match(pattern);
    if (keyMatches) {
      keyMatches.forEach(match => {
        if (!info.keyData.includes(match.trim())) {
          info.keyData.push(match.trim());
        }
      });
    }
  });

  return info;
}

/**
 * Filter messages by relevance to query (MCP version)
 * @param {Array} messages - Array of message objects
 * @param {string} query - Original search query
 * @returns {Array} Filtered messages by relevance
 */
function filterByRelevanceMCP(messages, query) {
  if (!query || query.length < 3) {
    return messages;
  }

  const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'for', 'to', 'of', 'in', 'on', 'at', 'by', 'with', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once'];
  
  const queryTerms = query.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(term => term.length > 2 && !stopWords.includes(term));

  if (queryTerms.length === 0) {
    return messages;
  }

  return messages.filter(message => {
    const content = (message.content || '').toLowerCase();
    return queryTerms.some(term => content.includes(term));
  });
}

/**
 * Format search results for display (MCP version)
 * @param {object} results - Search results from RTS API
 * @param {string} query - Original search query for relevance filtering
 * @returns {string} Formatted results
 */
function formatSearchResultsMCP(results, query = '') {
  const messagesArray = Array.isArray(results.results?.messages) ? results.results.messages : [];
  const filesArray = Array.isArray(results.results?.files) ? results.results.files : [];

  let formatted = '';

  const filteredMessages = messagesArray.filter(message => {
    const content = message.content || '';
    const author = message.author_name || '';
    
    // Exclude messages that are just quoting other bot responses
    if (content.startsWith('Found ') && content.includes('similar messages')) return false;

    // Exclude bot mentions in messages
    if (content.length < 30 && content.includes('<@U')) return false;

    // Exclude messages from specified bots
    const botsToIgnore = process.env.BOTS_TO_IGNORE ? process.env.BOTS_TO_IGNORE.split(',').map(b => b.trim()) : [];
    if (message.is_author_bot && botsToIgnore.includes(message.author_name)) {
      return false;
    }

    // Exclude short messages that are likely questions
    if (content.length < 20) return false;
    
    // Exclude messages that start with question patterns
    const lowerContent = content.toLowerCase().trim();
    const questionStartPatterns = ['how to', 'how do i', 'what are', 'what is', 'help with', 'need help', 'can someone', 'anyone'];
    const startsWithQuestion = questionStartPatterns.some(pattern => lowerContent.startsWith(pattern));
    if (startsWithQuestion) return false;
    
    return true;
  });

  const relevantMessages = (query && query.length > 3) ? filterByRelevanceMCP(filteredMessages, query) : filteredMessages;

  if (relevantMessages.length > 0) {
    formatted += `Found ${relevantMessages.length} similar messages:\n\n`;
    relevantMessages.forEach((message, index) => {
      const author = message.author_name || 'Unknown';
      const text = message.content || 'No text';
      const permalink = message.permalink || 'No link';

      formatted += `${index + 1}. From ${author}\n`;
      formatted += `   "${text.substring(0, 200)}${text.length > 200 ? '...' : ''}"\n`;
      formatted += `   Link: ${permalink}\n\n`;
    });
  }

  if (filesArray.length > 0) {
    formatted += `Found ${filesArray.length} relevant files:\n\n`;
    filesArray.forEach((file, index) => {
      const title = file.title || file.name || 'Unknown file';
      const fileType = file.file_type || file.filetype || 'Unknown type';
      const permalink = file.permalink || file.url_private || 'No link';
      const author = file.author_name || file.user || 'Unknown';

      formatted += `${index + 1}. ${title}\n`;
      formatted += `   Type: ${fileType}\n`;
      formatted += `   From: ${author}\n`;
      
      if (file.extractedInfo) {
        const info = file.extractedInfo;
        if (info.keyData.length > 0) {
          formatted += `   Key Data: ${info.keyData.join(', ')}\n`;
        }
        if (info.amounts.length > 0) {
          formatted += `   Amounts Found: ${info.amounts.join(', ')}\n`;
        }
        if (info.numbers.length > 0 && info.amounts.length === 0) {
          formatted += `   Numbers Found: ${info.numbers.slice(0, 5).join(', ')}\n`;
        }
      }
      
      formatted += `   Link: ${permalink}\n`;
      
      if (file.content && !file.extractedInfo?.keyData?.length && !file.extractedInfo?.amounts?.length) {
        const contentPreview = file.content.length > 200 
          ? file.content.substring(0, 200) + '...' 
          : file.content;
        formatted += `   Content: "${contentPreview}"\n`;
      }
      
      formatted += `\n`;
    });
  }

  if (relevantMessages.length === 0 && filesArray.length === 0) {
    return 'No similar problems found.';
  }

  return formatted;
}

// Create MCP server
const server = new Server({
  name: 'slack-search-mcp-server',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_slack_messages',
        description: 'Search Slack messages for similar problems and solutions using Real-Time Search API',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to find similar problems',
            },
            channelName: {
              type: 'string',
              description: 'Optional: Specific channel name to search in (e.g., "help-channel")',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_slack_files',
        description: 'Search Slack files and extract key information (amounts, costs, numbers)',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to find relevant files',
            },
            channelName: {
              type: 'string',
              description: 'Optional: Specific channel name to search in',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_slack_all',
        description: 'Search both Slack messages and files comprehensively',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to find relevant content',
            },
            channelName: {
              type: 'string',
              description: 'Optional: Specific channel name to search in',
            },
          },
          required: ['query'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_slack_messages': {
        const { query, channelName } = args;
        console.error(`[MCP] Searching Slack messages for: "${query}"`);
        
        const results = await searchSimilarProblemsMCP(query, channelName, false);
        const formatted = formatSearchResultsMCP(results, query);
        
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }

      case 'search_slack_files': {
        const { query, channelName } = args;
        console.error(`[MCP] Searching Slack files for: "${query}"`);
        
        const results = await searchSimilarProblemsMCP(query, channelName, true);
        const formatted = formatSearchResultsMCP(results, query);
        
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }

      case 'search_slack_all': {
        const { query, channelName } = args;
        console.error(`[MCP] Searching Slack (messages + files) for: "${query}"`);
        
        const results = await searchSimilarProblemsMCP(query, channelName, false);
        const formatted = formatSearchResultsMCP(results, query);
        
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(`Error executing tool ${name}:`, error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  console.error('Starting Slack Search MCP Server...');
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('Slack Search MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
