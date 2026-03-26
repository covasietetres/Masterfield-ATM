const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lccqjhldexbjxsqkiqur.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjY3FqaGxkZXhianhzcWtpcXVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDk0MTQxNywiZXhwIjoyMDg2NTE3NDE3fQ.QaEsLgxlJdp5AWP-Piplnbwpfz_doeI_VCCEcD4ii2I';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
  console.log('--- Inspecting Table Columns ---');
  
  // Using an RPC call or a query that doesn't depend on table existence if possible?
  // Since I can't run raw SQL easily, I'll try to fetch one row and look at metadata if possible,
  // or just use a known-to-work introspection query if I can.
  
  // Let's try to query the information_schema via a trick if possible, 
  // but Supabase JS usually restricts to the API schema.
  
  // Let's just try to delete the tables if they are empty to start fresh.
  console.log('Attempting to check column types via a test insert (will fail but give info)...');
  
  const { error } = await supabase.from('engineers').insert({
    id: 'not-a-uuid', // If this gives "invalid input syntax for integer", we know it's integer
    name: 'test',
    city: 'test',
    supervisor: 'test',
    hire_date: '2025-01-01',
    access_key: 'test'
  });

  if (error) {
    console.log('Detected Error:', error.message);
  }
}

inspectSchema();
