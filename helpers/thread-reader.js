const { callMcpTool } = require('./mcp-client');

/**
 * Parse a Slack permalink to extract channel ID and thread timestamp.
 * Example: https://workspace.slack.com/archives/C0BD9JAHQ30/p1782453255646679
 * @param {string} permalink
 * @returns {{ channelId: string, threadTs: string } | null}
 */
function parsePermalink(permalink) {
  if (!permalink) return null;
  const match = permalink.match(/\/archives\/([A-Z0-9]+)\/p(\d+)/);
  if (!match) return null;
  const channelId = match[1];
  const rawTs = match[2];
  // Convert Slack's p-timestamp (16 digits) to ts format (10.6)
  const threadTs = `${rawTs.slice(0, 10)}.${rawTs.slice(10)}`;
  return { channelId, threadTs };
}

/**
 * Read all replies in a Slack thread via MCP conversations_replies tool.
 * @param {string} channelId - Slack channel ID (e.g. C0BD9JAHQ30)
 * @param {string} threadTs - Thread parent timestamp (e.g. 1782453255.646679)
 * @returns {Promise<Array<{author: string, text: string}>>} Thread replies
 */
async function readThread(channelId, threadTs) {
  try {
    const result = await callMcpTool('conversations_replies', {
      channel_id: channelId,
      thread_ts: threadTs,
    });

    const content = result?.content;
    if (!content || !Array.isArray(content) || content.length === 0) {
      return [];
    }

    // MCP returns content as array of {type, text} objects
    const rawText = content.map(c => c.text || '').join('\n');

    // Parse the tabular/text output from the MCP tool
    return parseThreadReplies(rawText);
  } catch (error) {
    console.error(`Error reading thread ${channelId}/${threadTs}:`, error.message);
    return [];
  }
}

/**
 * Parse MCP tool CSV output into structured reply objects.
 * The slack-mcp-server returns CSV: MsgID,UserID,UserName,RealName,Channel,ThreadTs,Text,...
 * @param {string} rawText
 * @returns {Array<{author: string, text: string}>}
 */
function parseThreadReplies(rawText) {
  const replies = [];
  const lines = rawText.split('\n').filter(l => l.trim());

  // First line is CSV header
  if (lines.length < 2) return replies;

  const header = lines[0].split(',');
  const userNameIdx = header.indexOf('UserName');
  const realNameIdx = header.indexOf('RealName');
  const textIdx = header.indexOf('Text');

  if (textIdx === -1) return replies;

  for (const line of lines.slice(1)) {
    // CSV may have quoted fields containing commas — parse carefully
    const cols = parseCsvLine(line);
    if (!cols || cols.length <= textIdx) continue;

    const author = cols[realNameIdx] || cols[userNameIdx] || 'Unknown';
    const text = (cols[textIdx] || '').trim();
    if (text) {
      replies.push({ author, text });
    }
  }

  return replies;
}

/**
 * Simple CSV line parser that handles quoted fields.
 * @param {string} line
 * @returns {string[]}
 */
function parseCsvLine(line) {
  const cols = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cols.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cols.push(current);
  return cols;
}

/**
 * Read thread from a permalink URL.
 * @param {string} permalink - Slack message permalink
 * @returns {Promise<Array<{author: string, text: string}>>}
 */
async function readThreadFromPermalink(permalink) {
  const parsed = parsePermalink(permalink);
  if (!parsed) {
    console.warn(`Could not parse permalink: ${permalink}`);
    return [];
  }
  return readThread(parsed.channelId, parsed.threadTs);
}

module.exports = {
  readThread,
  readThreadFromPermalink,
  parsePermalink,
};
