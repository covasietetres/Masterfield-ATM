const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lccqjhldexbjxsqkiqur.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjY3FqaGxkZXhianhzcWtpcXVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDk0MTQxNywiZXhwIjoyMDg2NTE3NDE3fQ.QaEsLgxlJdp5AWP-Piplnbwpfz_doeI_VCCEcD4ii2I';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRetrieval() {
  console.log('--- Testing Vector Retrieval ---');
  
  // Create a dummy embedding of 768 zeros
  const dummyEmbedding = new Array(768).fill(0);
  
  const { data, error } = await supabase.rpc('match_knowledge_chunks', {
    query_embedding: dummyEmbedding,
    match_threshold: 0.0,
    match_count: 5
  });

  if (error) {
    console.error('Retrieval Test Error:', error.message);
    if (error.message.includes('does not exist')) {
        console.log('ALERT: match_knowledge_chunks function is missing!');
    }
  } else {
    console.log(`Success! Retrieval found ${data.length} potential matches for zero-vector.`);
    data.forEach((match, i) => {
        console.log(`Match ${i+1}: ${match.content.substring(0, 50)}... [Sim: ${match.similarity}]`);
    });
  }
}

testRetrieval();
