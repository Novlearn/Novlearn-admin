-- Contract patch for the canonical NovLearn Production migration.
-- Do not execute directly from novlearn-admin; route it through the approved
-- migration process after review. It returns counts only and writes no data.
CREATE OR REPLACE FUNCTION public.admin_read_cohort_retention() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = ''
SET statement_timeout = '10s'
AS $retention$
BEGIN
  IF NOT coalesce(
    auth.uid() IS NOT NULL
      AND NOT coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
      AND public.get_my_role() = 'admin',
    false
  ) THEN
    RAISE EXCEPTION 'Production Admin required' USING ERRCODE = '42501';
  END IF;

  RETURN (
    WITH bounds AS MATERIALIZED (
      SELECT
        statement_timestamp() AS as_of,
        (statement_timestamp() AT TIME ZONE 'UTC')::date AS utc_today,
        ((statement_timestamp() AT TIME ZONE 'UTC')::date - 60) AS first_day,
        ((statement_timestamp() AT TIME ZONE 'UTC')::date - 30) AS until_day
    ), cohorts AS MATERIALIZED (
      SELECT
        a.id,
        (a.created_at AT TIME ZONE 'UTC')::date AS cohort_day
      FROM novlearn_admin_api.accounts a
      CROSS JOIN bounds b
      WHERE a.is_anonymous IS FALSE
        AND a.created_at >= (b.first_day::timestamp AT TIME ZONE 'UTC')
        AND a.created_at < (b.until_day::timestamp AT TIME ZONE 'UTC')
        AND a.created_at <= b.as_of
    ), activity AS MATERIALIZED (
      SELECT
        a.user_id AS account_id,
        (a.attempted_at AT TIME ZONE 'UTC')::date AS active_day
      FROM public.exercise_attempts a
      JOIN cohorts c ON c.id = a.user_id
      CROSS JOIN bounds b
      WHERE a.attempted_at >= ((b.first_day + 7)::timestamp AT TIME ZONE 'UTC')
        AND a.attempted_at < ((b.until_day + 30)::timestamp AT TIME ZONE 'UTC')
        AND a.attempted_at <= b.as_of
      UNION ALL
      SELECT
        a.player_id AS account_id,
        (a.submitted_at AT TIME ZONE 'UTC')::date AS active_day
      FROM public.duel_attempts a
      JOIN cohorts c ON c.id = a.player_id
      CROSS JOIN bounds b
      WHERE a.submitted_at >= ((b.first_day + 7)::timestamp AT TIME ZONE 'UTC')
        AND a.submitted_at < ((b.until_day + 30)::timestamp AT TIME ZONE 'UTC')
        AND a.submitted_at <= b.as_of
    ), active_days AS MATERIALIZED (
      SELECT DISTINCT account_id, active_day FROM activity
    ), retention AS (
      SELECT jsonb_build_object(
        'eligibleAccounts', count(*) FILTER (
          WHERE c.cohort_day + 7 < b.utc_today
        )::text,
        'returnedAccounts', count(*) FILTER (
          WHERE c.cohort_day + 7 < b.utc_today
            AND EXISTS (
              SELECT 1 FROM active_days d
              WHERE d.account_id = c.id
                AND d.active_day = c.cohort_day + 7
            )
        )::text
      ) AS d7,
      jsonb_build_object(
        'eligibleAccounts', count(*) FILTER (
          WHERE c.cohort_day + 30 < b.utc_today
        )::text,
        'returnedAccounts', count(*) FILTER (
          WHERE c.cohort_day + 30 < b.utc_today
            AND EXISTS (
              SELECT 1 FROM active_days d
              WHERE d.account_id = c.id
                AND d.active_day = c.cohort_day + 30
            )
        )::text
      ) AS d30
      FROM cohorts c CROSS JOIN bounds b
    )
    SELECT jsonb_build_object(
      'schemaVersion', 1,
      'asOf', to_char(b.as_of AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'cohortPeriod', jsonb_build_object(
        'from', b.first_day::text,
        'until', b.until_day::text
      ),
      'd7', (SELECT d7 FROM retention),
      'd30', (SELECT d30 FROM retention)
    )
    FROM bounds b
  );
END
$retention$;

REVOKE ALL ON FUNCTION public.admin_read_cohort_retention()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_read_cohort_retention()
  TO authenticated;
NOTIFY pgrst, 'reload schema';
