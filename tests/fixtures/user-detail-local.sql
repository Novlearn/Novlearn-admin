-- Driver-only fixture inside BEGIN/ROLLBACK on an empty network-isolated DB.
-- Never use this file to seed the running app: publication metadata here only
-- tests a reference projection and is not an Engine/pedagogical certification.
INSERT INTO public.exercises(id,chapter,difficulty,content,title,app_title) VALUES
(981100001,'LOCAL USER DETAIL','easy','{}','LOCAL USER DETAIL current title',repeat('😀',201));
INSERT INTO public.exercise_versions(id,exercise_id,revision,definition,engine_contract,
  generation_version,canonicalization_version,definition_sha256,approval_fingerprint_sha256)
VALUES('a8200000-0000-4000-8000-000000000001',981100001,1,__DEFINITION__::jsonb,
  'sql-projection-fixture','not-engine-certified','pg-jsonb-text-v1',repeat('0',64),repeat('0',64));
UPDATE public.profiles SET role='admin' WHERE id='a8100000-0000-4000-8000-000000000003';
UPDATE public.exercise_versions SET editorial_status='approved',approved_at=now(),
  approved_by='a8100000-0000-4000-8000-000000000003'
WHERE id='a8200000-0000-4000-8000-000000000001';
UPDATE public.exercise_versions SET editorial_status='published'
WHERE id='a8200000-0000-4000-8000-000000000001';
INSERT INTO public.exercise_attempts(id,user_id,exercise_id,is_correct,is_abandoned,attempted_at,exercise_version_id) VALUES
(981100001,'a8100000-0000-4000-8000-000000000001',981100001,false,false,'2026-10-16T12:00:00.123456Z',NULL),
(981100002,'a8100000-0000-4000-8000-000000000001',981100001,true,true,'2026-10-16T12:00:00.123456Z','a8200000-0000-4000-8000-000000000001'),
(981100003,'a8100000-0000-4000-8000-000000000001',981100001,true,false,statement_timestamp()+interval '1 hour',NULL);
INSERT INTO public.duel_attempts(id,duel_id,player_id,element_id,is_correct,submitted_at) VALUES
(981100002,981000001,'a8100000-0000-4000-8000-000000000001',2,true,'2026-10-16T12:00:00.123456Z'),
(981100003,981000001,'a8100000-0000-4000-8000-000000000001',3,false,NULL);
INSERT INTO public.user_progress(id,user_id,chapter,level,exercises_completed,last_activity) VALUES
(981100001,'a8100000-0000-4000-8000-000000000001','LOCAL USER DETAIL historical chapter',40,3,'2026-10-16T12:00:00Z'),
(981100002,'a8100000-0000-4000-8000-000000000001',repeat('é',201),NULL,NULL,NULL),
(981100003,'a8100000-0000-4000-8000-000000000001','LOCAL USER DETAIL invalid legacy count',10,-3,'2099-01-01T00:00:00Z'),
(981100004,'a8100000-0000-4000-8000-000000000002','LOCAL USER DETAIL guest chapter',5,1,'2026-10-16T12:00:00Z');
INSERT INTO public.chapters(id,name,order_index,emoji) VALUES
('a8300000-0000-4000-8000-000000000001','LOCAL USER DETAIL current chapter',901,'📚');
INSERT INTO public.competences(id,name,max_points,chapter_id) VALUES
('local_detail_😀',repeat('😀',201),10,'a8300000-0000-4000-8000-000000000001'),
('local_detail_￿','LOCAL USER DETAIL other competence',20,'a8300000-0000-4000-8000-000000000001');
INSERT INTO public.user_competence_scores(user_id,competence_id,points,streak,updated_at) VALUES
('a8100000-0000-4000-8000-000000000001','local_detail_😀',15,0,'2026-10-17T10:00:00Z'),
('a8100000-0000-4000-8000-000000000001','local_detail_￿',5,0,'2026-10-17T11:00:00Z'),
('a8100000-0000-4000-8000-000000000001','local_detail_unmatched',2,0,NULL),
('a8100000-0000-4000-8000-000000000002','local_detail_😀',1,0,'2026-10-17T10:00:00Z');
