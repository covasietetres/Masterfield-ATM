const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBrands() {
  const { data, error } = await supabase
    .from('knowledge_documents')
    .select('brand')
    .limit(10);
  
  if (error) {
    console.error('Error fetching brands:', error.message);
    return;
  }

  const brands = [...new Set(data.map(d => d.brand))];
  console.log('Existing brands in DB:', brands);
}

checkBrands();
