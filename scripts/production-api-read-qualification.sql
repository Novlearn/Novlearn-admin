-- Run after the approved API migration. All attempted writes are rolled back.
-- Uses existing identities without exporting user data, passwords or sessions.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $admin$ DECLARE actor uuid; BEGIN
 SELECT p.id INTO actor FROM public.profiles p JOIN auth.users a ON a.id=p.id
 WHERE p.role='admin' AND a.is_anonymous IS FALSE AND a.deleted_at IS NULL LIMIT 1;
 IF actor IS NULL THEN RAISE EXCEPTION 'No permanent Admin'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor::text,'role','authenticated','is_anonymous',false)::text,true);
END $admin$;
SET LOCAL ROLE authenticated;
DO $reads$ DECLARE result jsonb; guest uuid; guest_detail jsonb; BEGIN
 result:=jsonb_build_array(
  public.admin_read_activity('2026-11-01','2026-11-08'),
  public.admin_read_users('2026-11-01','2026-11-08','',NULL,NULL,25),
  public.admin_read_user_detail(auth.uid(),'2026-11-01','2026-11-08','history',NULL,NULL,25),
  public.admin_read_pedagogy('2026-11-01','2026-11-08',NULL,NULL,NULL,NULL,'all','chapter','attempts','1'),
  public.admin_read_pedagogy_references('chapter',''));
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(result) WITH ORDINALITY AS rows(value,position)
  WHERE (value->>'schemaVersion') IS DISTINCT FROM CASE WHEN position=4 THEN '2' ELSE '1' END) THEN
  RAISE EXCEPTION 'Invalid read envelope';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM novlearn_admin_api.accounts WHERE id=auth.uid()) THEN
  RAISE EXCEPTION 'Admin cannot read minimal Auth projection';
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(result->1->'items') item
  WHERE (item->>'anonymous')::boolean AND
   ((item->>'name') IS DISTINCT FROM U&'Compte invit\00e9' OR item->>'email' IS NOT NULL)) THEN
  RAISE EXCEPTION 'Guest name encoding or privacy contract changed';
 END IF;
 SELECT id INTO guest FROM novlearn_admin_api.accounts WHERE is_anonymous IS TRUE LIMIT 1;
 IF guest IS NOT NULL THEN
  guest_detail:=public.admin_read_user_detail(guest,'2026-11-01','2026-11-08','history',NULL,NULL,25);
  IF (guest_detail->'user'->>'name') IS DISTINCT FROM U&'Compte invit\00e9'
   OR guest_detail->'user'->>'email' IS NOT NULL THEN
   RAISE EXCEPTION 'Guest detail encoding or privacy contract changed';
  END IF;
 END IF;
END $reads$;
RESET ROLE;
DO $student$ DECLARE actor uuid; BEGIN
 SELECT p.id INTO actor FROM public.profiles p JOIN auth.users a ON a.id=p.id
 WHERE p.role='user' AND a.is_anonymous IS FALSE AND a.deleted_at IS NULL LIMIT 1;
 IF actor IS NULL THEN RAISE EXCEPTION 'No permanent ordinary account'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor::text,'role','authenticated','is_anonymous',false)::text,true);
END $student$;
SET LOCAL ROLE authenticated;
DO $denials$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid()) THEN RAISE EXCEPTION 'Student lost own profile'; END IF;
 IF EXISTS(SELECT 1 FROM novlearn_admin_api.accounts) THEN RAISE EXCEPTION 'Private Auth projection leaked'; END IF;
 BEGIN PERFORM public.admin_read_activity('2026-11-01','2026-11-08'); RAISE EXCEPTION 'Student accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.admin_read_users('2026-11-01','2026-11-08','',NULL,NULL,25); RAISE EXCEPTION 'Student accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.admin_read_user_detail(auth.uid(),'2026-11-01','2026-11-08','history',NULL,NULL,25); RAISE EXCEPTION 'Student accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.admin_read_pedagogy('2026-11-01','2026-11-08',NULL,NULL,NULL,NULL,'all','chapter','attempts','1'); RAISE EXCEPTION 'Student accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.admin_read_pedagogy_references('chapter',''); RAISE EXCEPTION 'Student accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.profiles SET role='admin' WHERE id=auth.uid(); RAISE EXCEPTION 'Self-promotion accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO public.profiles(id,email,first_name,birth_date,role)
  SELECT id,email,first_name,birth_date,'admin' FROM public.profiles WHERE id=auth.uid();
  RAISE EXCEPTION 'Privileged profile insertion accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $denials$;
RESET ROLE;
DO $anonymous$ BEGIN
 PERFORM set_config('request.jwt.claims',jsonb_build_object('role','anon')::text,true);
END $anonymous$;
SET LOCAL ROLE anon;
DO $denied$ BEGIN
 BEGIN PERFORM public.admin_read_activity('2026-11-01','2026-11-08'); RAISE EXCEPTION 'Anon accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $denied$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: five Admin reads, private Auth projection, student ownership, seven student refusals, anon refusal; no writes persisted' AS qualification;
