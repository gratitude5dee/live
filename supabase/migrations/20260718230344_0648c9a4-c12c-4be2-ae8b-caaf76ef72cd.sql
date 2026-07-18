
create policy takes_own on storage.objects
  for all to authenticated
  using (bucket_id = 'takes' and (select auth.uid())::text = (storage.foldername(name))[1])
  with check (bucket_id = 'takes' and (select auth.uid())::text = (storage.foldername(name))[1]);

create policy refs_own on storage.objects
  for all to authenticated
  using (bucket_id = 'refs' and (select auth.uid())::text = (storage.foldername(name))[1])
  with check (bucket_id = 'refs' and (select auth.uid())::text = (storage.foldername(name))[1]);
