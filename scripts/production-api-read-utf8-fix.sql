-- Repair this deployment only: Windows PowerShell decoded the UTF-8 SQL file
-- as WIN1252 before submission. Restore the original characters in the five
-- pinned invoker definitions. No signature, grant, policy or business row changes.
DO $repair$
DECLARE item record; corrected text; seen integer:=0;
 expected jsonb:='{"admin_read_activity":"eb102b0de47f22266ddc5085ddfc6a2d","admin_read_pedagogy":"6d3c7cebaa3bfb8eba9b9b2e28847cb6","admin_read_pedagogy_references":"f8bbebca5b5afe49bc27f7cff2a99e5f","admin_read_user_detail":"5d6f6f29072217bd9ed977e25c62eb24","admin_read_users":"a6ef2d71c1a2267f75f6603d5dc4bc12"}'::jsonb;
BEGIN
 FOR item IN SELECT p.proname,p.prosecdef,pg_get_functiondef(p.oid) AS definition
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND expected ? p.proname
 LOOP
  IF item.prosecdef OR md5(item.definition) IS DISTINCT FROM expected->>item.proname THEN
   RAISE EXCEPTION 'API definition changed: %',item.proname;
  END IF;
  corrected:=convert_from(convert_to(item.definition,'WIN1252'),'UTF8');
  IF item.proname IN ('admin_read_users','admin_read_user_detail')
   AND strpos(corrected,U&'Compte invit\00e9')=0 THEN
   RAISE EXCEPTION 'Expected canonical guest label missing';
  END IF;
  IF corrected<>item.definition THEN EXECUTE corrected; END IF;
  seen:=seen+1;
 END LOOP;
 IF seen<>5 THEN RAISE EXCEPTION 'Expected exactly five API functions'; END IF;
END $repair$;
NOTIFY pgrst,'reload schema';
