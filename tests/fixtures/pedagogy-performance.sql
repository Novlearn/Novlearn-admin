-- Only on the driver's NEW, network-none SQL69 restoration. Never an app DB.
-- Explicit event IDs; no constraint/trigger/RLS disabled and no sequence reset.
BEGIN;
SET LOCAL statement_timeout='60s';
SET LOCAL lock_timeout='3s';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM auth.users WHERE id::text LIKE 'c9100000-0000-4000-8000-%')
   OR EXISTS(SELECT 1 FROM public.exercises WHERE id BETWEEN 983000001 AND 983002000)
 THEN RAISE EXCEPTION 'Performance fixture already seeded or namespace occupied'; END IF;
END; $$;
INSERT INTO auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at,is_anonymous)
SELECT ('c9100000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 'authenticated','authenticated','perf-'||i||'@novlearn-admin.local.invalid',
 jsonb_build_object('first_name','LOCAL PERFORMANCE '||i,'birth_date','2000-01-01'),
 '2026-07-20T00:00:00Z',now(),false FROM generate_series(1,500) i;
INSERT INTO public.chapters(id,name,order_index,aliases)
SELECT ('ac100000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'PERF Chapter '||i,2000+i,
 ARRAY['PERF Alias '||i]||CASE WHEN i IN (1,2) THEN ARRAY['PERF AMBIGU'] ELSE '{}'::text[] END
FROM generate_series(1,300) i;
INSERT INTO public.competences(id,name,chapter_id,max_points)
SELECT 'perf_skill_'||i,'PERF Skill '||i,
 ('ac100000-0000-4000-8000-'||lpad(((i%300)+1)::text,12,'0'))::uuid,10
FROM generate_series(1,600) i;
INSERT INTO public.exercises(id,title,app_title,chapter,difficulty,"Is_Flash",competences,competence_id,content)
SELECT 983000000+i,'LOCAL PERFORMANCE '||i,'LOCAL PERFORMANCE '||i,
 CASE WHEN i%41=0 THEN 'PERF Unknown' WHEN i%37=0 THEN 'PERF AMBIGU'
  WHEN i%11=0 THEN 'PERF Alias '||((i%300)+1) ELSE 'PERF Chapter '||((i%300)+1) END,
 CASE WHEN i%7=0 THEN NULL ELSE (ARRAY['easy','medium','hard'])[(i%3)+1] END,
 CASE WHEN i%13=0 THEN NULL ELSE i%2=1 END,
 CASE WHEN i%29=0 OR i%19=0 THEN '{}'::text[] ELSE
   ARRAY['perf_skill_'||((i%600)+1),'perf_skill_'||(((i+1)%600)+1),'perf_skill_'||((i%600)+1)]||
     CASE WHEN i%23=0 THEN ARRAY['perf_missing'] ELSE '{}'::text[] END END,
 CASE WHEN i%19=0 AND i%29<>0 THEN 'perf_skill_'||(((i+2)%600)+1) ELSE NULL END,'{}'
FROM generate_series(1,2000) i;
INSERT INTO public.duels(id,player1_id,player2_id,exercise_id,status,finished_at)
SELECT 983100000+i,
 ('c9100000-0000-4000-8000-'||lpad((((i-1)%500)+1)::text,12,'0'))::uuid,
 ('c9100000-0000-4000-8000-'||lpad(((i%500)+1)::text,12,'0'))::uuid,
 983000000+i,CASE WHEN i%3=0 THEN 'active' ELSE 'finished' END,
 CASE WHEN i%3=0 THEN NULL ELSE ('2026-10-18T12:00:00Z'::timestamptz-(i%90)*interval '1 day') END
FROM generate_series(1,2000) i;
INSERT INTO public.exercise_attempts(id,user_id,exercise_id,is_correct,is_abandoned,attempted_at)
SELECT 983200000+i,
 ('c9100000-0000-4000-8000-'||lpad((((i*7+i/2000)%500)+1)::text,12,'0'))::uuid,
 CASE WHEN i%101=0 THEN NULL ELSE 983000000+(i%2000)+1 END,
 i%3=0 AND i%97<>0,i%11=0,
 CASE WHEN i%97=0 THEN NULL ELSE ('2026-10-18T12:00:00Z'::timestamptz-(i%90)*interval '1 day') END
FROM generate_series(1,50000) i;
INSERT INTO public.duel_attempts(id,duel_id,player_id,element_id,is_correct,submitted_at)
SELECT 983400000+i,983100000+(i%2000)+1,
 ('c9100000-0000-4000-8000-'||lpad(((i%500)+1)::text,12,'0'))::uuid,
 (i/2000)+1,i%4=0,
 CASE WHEN i%103=0 THEN NULL ELSE ('2026-10-18T12:00:00Z'::timestamptz-(i%90)*interval '1 day') END
FROM generate_series(1,50000) i;
COMMIT;
ANALYZE auth.users;
ANALYZE public.chapters;
ANALYZE public.competences;
ANALYZE public.exercises;
ANALYZE public.exercise_attempts;
ANALYZE public.duels;
ANALYZE public.duel_attempts;
