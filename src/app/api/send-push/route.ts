import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Setup VAPID keys
webpush.setVapidDetails(
  'mailto:admin@atmfieldmaster.com',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { targetUser, senderName, title, body } = await request.json();

    // 1. Find all subscriptions for the target user
    // We need to find the user_id for the target_user (engineer name)
    const { data: engineer } = await supabase
      .from('engineers')
      .select('id')
      .eq('name', targetUser)
      .single();

    if (!engineer) {
      // If no engineer found, maybe it's 'ALL' or we just skip
      return NextResponse.json({ success: false, error: 'User not found' });
    }

    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', engineer.id);

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: false, error: 'No subscriptions found for user' });
    }

    // 2. Send push to each subscription
    const payload = JSON.stringify({
      title: title || `🚨 ALERTA de ${senderName}`,
      body: body || `${senderName} solicita tu atención inmediata.`,
      url: '/dashboard/team'
    });

    const pushPromises = subscriptions.map(sub => 
      webpush.sendNotification(sub.subscription, payload)
        .catch(err => console.error('Push error for sub:', err))
    );

    await Promise.all(pushPromises);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('API Push error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
