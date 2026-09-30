import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const path = request.nextUrl.searchParams.get('path');
  if (!path) return Response.json({ error: 'Missing path' }, { status: 400 });

  const { data, error } = await supabase.storage
    .from('receipts')
    .createSignedUrl(path, 60); // 60-second expiry

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ url: data.signedUrl });
}
