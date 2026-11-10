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
 FROM auth.users a LEFT JOIN public.profiles p ON p.id=a.id CROSS JOIN bounds
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
) AS users FROM bounds b;
