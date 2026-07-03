require('dotenv').config();
const { getUserClient } = require('../connections/slackClients');

/**
 * Search Slack using Real-Time Search API
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @returns {Promise<object>} Search results
 */
async function searchSlack(query, options = {}) {
  try {
    const {
      channel_types = ['public_channel', 'private_channel'],
      content_types = ['messages'],
      limit = 10,
      include_context_messages = true,
    } = options;

    console.log(`Searching Slack with query: "${query}"`);

    // Using the Real-Time Search API via direct API call
    // Use user client to avoid action_token requirement
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
    console.log(`Found ${msgCount} messages, ${fileCount} files`);
    return result;
  } catch (error) {
    console.error('Error searching Slack:', error);
    throw error;
  }
}

/**
 * Search for similar problems in help channel
 * @param {string} problem - User's problem description
 * @param {string} channelName - Specific channel to search (optional)
 * @returns {Promise<object>} Search results
 */
async function searchSimilarProblems(problem, channelName = null) {
  try {
    let query = problem;
    let searchFiles = false;
    let searchMessages = true;

    // Check for DOCSEARCH: prefix for file-only search
    if (query.trim().toUpperCase().startsWith('DOCSEARCH:')) {
      searchFiles = true;
      searchMessages = false;
      query = query.replace(/^DOCSEARCH:\s*/i, '').trim();
    }

    // If channel name is provided, add it to query
    if (channelName) {
      query = `in:${channelName} ${query}`;
    }

    const contentTypes = [];
    if (searchMessages) contentTypes.push('messages');
    if (searchFiles) contentTypes.push('files');

    const results = await searchSlack(query, {
      channel_types: ['public_channel', 'private_channel'],
      content_types: contentTypes,
      limit: 10,
      include_context_messages: true,
    });

    // If searching files, fetch file content
    if (searchFiles && results.results?.files) {
      results.results.files = await fetchFileContent(results.results.files);
    }

    return results;
  } catch (error) {
    console.error('Error searching similar problems:', error);
    throw error;
  }
}

/**
 * Fetch content for files
 * @param {Array} files - Array of file objects from search
 * @returns {Promise<Array>} Files with content added
 */
async function fetchFileContent(files) {
  const userClient = getUserClient();
  const filesWithContent = await Promise.all(
    files.map(async (file) => {
      try {
        // Handle different file ID field names
        const fileId = file.file_id || file.id;
        if (!fileId) {
          console.error('No file ID found in file object:', file);
          return file;
        }

        // Fetch detailed file info
        const fileInfo = await userClient.files.info({
          file: fileId,
        });

        // Add content to file object if available
        if (fileInfo.file) {
          const content = fileInfo.file.preview || fileInfo.file.plain_text || null;
          
          // For PDFs and other binary files, Slack doesn't provide text content
          // We can only extract content from text-based files
          if (content) {
            return {
              ...file,
              content: content,
              size: fileInfo.file.size,
              mimetype: fileInfo.file.mimetype,
              extractedInfo: extractKeyInfo(content),
            };
          } else {
            // For binary files (PDFs, images, etc.), return metadata only
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
        console.error(`Error fetching content for file ${file.file_id || file.id}:`, error.message);
        return file; // Return original file if content fetch fails
      }
    })
  );
  
  return filesWithContent;
}

/**
 * Extract key information from file content (numbers, costs, amounts)
 * @param {string} content - File content
 * @returns {object} Extracted key information
 */
function extractKeyInfo(content) {
  const info = {
    amounts: [],
    costs: [],
    numbers: [],
    keyData: []
  };

  // Extract monetary amounts (like $15000, 15000 USD, INR 15000, etc.)
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

  // Extract numbers that might be relevant (3+ digits)
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

  // Extract key phrases with numbers - improved patterns
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
 * Filter messages by relevance to query
 * @param {Array} messages - Array of message objects
 * @param {string} query - Original search query
 * @returns {Array} Filtered messages by relevance
 */
function filterByRelevance(messages, query) {
  if (!query || query.length < 3) {
    return messages; // Return all if query is too short
  }

  // Extract key terms from query (remove common words)
  const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'for', 'to', 'of', 'in', 'on', 'at', 'by', 'with', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once'];
  
  const queryTerms = query.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(term => term.length > 2 && !stopWords.includes(term));

  if (queryTerms.length === 0) {
    return messages; // Return all if no meaningful terms
  }

  // Filter messages that contain at least one query term
  return messages.filter(message => {
    const content = (message.content || '').toLowerCase();
    return queryTerms.some(term => content.includes(term));
  });
}

/**
 * Format search results for display
 * @param {object} results - Search results from RTS API
 * @param {string} query - Original search query for relevance filtering
 * @returns {string} Formatted results
 */
function formatSearchResults(results, query = '') {
  // Handle the actual API response structure
  const messagesArray = Array.isArray(results.results?.messages) ? results.results.messages : [];
  const filesArray = Array.isArray(results.results?.files) ? results.results.files : [];

  let formatted = '';

  // Process and format messages
  const filteredMessages = messagesArray.filter(message => {
    const content = message.content || '';
    const author = message.author_name || '';
    
    // Exclude bot mentions (messages that start with <@U...>)
    if (content.includes('<@U')) return false;

    // Exclude messages from specified bots (allow reading from other bots/hooks like deployment alerts)
    const botsToIgnore = process.env.BOTS_TO_IGNORE ? process.env.BOTS_TO_IGNORE.split(',').map(b => b.trim()) : [];
    if (message.is_author_bot && botsToIgnore.includes(message.author_name)) {
      return false;
    }

    // Exclude short messages that are likely questions
    if (content.length < 20) return false;
    
    // Relax question pattern filtering - only exclude if message STARTS with question pattern
    const lowerContent = content.toLowerCase().trim();
    const questionStartPatterns = ['how to', 'how do i', 'what are', 'what is', 'help with', 'need help', 'can someone', 'anyone'];
    const startsWithQuestion = questionStartPatterns.some(pattern => lowerContent.startsWith(pattern));
    if (startsWithQuestion) return false;
    
    return true;
  });

  // Apply relevance filtering to remove results that don't match query terms
  const relevantMessages = filterByRelevance(filteredMessages, query);

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

  // Process and format files
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
      
      // Display extracted key information if available
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
      
      // Add file content preview if available and no key info found
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

module.exports = {
  searchSlack,
  searchSimilarProblems,
  formatSearchResults,
  fetchFileContent,
  filterByRelevance,
};
