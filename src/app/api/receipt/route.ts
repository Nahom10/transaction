import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  console.log('[receipt] auth user:', user?.id, 'authError:', authError?.message);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const entryId = formData.get('entry_id') as string | null;

  console.log('[receipt] file:', file?.name, file?.size, file?.type, 'entryId:', entryId);

  if (!file || !entryId) {
    return Response.json({ error: 'Missing file or entry_id' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() ?? 'bin';
  const filename = `${Date.now()}.${ext}`;
  const path = `${entryId}/${filename}`;

  console.log('[receipt] uploading to path:', path);

  const bytes = await file.arrayBuffer();
  const buffer = new Uint8Array(bytes);

  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(path, buffer, { contentType: file.type, upsert: false });

  console.log('[receipt] uploadError:', uploadError?.message ?? 'none');

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: updated, error: updateError } = await supabase
    .from('entries')
    .update({ receipt_path: path })
    .eq('id', entryId)
    .select();

  console.log('[receipt] updated rows:', updated?.length ?? 0, 'updateError:', updateError?.message ?? 'none');

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  if (!updated || updated.length === 0) {
    return Response.json({
      error: 'Permission denied: could not update entry. Missing "entries_update" policy in Supabase.'
    }, { status: 403 });
  }

  return Response.json({ path });
}
