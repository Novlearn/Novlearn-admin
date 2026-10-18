-- Additive progress examples for the verified four-account local fixture only.
-- Caller must back up, open a transaction, and prove all older rows unchanged
-- before COMMIT. This fixture creates no attempt, user, version or publication.
DO $$ BEGIN
  IF (SELECT count(*) FROM auth.users)<>4 OR
     (SELECT count(*) FROM auth.users WHERE
       (id='a8100000-0000-4000-8000-000000000001' AND email='activity-a@example.test' AND NOT is_anonymous) OR
       (id='a8100000-0000-4000-8000-000000000002' AND email='activity-b@example.test' AND is_anonymous) OR
       (id='a8100000-0000-4000-8000-000000000003' AND email='activity-c@example.test' AND NOT is_anonymous) OR
       (id='a8100000-0000-4000-8000-000000000004' AND email='activity-d@example.test' AND NOT is_anonymous))<>4 OR
     NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='novlearn_user_detail_reader' AND NOT rolcanlogin) THEN
    RAISE EXCEPTION 'Progress examples require the exact isolated SQL-67 activity fixture';
  END IF;
  IF EXISTS(SELECT 1 FROM public.user_progress WHERE user_id IN ('a8100000-0000-4000-8000-000000000001','a8100000-0000-4000-8000-000000000002')) OR
     EXISTS(SELECT 1 FROM public.user_competence_scores WHERE user_id IN ('a8100000-0000-4000-8000-000000000001','a8100000-0000-4000-8000-000000000002')) THEN
    RAISE EXCEPTION 'Progress already exists; never replace or silently reseed it';
  END IF;
END; $$;
INSERT INTO public.chapters(id,name,order_index,emoji) VALUES
('a8400000-0000-4000-8000-000000000001','LOCAL DETAIL · chapitre actuel témoin',902,'📚');
INSERT INTO public.competences(id,name,max_points,chapter_id) VALUES
('local_detail_progress_a','LOCAL DETAIL · compétence témoin A',10,'a8400000-0000-4000-8000-000000000001'),
('local_detail_progress_b','LOCAL DETAIL · compétence témoin B',20,'a8400000-0000-4000-8000-000000000001');
INSERT INTO public.user_progress(id,user_id,chapter,level,exercises_completed,last_activity) VALUES
(981200001,'a8100000-0000-4000-8000-000000000001','LOCAL DETAIL · libellé de chapitre historique',40,3,'2026-10-16T12:00:00Z'),
(981200002,'a8100000-0000-4000-8000-000000000001','LOCAL DETAIL · données incomplètes',NULL,NULL,NULL),
(981200003,'a8100000-0000-4000-8000-000000000001','LOCAL DETAIL · anomalie historique signalée',10,-3,'2099-01-01T00:00:00Z'),
(981200004,'a8100000-0000-4000-8000-000000000002','LOCAL DETAIL · progression invitée',5,1,'2026-10-16T12:00:00Z');
INSERT INTO public.user_competence_scores(user_id,competence_id,points,streak,updated_at) VALUES
('a8100000-0000-4000-8000-000000000001','local_detail_progress_a',15,0,'2026-10-17T10:00:00Z'),
('a8100000-0000-4000-8000-000000000001','local_detail_progress_b',5,0,'2026-10-17T11:00:00Z'),
('a8100000-0000-4000-8000-000000000001','local_detail_progress_unmatched',2,0,NULL),
('a8100000-0000-4000-8000-000000000002','local_detail_progress_a',1,0,'2026-10-17T10:00:00Z');
