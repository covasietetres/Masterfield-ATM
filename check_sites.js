const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  try {
    const { data, error } = await supabase
      .from('technical_sites')
      .select('*')
      .limit(1);

    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        console.log('Table technical_sites DOES NOT EXIST');
      } else {
        console.log('Error checking table:', error);
      }
    } else {
      console.log('Table technical_sites EXISTS');
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

check();
