-- Keep table integrity equivalent to the importer function validation even for
-- privileged/service writes.
alter table private.profile_import_rows
  drop constraint profile_import_rows_rating_valid,
  add constraint profile_import_rows_rating_valid check (
    (evidence_kind = 'RATED' and rating is not null and rating between 0 and 10)
    or (evidence_kind <> 'RATED' and rating is null)
  );

alter table private.profile_bootstrap_evidence
  drop constraint profile_bootstrap_evidence_rating_valid,
  add constraint profile_bootstrap_evidence_rating_valid check (
    (evidence_kind = 'RATED' and rating is not null and rating between 0 and 10)
    or (evidence_kind <> 'RATED' and rating is null)
  );
