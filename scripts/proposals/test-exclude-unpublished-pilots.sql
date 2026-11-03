\set ON_ERROR_STOP on
CREATE TABLE public.exercises(id bigint PRIMARY KEY,title text,chapter text,difficulty text,catalog_id uuid,active_version_id uuid);
INSERT INTO public.exercises VALUES
 (1,'Legacy','Chapter','Facile',NULL,NULL),
 (2,'Canonical draft','Only draft','Facile','10000000-0000-4000-8000-000000000002',NULL),
 (3,'Canonical published','Chapter','Moyen','10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003');
\ir exclude-unpublished-pilots-rollback.sql
DO $$ BEGIN IF public.get_random_exercise('Only draft',NULL)->>'id'<>'2' THEN RAISE EXCEPTION 'Historical leak not reproduced'; END IF; END $$;
\ir exclude-unpublished-pilots.sql
DO $$ DECLARE value json; i integer; BEGIN
 IF public.get_random_exercise('Only draft',NULL) IS NOT NULL THEN RAISE EXCEPTION 'Draft is still served'; END IF;
 IF public.get_random_exercise('Chapter','Facile')->>'id'<>'1' THEN RAISE EXCEPTION 'Legacy filter changed'; END IF;
 IF public.get_random_exercise('Chapter','Moyen')->>'id'<>'3' THEN RAISE EXCEPTION 'Active canonical revision missing'; END IF;
 FOR i IN 1..100 LOOP
  value:=public.get_random_exercise(NULL,NULL);
  IF value->>'id' NOT IN ('1','3') THEN RAISE EXCEPTION 'Unexpected random selection'; END IF;
 END LOOP;
END $$;
\ir exclude-unpublished-pilots-rollback.sql
DO $$ BEGIN IF md5(pg_get_functiondef('public.get_random_exercise(text,text)'::regprocedure)) <> '14fac9361afb35bb7fa64df3649551eb' THEN RAISE EXCEPTION 'Rollback differs from observed original'; END IF; END $$;
SELECT 'PASS: historical leak reproduced, draft excluded, chapter/difficulty preserved, 100 random selections, exact rollback' AS pilot_exclusion_copy_result;
