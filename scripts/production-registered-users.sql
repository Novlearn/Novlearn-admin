-- Registered accounts only: filter aggregates and the user list at source.
-- Existing signatures, invoker execution, RLS and grants remain unchanged.
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $guard$ DECLARE item record; seen integer:=0; expected jsonb:='{"admin_read_activity":"eb102b0de47f22266ddc5085ddfc6a2d","admin_read_users":"b1b77958c20b3f41b8ec0b097e056f06","admin_read_pedagogy":"69b72d5970e4ba7446fc73e30bd0af35"}'; BEGIN
 FOR item IN SELECT p.oid,p.proname,p.prosecdef,pg_get_functiondef(p.oid) AS definition
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND expected ? p.proname
 LOOP
  IF item.prosecdef OR md5(item.definition) IS DISTINCT FROM expected->>item.proname
   OR has_function_privilege('anon',item.oid,'EXECUTE') THEN
   RAISE EXCEPTION 'Read API baseline changed: %',item.proname;
  END IF;
  seen:=seen+1;
 END LOOP;
 IF seen<>3 THEN RAISE EXCEPTION 'Expected three read functions'; END IF;
END $guard$;

CREATE OR REPLACE FUNCTION public.admin_read_activity(p_from date,p_until date) RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='10s'
 AS $rpc$
 BEGIN
   IF NOT coalesce((auth.uid() IS NOT NULL AND NOT coalesce((auth.jwt()->>'is_anonymous')::boolean,false) AND public.get_my_role()='admin'),false) THEN
     RAISE EXCEPTION 'Production Admin required' USING ERRCODE='42501';
   END IF;
   RETURN (
-- Fixed parameterized aggregate query. $1 is the inclusive UTC date and $2
-- the exclusive UTC date. The server adds the independently attested source
-- environment; this query never accepts an environment or a dynamic identifier.
WITH bounds AS MATERIALIZED (
  SELECT $1::date AS first_day, $2::date AS until_day, statement_timestamp() AS as_of
  WHERE $1::date >= date '2000-01-01' AND $2::date <= date '2200-01-01'
    AND $2::date - $1::date BETWEEN 1 AND 90
    AND $2::date <= (statement_timestamp() AT TIME ZONE 'UTC')::date + 1
), accounts AS MATERIALIZED (
  SELECT id,created_at,is_anonymous FROM novlearn_admin_api.accounts WHERE is_anonymous IS FALSE
), exercise_rows AS MATERIALIZED (
  SELECT a.user_id AS account_id,(a.attempted_at AT TIME ZONE 'UTC')::date AS day,
    CASE WHEN a.is_abandoned IS TRUE THEN 'abandoned'
      WHEN a.is_correct IS TRUE THEN 'correct'
      WHEN a.is_correct IS FALSE THEN 'incorrect'
      ELSE 'unclassified' END AS verdict
  FROM public.exercise_attempts a JOIN accounts account ON account.id=a.user_id CROSS JOIN bounds b
  WHERE a.attempted_at >= (b.first_day::timestamp AT TIME ZONE 'UTC')
    AND a.attempted_at < (b.until_day::timestamp AT TIME ZONE 'UTC')
    AND a.attempted_at <= b.as_of
), duel_rows AS MATERIALIZED (
  SELECT a.player_id AS account_id,(a.submitted_at AT TIME ZONE 'UTC')::date AS day
  FROM public.duel_attempts a JOIN accounts account ON account.id=a.player_id CROSS JOIN bounds b
  WHERE a.submitted_at >= (b.first_day::timestamp AT TIME ZONE 'UTC')
    AND a.submitted_at < (b.until_day::timestamp AT TIME ZONE 'UTC')
    AND a.submitted_at <= b.as_of
), active_rows AS MATERIALIZED (
  SELECT DISTINCT activity.account_id,activity.day
  FROM (SELECT account_id,day FROM exercise_rows UNION ALL SELECT account_id,day FROM duel_rows) activity
  JOIN accounts a ON a.id=activity.account_id
), exercise_days AS (
  SELECT day,count(*) AS attempts,
    count(*) FILTER(WHERE verdict='correct') AS correct,
    count(*) FILTER(WHERE verdict='incorrect') AS incorrect,
    count(*) FILTER(WHERE verdict='abandoned') AS abandoned,
    count(*) FILTER(WHERE verdict='unclassified') AS unclassified
  FROM exercise_rows GROUP BY day
), duel_days AS (
  SELECT day,count(*) AS attempts FROM duel_rows GROUP BY day
), active_days AS (
  SELECT day,count(*) AS accounts FROM active_rows GROUP BY day
), completed_days AS (
  SELECT (d.finished_at AT TIME ZONE 'UTC')::date AS day,count(*) AS duels
  FROM public.duels d JOIN accounts player1 ON player1.id=d.player1_id
    JOIN accounts player2 ON player2.id=d.player2_id CROSS JOIN bounds b
  WHERE d.status='finished'
    AND d.finished_at >= (b.first_day::timestamp AT TIME ZONE 'UTC')
    AND d.finished_at < (b.until_day::timestamp AT TIME ZONE 'UTC')
    AND d.finished_at <= b.as_of
  GROUP BY (d.finished_at AT TIME ZONE 'UTC')::date
), created_days AS (
  SELECT (a.created_at AT TIME ZONE 'UTC')::date AS day,count(*) AS accounts
  FROM accounts a CROSS JOIN bounds b
  WHERE a.created_at >= (b.first_day::timestamp AT TIME ZONE 'UTC')
    AND a.created_at < (b.until_day::timestamp AT TIME ZONE 'UTC')
    AND a.created_at <= b.as_of
  GROUP BY (a.created_at AT TIME ZONE 'UTC')::date
), daily AS MATERIALIZED (
  SELECT jsonb_build_object(
    'date',d.day::date::text,
    'activeAccounts',coalesce(a.accounts,0)::text,
    'exerciseAttempts',coalesce(e.attempts,0)::text,
    'duelAttempts',coalesce(t.attempts,0)::text,
    'completedDuels',coalesce(c.duels,0)::text,
    'accountsCreated',coalesce(n.accounts,0)::text,
    'correct',coalesce(e.correct,0)::text,
    'incorrect',coalesce(e.incorrect,0)::text,
    'abandoned',coalesce(e.abandoned,0)::text,
    'unclassified',coalesce(e.unclassified,0)::text
  ) AS value
  FROM bounds b CROSS JOIN LATERAL generate_series(b.first_day::timestamp,(b.until_day-1)::timestamp,interval '1 day') d(day)
  LEFT JOIN exercise_days e ON e.day=d.day::date
  LEFT JOIN duel_days t ON t.day=d.day::date
  LEFT JOIN active_days a ON a.day=d.day::date
  LEFT JOIN completed_days c ON c.day=d.day::date
  LEFT JOIN created_days n ON n.day=d.day::date
), totals AS (
  SELECT jsonb_build_object(
    'activeAccounts',(SELECT count(DISTINCT account_id)::text FROM active_rows),
    'exerciseAttempts',sum((value->>'exerciseAttempts')::numeric)::text,
    'duelAttempts',sum((value->>'duelAttempts')::numeric)::text,
    'completedDuels',sum((value->>'completedDuels')::numeric)::text,
    'accountsCreated',sum((value->>'accountsCreated')::numeric)::text,
    'correct',sum((value->>'correct')::numeric)::text,
    'incorrect',sum((value->>'incorrect')::numeric)::text,
    'abandoned',sum((value->>'abandoned')::numeric)::text,
    'unclassified',sum((value->>'unclassified')::numeric)::text
  ) AS value FROM daily
)
SELECT jsonb_build_object(
  'schemaVersion',1,
  'asOf',to_char(b.as_of AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'period',jsonb_build_object('from',b.first_day::text,'until',b.until_day::text),
  'accounts',jsonb_build_object('total',(SELECT count(*)::text FROM accounts),
    'anonymous',(SELECT count(*)::text FROM accounts WHERE is_anonymous IS TRUE)),
  'totals',(SELECT value FROM totals),
  'daily',(SELECT jsonb_agg(value ORDER BY value->>'date') FROM daily)
) AS statistics FROM bounds b
   );
 END $rpc$;

CREATE OR REPLACE FUNCTION public.admin_read_users(p_from date,p_until date,p_query text,p_after uuid,p_before uuid,p_limit integer) RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='10s'
 AS $rpc$
 BEGIN
   IF NOT coalesce((auth.uid() IS NOT NULL AND NOT coalesce((auth.jwt()->>'is_anonymous')::boolean,false) AND public.get_my_role()='admin'),false) THEN
     RAISE EXCEPTION 'Production Admin required' USING ERRCODE='42501';
   END IF;
   RETURN (
-- Fixed query: inclusive from, exclusive until, literal search, after UUID,
-- before UUID and trusted page size (1..25). Source label is server-attested.
WITH bounds AS MATERIALIZED (
 SELECT $1::date AS first_day,$2::date AS until_day,$3::text AS search,
   $4::uuid AS after_id,$5::uuid AS before_id,$6::integer AS page_size,
   statement_timestamp() AS as_of
 WHERE $1::date >= date '2000-01-01' AND $2::date <= date '2200-01-01'
   AND $2::date-$1::date BETWEEN 1 AND 90
   AND $2::date <= (statement_timestamp() AT TIME ZONE 'UTC')::date+1
   AND $3::text IS NOT NULL AND char_length($3::text)<=100 AND $3::text=btrim($3::text)
   AND NOT ($4::uuid IS NOT NULL AND $5::uuid IS NOT NULL)
   AND $6::integer BETWEEN 1 AND 25
), identities AS MATERIALIZED (
 SELECT a.id,a.is_anonymous AS anonymous,
   CASE WHEN a.is_anonymous THEN 'Compte invité'
     ELSE coalesce(nullif(btrim(concat_ws(' ',nullif(btrim(p.first_name),''),nullif(btrim(p.last_name),'')),
       U&'\0009\000a\000b\000c\000d\0020\00a0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200a\2028\2029\202f\205f\3000\feff'),''),'Nom non renseigné') END AS display_name,
   CASE WHEN a.is_anonymous THEN NULL ELSE a.email END AS email
 FROM novlearn_admin_api.accounts a LEFT JOIN public.profiles p ON p.id=a.id CROSS JOIN bounds
 WHERE a.is_anonymous IS FALSE
), matched AS MATERIALIZED (
 SELECT i.* FROM identities i CROSS JOIN bounds b
 WHERE b.search='' OR strpos(lower(i.display_name),lower(b.search))>0
   OR strpos(lower(coalesce(i.email,'')),lower(b.search))>0
), selected AS MATERIALIZED (
 SELECT m.* FROM matched m CROSS JOIN bounds b
 WHERE (b.after_id IS NULL OR m.id>b.after_id) AND (b.before_id IS NULL OR m.id<b.before_id)
 ORDER BY CASE WHEN $5::uuid IS NULL THEN m.id END ASC,
   CASE WHEN $5::uuid IS NOT NULL THEN m.id END DESC LIMIT $6::integer
), items AS (
 SELECT s.id,jsonb_build_object(
   'id',s.id::text,'name',left(s.display_name,200)||CASE WHEN char_length(s.display_name)>200 THEN '…' ELSE '' END,
   'nameTruncated',char_length(s.display_name)>200,'email',s.email,'anonymous',s.anonymous,
   'exerciseAttempts',e.volume::text,'duelAttempts',d.volume::text,
   'lastActivity',CASE WHEN greatest(e.last_at,d.last_at) IS NULL THEN NULL ELSE
     to_char(greatest(e.last_at,d.last_at) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END
 ) AS value FROM selected s CROSS JOIN bounds b
 CROSS JOIN LATERAL (SELECT count(*) AS volume,max(a.attempted_at) AS last_at
   FROM public.exercise_attempts a WHERE a.user_id=s.id
     AND a.attempted_at >= (b.first_day::timestamp AT TIME ZONE 'UTC')
     AND a.attempted_at < (b.until_day::timestamp AT TIME ZONE 'UTC') AND a.attempted_at<=b.as_of) e
 CROSS JOIN LATERAL (SELECT count(*) AS volume,max(a.submitted_at) AS last_at
   FROM public.duel_attempts a WHERE a.player_id=s.id
     AND a.submitted_at >= (b.first_day::timestamp AT TIME ZONE 'UTC')
     AND a.submitted_at < (b.until_day::timestamp AT TIME ZONE 'UTC') AND a.submitted_at<=b.as_of) d
)
SELECT jsonb_build_object(
 'schemaVersion',1,'asOf',to_char(b.as_of AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
 'period',jsonb_build_object('from',b.first_day::text,'until',b.until_day::text),
 'query',b.search,'cursor',jsonb_build_object('after',b.after_id::text,'before',b.before_id::text),
 'pageSize',b.page_size,'total',(SELECT count(*)::text FROM matched),
 'items',coalesce((SELECT jsonb_agg(value ORDER BY id) FROM items),'[]'::jsonb),
 'previous',CASE WHEN EXISTS(SELECT 1 FROM matched WHERE id<(SELECT id FROM selected ORDER BY id LIMIT 1))
   THEN (SELECT id::text FROM selected ORDER BY id LIMIT 1) ELSE NULL END,
 'next',CASE WHEN EXISTS(SELECT 1 FROM matched WHERE id>(SELECT id FROM selected ORDER BY id DESC LIMIT 1))
   THEN (SELECT id::text FROM selected ORDER BY id DESC LIMIT 1) ELSE NULL END
) AS users FROM bounds b
   );
 END $rpc$;

CREATE OR REPLACE FUNCTION public.admin_read_pedagogy(p_from date,p_until date,p_chapter uuid,p_competence text,p_difficulty text,p_exercise_type text,p_mode text,p_group_by text,p_sort text,p_page text) RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET statement_timeout='10s'
 AS $rpc$
 BEGIN
   IF NOT coalesce((auth.uid() IS NOT NULL AND NOT coalesce((auth.jwt()->>'is_anonymous')::boolean,false) AND public.get_my_role()='admin'),false) THEN
     RAISE EXCEPTION 'Production Admin required' USING ERRCODE='42501';
   END IF;
   RETURN (
-- Fixed aggregate query, never caller-supplied SQL or identifiers.
-- UTC start, exclusive end, chapter UUID, competence text, difficulty, type,
-- activity mode, grouping, ordering, decimal page. All counts remain text.
WITH bounds AS NOT MATERIALIZED (
 SELECT $1::date AS first_day,$2::date AS until_day,$3::uuid AS chapter,
   $4::text AS competence,$5::text AS difficulty,$6::text AS exercise_type,
   $7::text AS mode,$8::text AS grouping,$9::text AS ordering,$10::bigint AS page,
   statement_timestamp() AS as_of
 WHERE $1::date>=date '2000-01-01' AND $2::date<=date '2200-01-01'
   AND $2::date-$1::date BETWEEN 1 AND 90
   AND $2::date<=(statement_timestamp() AT TIME ZONE 'UTC')::date+1
   AND ($4::text IS NULL OR (char_length($4::text) BETWEEN 1 AND 200 AND $4::text !~ '[[:cntrl:]]'))
   AND ($5::text IS NULL OR $5::text IN ('easy','medium','hard','unknown'))
   AND ($6::text IS NULL OR $6::text IN ('classic','flash','unknown'))
   AND $7::text IN ('all','exercise','duel') AND $8::text IN ('chapter','competence','exercise')
   AND $9::text IN ('attempts','success') AND $10::bigint BETWEEN 1 AND 368934881474191032
), pagination AS MATERIALIZED (
 SELECT page FROM bounds
), registered_accounts AS MATERIALIZED (
 SELECT id FROM novlearn_admin_api.accounts WHERE is_anonymous IS FALSE
), raw_activity AS MATERIALIZED (
 SELECT 'exercise'::text AS kind,a.id AS row_id,a.exercise_id,a.user_id AS account_id,
   CASE WHEN a.is_abandoned IS TRUE THEN 'abandoned'
     WHEN a.is_correct IS TRUE THEN 'correct' WHEN a.is_correct IS FALSE THEN 'incorrect'
     ELSE 'unclassified' END AS verdict
 FROM public.exercise_attempts a JOIN registered_accounts account ON account.id=a.user_id CROSS JOIN bounds b
 WHERE b.mode IN ('all','exercise')
   AND a.attempted_at>=(b.first_day::timestamp AT TIME ZONE 'UTC')
   AND a.attempted_at<(b.until_day::timestamp AT TIME ZONE 'UTC') AND a.attempted_at<=b.as_of
 UNION ALL
 SELECT 'duel',a.id,d.exercise_id,a.player_id,
   CASE WHEN a.is_correct IS TRUE THEN 'correct' WHEN a.is_correct IS FALSE THEN 'incorrect'
     ELSE 'unclassified' END
 FROM public.duel_attempts a JOIN registered_accounts account ON account.id=a.player_id
 LEFT JOIN public.duels d ON d.id=a.duel_id CROSS JOIN bounds b
 WHERE b.mode IN ('all','duel')
   AND a.submitted_at>=(b.first_day::timestamp AT TIME ZONE 'UTC')
   AND a.submitted_at<(b.until_day::timestamp AT TIME ZONE 'UTC') AND a.submitted_at<=b.as_of
 UNION ALL
 SELECT 'completion',d.id,d.exercise_id,NULL::uuid,NULL::text
 FROM public.duels d JOIN registered_accounts player1 ON player1.id=d.player1_id
 JOIN registered_accounts player2 ON player2.id=d.player2_id CROSS JOIN bounds b
 WHERE b.mode IN ('all','duel') AND d.status='finished'
   AND d.finished_at>=(b.first_day::timestamp AT TIME ZONE 'UTC')
   AND d.finished_at<(b.until_day::timestamp AT TIME ZONE 'UTC') AND d.finished_at<=b.as_of
), chapter_refs AS MATERIALIZED (
 SELECT c.id,c.name,c.aliases,coalesce(nullif(btrim(c.name),''),'Chapitre sans nom') AS label
 FROM public.chapters c
), competence_refs AS MATERIALIZED (
 SELECT c.id,CASE WHEN ch.id IS NOT NULL THEN ch.label||' · ' ELSE '' END||
   coalesce(nullif(btrim(c.name),''),'Compétence sans nom') AS label
 FROM public.competences c LEFT JOIN chapter_refs ch ON ch.id=c.chapter_id
 WHERE char_length(c.id) BETWEEN 1 AND 200 AND c.id !~ '[[:cntrl:]]'
), catalogue AS MATERIALIZED (
 SELECT e.id,coalesce(nullif(btrim(e.app_title),''),nullif(btrim(e.title),''),'Exercice sans titre') AS label,
   CASE WHEN mapping.matches=1 THEN mapping.id ELSE NULL END AS chapter_id,
   CASE WHEN mapping.matches=1 THEN mapping.label ELSE NULL END AS chapter_label,
   CASE WHEN e.difficulty IN ('easy','medium','hard') THEN e.difficulty ELSE 'unknown' END AS difficulty,
   CASE WHEN e."Is_Flash" IS TRUE THEN 'flash' WHEN e."Is_Flash" IS FALSE THEN 'classic' ELSE 'unknown' END AS exercise_type,
   skills.ids AS skills
 FROM public.exercises e
 CROSS JOIN LATERAL (
   SELECT count(*) AS matches,min(c.id::text)::uuid AS id,min(c.label) AS label
   FROM chapter_refs c WHERE e.chapter=c.name OR e.chapter=ANY(c.aliases)
 ) mapping
 CROSS JOIN LATERAL (
   SELECT coalesce(array_agg(DISTINCT s COLLATE "C" ORDER BY s COLLATE "C"),'{}'::text[]) AS ids
   FROM unnest(CASE WHEN coalesce(cardinality(e.competences),0)>0 THEN e.competences
     ELSE ARRAY[]::text[] END) candidate(s) WHERE s IS NOT NULL AND s<>''
 ) skills
 WHERE e.id IN (SELECT exercise_id FROM raw_activity)
), selected AS MATERIALIZED (
 SELECT a.*,e.id AS found_exercise,e.label AS exercise_label,e.chapter_id,e.chapter_label,
   coalesce(e.skills,'{}'::text[]) AS skills
 FROM raw_activity a LEFT JOIN catalogue e ON e.id=a.exercise_id CROSS JOIN bounds b
 WHERE (b.chapter IS NULL OR e.chapter_id=b.chapter)
   AND (b.competence IS NULL OR b.competence=ANY(e.skills))
   AND (b.difficulty IS NULL OR coalesce(e.difficulty,'unknown')=b.difficulty)
   AND (b.exercise_type IS NULL OR coalesce(e.exercise_type,'unknown')=b.exercise_type)
), identities AS MATERIALIZED (
 SELECT DISTINCT a.id FROM registered_accounts a WHERE a.id IN (SELECT account_id FROM selected WHERE kind<>'completion')
), totals AS (
 SELECT jsonb_build_object(
   'exerciseAttempts',count(*) FILTER(WHERE kind='exercise')::text,
   'duelAttempts',count(*) FILTER(WHERE kind='duel')::text,
   'completedDuels',count(*) FILTER(WHERE kind='completion')::text,
   'activeAccounts',count(DISTINCT account_id) FILTER(WHERE account_id IN (SELECT id FROM identities))::text,
   'correct',count(*) FILTER(WHERE verdict='correct')::text,
   'incorrect',count(*) FILTER(WHERE verdict='incorrect')::text,
   'abandoned',count(*) FILTER(WHERE verdict='abandoned')::text,
   'unclassified',count(*) FILTER(WHERE verdict='unclassified')::text) AS value FROM selected
), quality AS (
 SELECT jsonb_build_object(
   'missingExerciseAttempts',count(*) FILTER(WHERE kind<>'completion' AND found_exercise IS NULL)::text,
   'unresolvedChapterAttempts',count(*) FILTER(WHERE kind<>'completion' AND chapter_id IS NULL)::text,
   'noCompetenceAttempts',count(*) FILTER(WHERE kind<>'completion' AND cardinality(skills)=0)::text,
   'unknownCompetenceLinks',(SELECT count(*)::text FROM selected a CROSS JOIN LATERAL unnest(a.skills) s(id)
     WHERE a.kind<>'completion' AND NOT EXISTS(SELECT 1 FROM competence_refs c WHERE c.id=s.id))) AS value
 FROM selected
), expanded AS (
 SELECT a.*,CASE b.grouping WHEN 'chapter' THEN a.chapter_id::text
     WHEN 'exercise' THEN a.exercise_id::text ELSE c.id END AS group_id,
   CASE b.grouping WHEN 'chapter' THEN coalesce(a.chapter_label,'Chapitre non résolu')
     WHEN 'exercise' THEN coalesce(a.exercise_label,'Exercice non retrouvé')
     ELSE coalesce(c.label,'Compétence non renseignée ou inconnue') END AS group_label
 FROM selected a CROSS JOIN bounds b
 -- Other groupings keep exactly one copy per input row. Competences overlap,
 -- but duplicate/unknown links may not count the same attempt twice in a group.
 LEFT JOIN LATERAL unnest(CASE WHEN b.grouping='competence' THEN a.skills ELSE ARRAY[NULL::text] END) s(id) ON true
 LEFT JOIN competence_refs c ON b.grouping='competence' AND c.id=s.id
), attributed AS MATERIALIZED (
 SELECT DISTINCT ON(kind,row_id,group_id COLLATE "C") * FROM expanded ORDER BY kind,row_id,group_id COLLATE "C"
), grouped AS MATERIALIZED (
 SELECT group_id,min(group_label) AS label,
   count(*) FILTER(WHERE kind='exercise') AS exercise_attempts,
   count(*) FILTER(WHERE kind='duel') AS duel_attempts,
   count(*) FILTER(WHERE kind='completion') AS completed_duels,
   count(DISTINCT account_id) FILTER(WHERE account_id IN (SELECT id FROM identities)) AS active_accounts,
   count(*) FILTER(WHERE verdict='correct') AS correct,
   count(*) FILTER(WHERE verdict='incorrect') AS incorrect,
   count(*) FILTER(WHERE verdict='abandoned') AS abandoned,
   count(*) FILTER(WHERE verdict='unclassified') AS unclassified
 FROM attributed GROUP BY group_id
), ordered AS (
 SELECT g.*,row_number() OVER(ORDER BY
   -- Sixty fractional digits separate every distinct ratio of two int64 counts;
   -- default numeric division could round almost-equal rates into false ties.
   CASE WHEN b.ordering='success' THEN g.correct::numeric(100,60)/nullif(g.correct::numeric(100,60)+g.incorrect::numeric(100,60),0) END ASC NULLS LAST,
   (g.exercise_attempts+g.duel_attempts) DESC,g.group_id COLLATE "C" ASC NULLS LAST) AS position
 FROM grouped g CROSS JOIN bounds b
), page_rows AS (
 SELECT * FROM ordered ORDER BY position LIMIT 25 OFFSET (SELECT (page-1)*25 FROM pagination)
)
SELECT jsonb_build_object(
 'schemaVersion',2,'asOf',to_char(b.as_of AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
 'period',jsonb_build_object('from',b.first_day::text,'until',b.until_day::text),
 'filters',jsonb_build_object('chapter',b.chapter::text,'competence',b.competence,'difficulty',b.difficulty,
   'exerciseType',b.exercise_type,'mode',b.mode,'groupBy',b.grouping,'sort',b.ordering),
 'totals',(SELECT value FROM totals),'quality',(SELECT value FROM quality),
 'completedWork',(SELECT jsonb_build_object(
   'distinctExercises',count(DISTINCT exercise_id) FILTER(WHERE verdict IN ('correct','incorrect'))::text,
   'completedResponses',count(*) FILTER(WHERE verdict IN ('correct','incorrect'))::text)
   FROM selected),
 'references',jsonb_build_object(
   'chapters',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id::text,'label',left(label,200),'truncated',char_length(label)>200) ORDER BY label COLLATE "C",id)
     FROM (SELECT id,label FROM chapter_refs ORDER BY label COLLATE "C",id LIMIT 200) r),'[]'::jsonb),
   'competences',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'label',left(label,200),'truncated',char_length(label)>200) ORDER BY label COLLATE "C",id COLLATE "C")
     FROM (SELECT id,label FROM competence_refs ORDER BY label COLLATE "C",id COLLATE "C" LIMIT 200) r),'[]'::jsonb),
   'moreChapters',(SELECT count(*)>200 FROM chapter_refs),'moreCompetences',(SELECT count(*)>200 FROM competence_refs)),
 'groups',jsonb_build_object('page',b.page::text,'size',25,'total',(SELECT count(*)::text FROM grouped),
   'hasMore',(SELECT page*25 FROM pagination)<(SELECT count(*) FROM grouped),
   'rows',coalesce((SELECT jsonb_agg(jsonb_build_object('id',group_id,'label',left(label,200),
     'truncated',char_length(label)>200,'counts',jsonb_build_object(
       'exerciseAttempts',exercise_attempts::text,'duelAttempts',duel_attempts::text,'completedDuels',completed_duels::text,
       'activeAccounts',active_accounts::text,'correct',correct::text,'incorrect',incorrect::text,
       'abandoned',abandoned::text,'unclassified',unclassified::text)) ORDER BY position) FROM page_rows),'[]'::jsonb))
) AS statistics FROM bounds b
   );
 END $rpc$;
NOTIFY pgrst,'reload schema';
