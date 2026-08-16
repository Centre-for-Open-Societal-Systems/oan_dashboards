-- Hourly traffic samples for the last 24 hours (mock data).
--
-- Volumes are derived from the per-endpoint 24-hour totals in
-- devops_api_endpoint, so the trend chart and the API table agree with each
-- other. A diurnal curve (normalised to mean 1.0, peaking mid-afternoon) shapes
-- the hourly split, and latency rises with load.

WITH base AS (
    SELECT
        platform_id,
        SUM(requests_24h)::numeric                    AS requests_24h,
        SUM(requests_24h * error_rate_pct / 100.0)     AS errors_24h,
        MAX(p95_latency_ms)::numeric                   AS p95_ms
    FROM "devops_api_endpoint"
    GROUP BY platform_id
),
shaped AS (
    SELECT
        b.platform_id,
        h,
        TIMESTAMP '2026-08-16 12:00:00' - ((23 - h) * INTERVAL '1 hour') AS sampled_at,
        b.requests_24h,
        b.errors_24h,
        b.p95_ms,
        (0.45 + 0.85 * (0.5 + 0.5 * cos(
            2 * pi() * (EXTRACT(HOUR FROM TIMESTAMP '2026-08-16 12:00:00' - ((23 - h) * INTERVAL '1 hour')) - 14) / 24
        ))) / 0.875 AS shape
    FROM base b
    CROSS JOIN generate_series(0, 23) AS h
)
INSERT INTO "devops_traffic_sample"
  (id, platform_id, sampled_at, requests, errors, p95_latency_ms)
SELECT
    (platform_id - 1) * 24 + h + 1,
    platform_id,
    sampled_at,
    ROUND(requests_24h / 24 * shape)::int,
    ROUND(errors_24h / 24 * shape * (0.7 + 0.6 * shape))::int,
    ROUND(p95_ms * (0.7 + 0.45 * shape))::int
FROM shaped;
