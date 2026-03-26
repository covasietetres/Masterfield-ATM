const { createClient } = require('@supabase/supabase-js');

// Current .env.local values
const supabaseUrl = 'https://lccqjhldexbjxsqkiqur.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjY3FqaGxkZXhianhzcWtpcXVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDk0MTQxNywiZXhwIjoyMDg2NTE3NDE3fQ.QaEsLgxlJdp5AWP-Piplnbwpfz_doeI_VCCEcD4ii2I';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log(`Checking project: ${supabaseUrl}`);
  
  // Check engineers table
  const { data: engData, error: engError } = await supabase
    .from('engineers')
    .select('*')
    .limit(1);

  if (engError) {
    console.error('Error fetching engineers:', engError.message);
  } else {
    console.log(`Table "engineers" exists. Found ${engData.length} entries.`);
  }

  // Check knowledge_documents table
  const { data: docData, error: docError } = await supabase
    .from('knowledge_documents')
    .select('*')
    .limit(1);

  if (docError) {
    console.error('Error fetching knowledge_documents:', docError.message);
  } else {
    console.log(`Table "knowledge_documents" exists. Found ${docData.length} entries.`);
  }
}

checkSchema();
