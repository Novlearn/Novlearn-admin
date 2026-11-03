\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('mission.uid',true),'')::uuid $$;
CREATE FUNCTION public.is_novlearn_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('mission.role',true),'')='admin' $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid(),public.is_novlearn_admin() TO authenticated;
\ir preview-snapshots.sql
CREATE FUNCTION pg_temp.assertion(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; END $$;
CREATE FUNCTION pg_temp.denied(statement text,expected text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN EXECUTE statement; RAISE EXCEPTION 'statement unexpectedly accepted'; EXCEPTION WHEN OTHERS THEN IF SQLSTATE<>expected THEN RAISE EXCEPTION 'Expected %, got %: %',expected,SQLSTATE,SQLERRM; END IF; END $$;
DO $$
DECLARE first jsonb; second jsonb; third jsonb; returned jsonb; i integer;
 official jsonb := '{"schemaVersion":5,"engineVersion":"0.1.0","synthetic":true}';
BEGIN
 PERFORM set_config('mission.uid','10000000-0000-4000-8000-000000000001',false);
 PERFORM set_config('mission.role','admin',false);
 SET LOCAL ROLE authenticated;
 first:=public.admin_put_preview_snapshot(repeat('a',64),42,official,repeat('b',64));
 returned:=public.admin_get_preview_snapshot((first->>'previewId')::uuid,repeat('b',64));
 PERFORM pg_temp.assertion(returned=first,'snapshot survives a separate RPC read');
 PERFORM pg_temp.assertion(returned->'official'=official,'private JSON is preserved');
 PERFORM pg_temp.assertion((first->>'expiresAt')::bigint BETWEEN floor(extract(epoch from clock_timestamp())*1000)::bigint+590000 AND floor(extract(epoch from clock_timestamp())*1000)::bigint+600000,'TTL is ten minutes');
 PERFORM pg_temp.denied('select * from novlearn_admin_private.preview_snapshots','42501');
 PERFORM pg_temp.denied(format('select public.admin_get_preview_snapshot(%L,%L)',first->>'previewId',repeat('c',64)),'P0002');
 PERFORM set_config('mission.uid','10000000-0000-4000-8000-000000000002',false);
 PERFORM pg_temp.denied(format('select public.admin_get_preview_snapshot(%L,%L)',first->>'previewId',repeat('b',64)),'P0002');
 PERFORM set_config('mission.role','student',false);
 PERFORM pg_temp.denied(format('select public.admin_get_preview_snapshot(%L,%L)',first->>'previewId',repeat('b',64)),'42501');
 PERFORM pg_temp.denied(format('select public.admin_put_preview_snapshot(%L,42,%L,%L)',repeat('a',64),official,repeat('b',64)),'42501');
 PERFORM set_config('mission.role','admin',false);
 PERFORM set_config('mission.uid','',false);
 PERFORM pg_temp.denied(format('select public.admin_get_preview_snapshot(%L,%L)',first->>'previewId',repeat('b',64)),'42501');
 PERFORM set_config('mission.uid','10000000-0000-4000-8000-000000000001',false);
 second:=public.admin_put_preview_snapshot(repeat('a',64),1,official,repeat('b',64));
 third:=public.admin_put_preview_snapshot(repeat('a',64),2,official,repeat('b',64));
 PERFORM pg_temp.denied(format('select public.admin_get_preview_snapshot(%L,%L)',first->>'previewId',repeat('b',64)),'P0002');
 PERFORM pg_temp.assertion(public.admin_get_preview_snapshot((second->>'previewId')::uuid,repeat('b',64))->'official'=official,'second snapshot remains');
 RESET ROLE;
 UPDATE novlearn_admin_private.preview_snapshots SET expires_at=clock_timestamp()-interval '1 second' WHERE id=(third->>'previewId')::uuid;
 SET LOCAL ROLE authenticated;
 PERFORM pg_temp.denied(format('select public.admin_get_preview_snapshot(%L,%L)',third->>'previewId',repeat('b',64)),'P0002');
 FOR i IN 3..33 LOOP
  PERFORM set_config('mission.uid',('10000000-0000-4000-8000-'||lpad(i::text,12,'0')),false);
  PERFORM public.admin_put_preview_snapshot(repeat('a',64),42,official,repeat('b',64));
 END LOOP;
 PERFORM set_config('mission.uid','10000000-0000-4000-8000-999999999999',false);
 PERFORM pg_temp.denied(format('select public.admin_put_preview_snapshot(%L,42,%L,%L)',repeat('a',64),official,repeat('b',64)),'P0001');
 RESET ROLE;
 PERFORM pg_temp.assertion((select count(*) from novlearn_admin_private.preview_snapshots)=32,'global capacity remains thirty-two');
 SET LOCAL ROLE anon;
 PERFORM pg_temp.denied(format('select public.admin_get_preview_snapshot(%L,%L)',first->>'previewId',repeat('b',64)),'42501');
 RESET ROLE;
END $$;
SELECT 'PASS: ownership, separate calls, TTL, opaque IDs, artifact, direct ACL, anon/student/null identity, owner/global quotas' as snapshot_copy_result;
\ir preview-snapshots-rollback.sql
SELECT to_regclass('novlearn_admin_private.preview_snapshots') IS NULL AS rollback_received;
