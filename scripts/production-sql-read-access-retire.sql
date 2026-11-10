-- Retire only the four former Admin read logins after the API/RLS switch.
-- Keep their grants/policies as operational history; no business data is changed.
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='admin_read_activity' AND NOT p.prosecdef)
 OR (SELECT count(*) FROM pg_roles WHERE rolname IN
  ('novlearn_admin_activity_service','novlearn_admin_users_service',
   'novlearn_admin_user_detail_service','novlearn_admin_pedagogy_service')
  AND NOT rolsuper AND NOT rolbypassrls)<>4 THEN
  RAISE EXCEPTION 'API or former reader baseline changed';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename IN
  ('novlearn_admin_activity_service','novlearn_admin_users_service',
   'novlearn_admin_user_detail_service','novlearn_admin_pedagogy_service')) THEN
  RAISE EXCEPTION 'Former SQL readers still have sessions; inspect before retiring';
 END IF;
END $guard$;
ALTER ROLE novlearn_admin_activity_service NOLOGIN;
ALTER ROLE novlearn_admin_users_service NOLOGIN;
ALTER ROLE novlearn_admin_user_detail_service NOLOGIN;
ALTER ROLE novlearn_admin_pedagogy_service NOLOGIN;
