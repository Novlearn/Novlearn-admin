-- Fixed aggregate query, never caller-supplied SQL or identifiers.
-- UTC start, exclusive end, chapter UUID, competence text, difficulty, type,
-- activity mode, grouping, ordering, decimal page. All counts remain text.
WITH bounds AS MATERIALIZED (
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
), raw_activity AS MATERIALIZED (
 SELECT 'exercise'::text AS kind,a.id AS row_id,a.exercise_id,a.user_id AS account_id,
   CASE WHEN a.is_abandoned IS TRUE THEN 'abandoned'
     WHEN a.is_correct IS TRUE THEN 'correct' WHEN a.is_correct IS FALSE THEN 'incorrect'
     ELSE 'unclassified' END AS verdict
 FROM public.exercise_attempts a CROSS JOIN bounds b
 WHERE b.mode IN ('all','exercise')
   AND a.attempted_at>=(b.first_day::timestamp AT TIME ZONE 'UTC')
   AND a.attempted_at<(b.until_day::timestamp AT TIME ZONE 'UTC') AND a.attempted_at<=b.as_of
 UNION ALL
 SELECT 'duel',a.id,d.exercise_id,a.player_id,
   CASE WHEN a.is_correct IS TRUE THEN 'correct' WHEN a.is_correct IS FALSE THEN 'incorrect'
     ELSE 'unclassified' END
 FROM public.duel_attempts a LEFT JOIN public.duels d ON d.id=a.duel_id CROSS JOIN bounds b
 WHERE b.mode IN ('all','duel')
   AND a.submitted_at>=(b.first_day::timestamp AT TIME ZONE 'UTC')
   AND a.submitted_at<(b.until_day::timestamp AT TIME ZONE 'UTC') AND a.submitted_at<=b.as_of
 UNION ALL
 SELECT 'completion',d.id,d.exercise_id,NULL::uuid,NULL::text
 FROM public.duels d CROSS JOIN bounds b
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
     ELSE ARRAY[e.competence_id]::text[] END) candidate(s) WHERE s IS NOT NULL AND s<>''
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
 SELECT DISTINCT a.id FROM auth.users a WHERE a.id IN (SELECT account_id FROM selected WHERE kind<>'completion')
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
 SELECT * FROM ordered ORDER BY position LIMIT 25 OFFSET (SELECT (page-1)*25 FROM bounds)
)
SELECT jsonb_build_object(
 'schemaVersion',1,'asOf',to_char(b.as_of AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
 'period',jsonb_build_object('from',b.first_day::text,'until',b.until_day::text),
 'filters',jsonb_build_object('chapter',b.chapter::text,'competence',b.competence,'difficulty',b.difficulty,
   'exerciseType',b.exercise_type,'mode',b.mode,'groupBy',b.grouping,'sort',b.ordering),
 'totals',(SELECT value FROM totals),'quality',(SELECT value FROM quality),
 'references',jsonb_build_object(
   'chapters',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id::text,'label',left(label,200),'truncated',char_length(label)>200) ORDER BY label COLLATE "C",id)
     FROM (SELECT id,label FROM chapter_refs ORDER BY label COLLATE "C",id LIMIT 200) r),'[]'::jsonb),
   'competences',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'label',left(label,200),'truncated',char_length(label)>200) ORDER BY label COLLATE "C",id COLLATE "C")
     FROM (SELECT id,label FROM competence_refs ORDER BY label COLLATE "C",id COLLATE "C" LIMIT 200) r),'[]'::jsonb),
   'moreChapters',(SELECT count(*)>200 FROM chapter_refs),'moreCompetences',(SELECT count(*)>200 FROM competence_refs)),
 'groups',jsonb_build_object('page',b.page::text,'size',25,'total',(SELECT count(*)::text FROM grouped),
   'hasMore',b.page*25<(SELECT count(*) FROM grouped),
   'rows',coalesce((SELECT jsonb_agg(jsonb_build_object('id',group_id,'label',left(label,200),
     'truncated',char_length(label)>200,'counts',jsonb_build_object(
       'exerciseAttempts',exercise_attempts::text,'duelAttempts',duel_attempts::text,'completedDuels',completed_duels::text,
       'activeAccounts',active_accounts::text,'correct',correct::text,'incorrect',incorrect::text,
       'abandoned',abandoned::text,'unclassified',unclassified::text)) ORDER BY position) FROM page_rows),'[]'::jsonb))
) AS statistics FROM bounds b;
