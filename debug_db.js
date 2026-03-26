const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log('--- Checking Database State ---');
  
  // 1. Check knowledge_documents
  const { data: docs, error: docError } = await supabase
    .from('knowledge_documents')
    .select('id, title, content_text, created_at');
  
  if (docError) {
    console.error('Error fetching knowledge_documents:', docError.message);
  } else {
    console.log(`Found ${docs.length} documents in knowledge_documents.`);
    docs.forEach(doc => {
      console.log(`- [${doc.id}] ${doc.title} (Content length: ${doc.content_text?.length || 0})`);
    });
  }

  // 2. Check knowledge_chunks
  const { data: chunks, error: chunkError } = await supabase
    .from('knowledge_chunks')
    .select('id, document_id, content')
    .limit(5);

  if (chunkError) {
    console.error('Error fetching knowledge_chunks:', chunkError.message);
    if (chunkError.message.includes('not found')) {
        console.log('ALERT: Table "knowledge_chunks" does not exist! Did you run the SQL script?');
    }
  } else {
    console.log(`Found ${chunks.length} total chunks (limited to 5 in this view).`);
  }

  // 3. Check for the RPC function
  console.log('Checking for match_knowledge_chunks RPC...');
  const { error: rpcError } = await supabase.rpc('match_knowledge_chunks', {
    query_embedding: new Array(768).fill(0),
    match_threshold: 0.5,
    match_count: 1
  });

  if (rpcError) {
    console.error('RPC match_knowledge_chunks check failed:', rpcError.message);
    if (rpcError.message.includes('does not exist')) {
        console.log('ALERT: Function "match_knowledge_chunks" does not exist! Did you run the SQL script?');
    }
  } else {
    console.log('RPC function match_knowledge_chunks exists.');
  }
}

checkDatabase();
