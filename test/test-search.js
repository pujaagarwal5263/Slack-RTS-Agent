require('dotenv').config();
const { searchSlack } = require('../helpers/rts-search');

async function testSearch() {
  try {
    console.log('Testing Slack Real-Time Search API...\n');
    
    // Test with a simple search query
    const query = 'help';
    console.log(`Searching for: "${query}"`);
    
    const results = await searchSlack(query, {
      channel_types: ['public_channel'],
      content_types: ['messages'],
      limit: 5,
    });
    
    const messages = results.results?.messages || [];
    const files = results.results?.files || [];
    console.log('\nSearch completed successfully!');
    console.log(`Found ${messages.length} messages, ${files.length} files`);
    
    if (messages.length > 0) {
      console.log('\nSample message result:');
      const firstMessage = messages[0];
      console.log(`Author: ${firstMessage.author_name || 'Unknown'}`);
      console.log(`Text: ${firstMessage.content?.substring(0, 100) || 'No text'}...`);
      console.log(`Link: ${firstMessage.permalink || 'No link'}`);
    }
    
    console.log('\n✅ Your Slack app is configured correctly!');
    console.log('✅ The Real-Time Search API is working!');
    
  } catch (error) {
    console.error('\n❌ Error during test:');
    console.error(error.message);
    
    if (error.message.includes('scope') || error.message.includes('permission')) {
      console.error('\n⚠️  Make sure your app has these scopes:');
      console.error('   - assistant.search.context (bot scope)');
      console.error('   - channels:history');
      console.error('   - channels:read');
    }
  }
}

testSearch();
