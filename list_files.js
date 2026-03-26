const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lccqjhldexbjxsqkiqur.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjY3FqaGxkZXhianhzcWtpcXVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDk0MTQxNywiZXhwIjoyMDg2NTE3NDE3fQ.QaEsLgxlJdp5AWP-Piplnbwpfz_doeI_VCCEcD4ii2I';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listFiles() {
  console.log(`Checking project: ${supabaseUrl}`);
  const { data, error } = await supabase
    .from('knowledge_documents')
    .select('id, title, file_type, brand, created_at');

  if (error) {
    console.error('Error fetching documents:', error.message);
    return;
  }

  const results = [];
  for (const doc of data) {
    const { count, error: countError } = await supabase
      .from('knowledge_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', doc.id);
    
    results.push({
      ...doc,
      chunk_count: count || 0
    });
  }

  console.log('--- SYSTEM STATUS: INDEXED FILES ---');
  if (results.length === 0) {
    console.log('No documents found in knowledge_documents.');
  } else {
    results.forEach(res => {
        console.log(`- [${res.chunk_count > 0 ? 'INDEXED' : 'PENDING'}] ${res.title} (${res.chunk_count} chunks) - Created: ${res.created_at}`);
    });
  }
}

listFiles();
