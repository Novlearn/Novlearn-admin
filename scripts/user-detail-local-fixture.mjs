// Local test preparation shared by the two explicit Docker-fixture drivers.
// Returns fixed SQL only; it never connects, reads secrets or accepts an endpoint.
import { readFile } from 'node:fs/promises';
export const detailRowsFunction = `CREATE FUNCTION pg_temp.detail_seed_rows() RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE t record; hashes jsonb; result jsonb:='{}'; BEGIN
 FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','auth','novlearn_admin_private') ORDER BY 1,2 LOOP
  EXECUTE format('SELECT coalesce(jsonb_agg(encode(extensions.digest(to_jsonb(r)::text,''sha256''),''hex'') ORDER BY to_jsonb(r)::text),''[]''::jsonb) FROM %I.%I r',t.schemaname,t.tablename) INTO hashes;
  result:=result||jsonb_build_object(t.schemaname||'.'||t.tablename,hashes);
 END LOOP; RETURN result; END; $$;`;
export async function userDetailProgressSeedSql() {
  const seed = await readFile(
    'tests/fixtures/user-detail-progress-local.sql',
    'utf8',
  );
  return `BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
${detailRowsFunction}
CREATE TEMP TABLE detail_seed_before AS SELECT pg_temp.detail_seed_rows() AS rows;
${seed}
DO $preservation$
DECLARE before_rows jsonb; after_rows jsonb; entry record; allowed bigint; actual bigint;
BEGIN
 SELECT rows INTO STRICT before_rows FROM pg_temp.detail_seed_before;
 after_rows:=pg_temp.detail_seed_rows();
 IF (SELECT count(*) FROM jsonb_object_keys(before_rows))<>62 OR
    (SELECT count(*) FROM jsonb_object_keys(after_rows))<>62 THEN
   RAISE EXCEPTION 'Unexpected local table inventory';
 END IF;
 FOR entry IN SELECT key,value FROM jsonb_each(before_rows) LOOP
   allowed:=CASE entry.key WHEN 'public.chapters' THEN 1 WHEN 'public.competences' THEN 2
     WHEN 'public.user_progress' THEN 4 WHEN 'public.user_competence_scores' THEN 4 ELSE 0 END;
   actual:=jsonb_array_length(after_rows->entry.key)-jsonb_array_length(entry.value);
   IF actual<>allowed THEN RAISE EXCEPTION 'Unexpected additive fixture effect on %',entry.key; END IF;
   IF EXISTS(SELECT 1 FROM
     (SELECT value,count(*) AS n FROM jsonb_array_elements_text(entry.value) GROUP BY value) old
     LEFT JOIN (SELECT value,count(*) AS n FROM jsonb_array_elements_text(after_rows->entry.key) GROUP BY value) current USING(value)
     WHERE coalesce(current.n,0)<old.n) THEN
     RAISE EXCEPTION 'A preexisting row was modified or removed in %',entry.key;
   END IF;
 END LOOP;
END;
$preservation$;
SELECT jsonb_build_object('result','PASS','oldRowsPreservedAcrossTables',62,'newRows',11,
  'additions',jsonb_build_object('chapters',1,'competences',2,'user_progress',4,'user_competence_scores',4),
  'existingAttemptsOrUsersModified',false,'publicationOrVersionCreated',false);
COMMIT;`;
}
