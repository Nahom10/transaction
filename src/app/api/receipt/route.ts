import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const entryId = formData.get('entry_id') as string | null;

  if (!file || !entryId) {
    return Response.json({ error: 'Missing file or entry_id' }, { status: 400 });
  }

  const ext = file.name.split('.').pop();
  const filename = `${Date.now()}.${ext}`;
  const path = `${entryId}/${filename}`;

  const bytes = await file.arrayBuffer();
  const buffer = new Uint8Array(bytes);

  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  // Save receipt_path on the entry
  const { error: updateError } = await supabase
    .from('entries')
    .update({ receipt_path: path })
    .eq('id', entryId);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({ path });
}
