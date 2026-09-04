-- Sprint 014B / #185
-- Settings must be able to manage committed imports after app restart.
create or replace function private.list_profile_import_jobs_v1(target_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_personal_profile_owner_v1(target_profile_id);

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'jobId', job.id,
        'profileId', job.profile_id,
        'sourceProvider', job.source_provider,
        'datasetKind', job.dataset_kind,
        'fileName', job.file_name,
        'fileFingerprint', job.file_fingerprint,
        'status', job.status,
        'totalRows', job.total_rows,
        'matchedRows', job.matched_rows,
        'ambiguousRows', job.ambiguous_rows,
        'unmatchedRows', job.unmatched_rows,
        'skippedRows', job.skipped_rows,
        'committedAt', job.committed_at,
        'rows', '[]'::jsonb
      )
      order by coalesce(job.committed_at, job.updated_at) desc, job.id
    )
    from private.profile_import_jobs as job
    where job.profile_id = target_profile_id
      and job.status <> 'REMOVED'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.list_profile_import_jobs_v1(target_profile_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.list_profile_import_jobs_v1(target_profile_id);
$$;

revoke all on function private.list_profile_import_jobs_v1(uuid) from public, anon, authenticated;
grant execute on function private.list_profile_import_jobs_v1(uuid) to authenticated;

revoke all on function public.list_profile_import_jobs_v1(uuid) from public, anon;
grant execute on function public.list_profile_import_jobs_v1(uuid) to authenticated;
