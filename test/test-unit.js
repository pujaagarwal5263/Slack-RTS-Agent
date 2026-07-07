/**
 * Unit tests for event handling and search result formatting.
 * No Slack tokens required — all Slack API calls are stubbed.
 */

const { formatSearchResults, filterByRelevance } = require('../helpers/rts-search');

let passed = 0;
let failed = 0;

function assert(description, condition) {
  if (condition) {
    console.log(`  ✅ ${description}`);
    passed++;
  } else {
    console.error(`  ❌ ${description}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// filterByRelevance
// ---------------------------------------------------------------------------
console.log('\n--- filterByRelevance ---');

const sampleMessages = [
  { content: 'The database connection is timing out due to pool exhaustion' },
  { content: 'Try restarting the service and checking the logs' },
  { content: 'Completely unrelated message about lunch' },
];

const filtered = filterByRelevance(sampleMessages, 'database connection timeout');
assert('Returns messages matching query terms', filtered.length >= 1);
assert('Includes message with "database" keyword', filtered.some(m => m.content.includes('database')));

const allReturned = filterByRelevance(sampleMessages, 'ab');
assert('Returns all messages for query shorter than 3 chars', allReturned.length === sampleMessages.length);

const noTerms = filterByRelevance(sampleMessages, 'the a is');
assert('Returns all messages when only stop words in query', noTerms.length === sampleMessages.length);

// ---------------------------------------------------------------------------
// formatSearchResults — no results
// ---------------------------------------------------------------------------
console.log('\n--- formatSearchResults: empty results ---');

const emptyResult = formatSearchResults({ results: { messages: [], files: [] } }, 'anything');
assert('Returns "No similar problems found." when empty', emptyResult === 'No similar problems found.');

// ---------------------------------------------------------------------------
// formatSearchResults — with messages
// ---------------------------------------------------------------------------
console.log('\n--- formatSearchResults: with messages ---');

const mockResults = {
  results: {
    messages: [
      {
        author_name: 'Alice',
        content: 'You need to increase the connection pool size in your config file to fix the timeout error',
        permalink: 'https://slack.com/archives/C123/p456',
        is_author_bot: false,
      },
      {
        author_name: 'POC App',
        content: 'Searching for similar problems and solutions...',
        permalink: 'https://slack.com/archives/C123/p789',
        is_author_bot: true,
      },
      {
        author_name: 'Bob',
        content: 'Short msg',
        permalink: 'https://slack.com/archives/C123/p101',
        is_author_bot: false,
      },
    ],
    files: [],
  },
};

const formatted = formatSearchResults(mockResults, 'connection pool timeout');
assert('Includes human message in output', formatted.includes('Alice'));
assert('Excludes bot messages (is_author_bot)', !formatted.includes('POC App'));
assert('Excludes messages shorter than 20 chars', !formatted.includes('Short msg'));
assert('Contains permalink', formatted.includes('https://slack.com'));
assert('Contains result count header', formatted.includes('similar messages'));

// ---------------------------------------------------------------------------
// formatSearchResults — bot mention filtering
// ---------------------------------------------------------------------------
console.log('\n--- formatSearchResults: bot mention filtering ---');

const mentionResults = {
  results: {
    messages: [
      {
        author_name: 'Carol',
        content: '<@U12345> can you help me with the deploy pipeline? It keeps failing on the build step',
        permalink: 'https://slack.com/archives/C123/p999',
        is_author_bot: false,
      },
    ],
    files: [],
  },
};

const mentionFormatted = formatSearchResults(mentionResults, 'deploy pipeline');
assert('Excludes messages containing <@U (bot mentions)', mentionFormatted === 'No similar problems found.');

// ---------------------------------------------------------------------------
// formatSearchResults — question pattern filtering
// ---------------------------------------------------------------------------
console.log('\n--- formatSearchResults: question pattern filtering ---');

const questionResults = {
  results: {
    messages: [
      {
        author_name: 'Dave',
        content: 'how to fix the deploy pipeline when it fails on build step',
        permalink: 'https://slack.com/archives/C123/p111',
        is_author_bot: false,
      },
      {
        author_name: 'Eve',
        content: 'The deploy pipeline fails because the build step needs a newer Node version installed',
        permalink: 'https://slack.com/archives/C123/p222',
        is_author_bot: false,
      },
    ],
    files: [],
  },
};

const questionFormatted = formatSearchResults(questionResults, 'deploy pipeline build');
assert('Excludes messages starting with question patterns', !questionFormatted.includes('Dave'));
assert('Includes answer-style messages', questionFormatted.includes('Eve'));

// ---------------------------------------------------------------------------
// thread-reader: parsePermalink
// ---------------------------------------------------------------------------
console.log('\n--- parsePermalink ---');

const { parsePermalink } = require('../helpers/thread-reader');

const parsed1 = parsePermalink('https://pujasworkspacegroup.slack.com/archives/C0BD9JAHQ30/p1782453255646679');
assert('Extracts channel ID from permalink', parsed1?.channelId === 'C0BD9JAHQ30');
assert('Converts p-timestamp to ts format (dot at position 10)', parsed1?.threadTs === '1782453255.646679');

const parsed2 = parsePermalink('https://slack.com/archives/C123ABC/p1234567890123456');
assert('Handles short workspace URL', parsed2?.channelId === 'C123ABC');
assert('Converts 16-digit p-ts correctly', parsed2?.threadTs === '1234567890.123456');

assert('Returns null for invalid permalink', parsePermalink('not-a-permalink') === null);
assert('Returns null for null input', parsePermalink(null) === null);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n--- Results: ${passed} passed, ${failed} failed ---\n`);
if (failed > 0) process.exit(1);
