const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('Applying push_subscriptions migration...');
  
  const { error } = await supabase.rpc('exec_sql', {
    sql_query: `
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        subscription JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

      CREATE POLICY "Users can manage their own subscriptions"
        ON push_subscriptions
        FOR ALL
        USING (auth.uid() = user_id);
    `
  });

  if (error) {
    // If rpc('exec_sql') is not available, we might need another way.
    // Usually, we can use the dashboard, but I will try to use a direct query if possible.
    console.error('Error applying migration via RPC:', error.message);
    console.log('Falling back to direct query if possible...');
    
    const { error: queryError } = await supabase.from('push_subscriptions').select('id').limit(1);
    if (queryError && queryError.code === '42P01') {
      console.log('Table does not exist. Please apply the migration manually in Supabase Dashboard:');
      console.log(`
        CREATE TABLE push_subscriptions (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          subscription JSONB NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
    } else {
      console.log('Table already exists or error was different.');
    }
  } else {
    console.log('Migration applied successfully.');
  }
}

runMigration();
