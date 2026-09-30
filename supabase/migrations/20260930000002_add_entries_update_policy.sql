-- Add UPDATE policy for authenticated users on public.entries
-- This allows updating the receipt_path when uploading a receipt.
create policy "entries_update"
  on public.entries for update
  to authenticated
  using (true)
  with check (true);
