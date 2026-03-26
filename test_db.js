const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data } = await supabase
    .from('knowledge_documents')
    .select('id, title, content_text')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(data.map(d => ({
    title: d.title,
    hasText: !!d.content_text,
    length: d.content_text ? d.content_text.length : 0
  })));
}

check();
