-- Fixed parameterized aggregate query. $1 is the inclusive UTC date and $2
-- the exclusive UTC date. The server adds the independently attested source
-- environment; this query never accepts an environment or a dynamic identifier.
WITH bounds AS MATERIALIZED (
  SELECT $1::date AS first_day, $2::date AS until_day, statement_timestamp() AS as_of
  WHERE $1::date >= date '2000-01-01' AND $2::date <= date '2200-01-01'
    AND $2::date - $1::date BETWEEN 1 AND 90
    AND $2::date <= (statement_timestamp() AT TIME ZONE 'UTC')::date + 1
), accounts AS MATERIALIZED (
  SELECT id,created_at,is_anonymous FROM auth.users WHERE is_anonymous IS FALSE
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
) AS statistics FROM bounds b;
