-- Verify aggregate equality without exporting any user rows or changing data.
BEGIN READ ONLY;
SET LOCAL statement_timeout='30s';
DO $actor$ DECLARE actor uuid; BEGIN
 SELECT p.id INTO actor FROM public.profiles p JOIN auth.users a ON a.id=p.id
 WHERE p.role='admin' AND a.is_anonymous IS FALSE LIMIT 1;
 IF actor IS NULL THEN RAISE EXCEPTION 'No permanent Admin'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor::text,'role','authenticated','is_anonymous',false)::text,true);
END $actor$;
SET LOCAL ROLE authenticated;
DO $verify$
DECLARE activity jsonb; users jsonb; pedagogy jsonb; next_page jsonb;
 first_day date:=(statement_timestamp() AT TIME ZONE 'UTC')::date-29;
 until_day date:=(statement_timestamp() AT TIME ZONE 'UTC')::date+1;
 accounts_count bigint; created_count bigint; exercise_count bigint; duel_count bigint;
 completed_count bigint; active_count bigint; correct_count bigint; incorrect_count bigint; key text;
BEGIN
 activity:=public.admin_read_activity(first_day,until_day);
 users:=public.admin_read_users(first_day,until_day,'',NULL,NULL,25);
 SELECT count(*),count(*) FILTER(WHERE created_at>=(first_day::timestamp AT TIME ZONE 'UTC')
  AND created_at<(until_day::timestamp AT TIME ZONE 'UTC') AND created_at<=statement_timestamp())
 INTO accounts_count,created_count FROM novlearn_admin_api.accounts WHERE is_anonymous IS FALSE;
 IF activity->'accounts'->>'total' IS DISTINCT FROM accounts_count::text
  OR activity->'accounts'->>'anonymous' IS DISTINCT FROM '0'
  OR activity->'totals'->>'accountsCreated' IS DISTINCT FROM created_count::text
  OR users->>'total' IS DISTINCT FROM accounts_count::text
  OR jsonb_array_length(users->'items')<>least(25,accounts_count)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(users->'items') item WHERE item->>'anonymous' IS DISTINCT FROM 'false') THEN
  RAISE EXCEPTION 'Guest accounts still affect totals or user list';
 END IF;
 IF users->>'next' IS NOT NULL THEN
  next_page:=public.admin_read_users(first_day,until_day,'',(users->>'next')::uuid,NULL,25);
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(next_page->'items') item WHERE item->>'anonymous' IS DISTINCT FROM 'false')
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(users->'items') a JOIN jsonb_array_elements(next_page->'items') b ON a->>'id'=b->>'id') THEN
   RAISE EXCEPTION 'Filtered pagination changed';
  END IF;
 END IF;
 SELECT count(*),count(*) FILTER(WHERE a.is_abandoned IS NOT TRUE AND a.is_correct IS TRUE),
  count(*) FILTER(WHERE a.is_abandoned IS NOT TRUE AND a.is_correct IS FALSE)
 INTO exercise_count,correct_count,incorrect_count
 FROM public.exercise_attempts a JOIN novlearn_admin_api.accounts u ON u.id=a.user_id AND u.is_anonymous IS FALSE
 WHERE a.attempted_at>=(first_day::timestamp AT TIME ZONE 'UTC')
  AND a.attempted_at<(until_day::timestamp AT TIME ZONE 'UTC') AND a.attempted_at<=statement_timestamp();
 SELECT count(*) INTO duel_count FROM public.duel_attempts a
 JOIN novlearn_admin_api.accounts u ON u.id=a.player_id AND u.is_anonymous IS FALSE
 WHERE a.submitted_at>=(first_day::timestamp AT TIME ZONE 'UTC')
  AND a.submitted_at<(until_day::timestamp AT TIME ZONE 'UTC') AND a.submitted_at<=statement_timestamp();
 SELECT count(*) INTO completed_count FROM public.duels d
 JOIN novlearn_admin_api.accounts p1 ON p1.id=d.player1_id AND p1.is_anonymous IS FALSE
 JOIN novlearn_admin_api.accounts p2 ON p2.id=d.player2_id AND p2.is_anonymous IS FALSE
 WHERE d.status='finished' AND d.finished_at>=(first_day::timestamp AT TIME ZONE 'UTC')
  AND d.finished_at<(until_day::timestamp AT TIME ZONE 'UTC') AND d.finished_at<=statement_timestamp();
 SELECT count(*) INTO active_count FROM (
  SELECT a.user_id AS id FROM public.exercise_attempts a WHERE a.attempted_at>=(first_day::timestamp AT TIME ZONE 'UTC')
   AND a.attempted_at<(until_day::timestamp AT TIME ZONE 'UTC') AND a.attempted_at<=statement_timestamp()
  UNION SELECT a.player_id FROM public.duel_attempts a WHERE a.submitted_at>=(first_day::timestamp AT TIME ZONE 'UTC')
   AND a.submitted_at<(until_day::timestamp AT TIME ZONE 'UTC') AND a.submitted_at<=statement_timestamp()
 ) active JOIN novlearn_admin_api.accounts u ON u.id=active.id AND u.is_anonymous IS FALSE;
 IF activity->'totals'->>'exerciseAttempts' IS DISTINCT FROM exercise_count::text
  OR activity->'totals'->>'duelAttempts' IS DISTINCT FROM duel_count::text
  OR activity->'totals'->>'completedDuels' IS DISTINCT FROM completed_count::text
  OR activity->'totals'->>'activeAccounts' IS DISTINCT FROM active_count::text
  OR activity->'totals'->>'correct' IS DISTINCT FROM correct_count::text
  OR activity->'totals'->>'incorrect' IS DISTINCT FROM incorrect_count::text THEN
  RAISE EXCEPTION 'Guest activity still affects statistics';
 END IF;
 pedagogy:=public.admin_read_pedagogy(first_day,until_day,NULL,NULL,NULL,NULL,'all','chapter','attempts','1');
 FOREACH key IN ARRAY ARRAY['exerciseAttempts','duelAttempts','completedDuels','activeAccounts'] LOOP
  IF pedagogy->'totals'->>key IS DISTINCT FROM activity->'totals'->>key THEN
   RAISE EXCEPTION 'Pedagogy cohort differs: %',key;
  END IF;
 END LOOP;
END $verify$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: registered accounts, creation dates, user pagination, attempts, success counts, active accounts, duel participants and pedagogy cohort; no personal rows exported' AS qualification;
