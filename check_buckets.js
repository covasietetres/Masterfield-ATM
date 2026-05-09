const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBuckets() {
  console.log('Checking storage buckets...');
  
  const { data: buckets, error } = await supabase.storage.listBuckets();
  
  if (error) {
    console.error('Error listing buckets:', error.message);
    return;
  }

  const requiredBuckets = ['manuals', 'media'];
  const existingBuckets = buckets.map(b => b.name);

  for (const bucketName of requiredBuckets) {
    if (!existingBuckets.includes(bucketName)) {
      console.log(`Bucket "${bucketName}" is missing. Creating...`);
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 52428800 // 50MB
      });
      if (createError) {
        console.error(`Error creating bucket "${bucketName}":`, createError.message);
      } else {
        console.log(`Bucket "${bucketName}" created successfully.`);
      }
    } else {
      console.log(`Bucket "${bucketName}" already exists.`);
    }
  }
}

checkBuckets();
