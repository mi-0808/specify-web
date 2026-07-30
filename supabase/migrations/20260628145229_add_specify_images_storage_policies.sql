create policy "specify-images: public read"
on storage.objects for select
to public
using (bucket_id = 'specify-images');

create policy "specify-images: authenticated upload"
on storage.objects for insert
to authenticated, anon
with check (bucket_id = 'specify-images');
