-- One stable catalogue identity, one statement snapshot, current pointer only.
-- Do not substitute MAX(revision), a source status or a historical receipt.
WITH request AS (
 SELECT $1::uuid AS catalog_id,statement_timestamp() AS observed_at
)
SELECT jsonb_build_object(
 'schemaVersion',1,
 'asOf',to_char(r.observed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
 'catalogId',r.catalog_id::text,
 'parent',CASE WHEN e.id IS NULL THEN NULL ELSE jsonb_build_object(
   'exerciseId',e.id::text,'catalogId',e.catalog_id::text,'activeVersionId',e.active_version_id::text,
   'publicationEpoch',e.publication_epoch::text,
   'archivedAt',to_char(e.admin_archived_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) END,
 'active',CASE WHEN v.id IS NULL THEN NULL ELSE jsonb_build_object(
   'versionId',v.id::text,'exerciseId',v.exercise_id::text,'revision',v.revision,
   'status',v.editorial_status,
   'publishedAt',to_char(v.published_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'definitionSha256',v.definition_sha256,'engineContract',v.engine_contract,
   'generationVersion',v.generation_version,'canonicalizationVersion',v.canonicalization_version) END
) AS active_version
FROM request r
LEFT JOIN public.exercises e ON e.catalog_id=r.catalog_id
LEFT JOIN public.exercise_versions v ON v.id=e.active_version_id;
