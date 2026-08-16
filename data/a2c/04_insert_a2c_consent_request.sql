-- Farmer consent requests raised by credit providers (sample data).
--
-- 108 requests: 78 APPROVED, 20 PENDING, 10 DECLINED.
--
-- Requests 1-78 each hit a distinct farmer, so exactly 78 farmers hold an
-- approved consent and can carry a loan application. Requests 79-108 are repeat
-- asks against farmers already in the pipeline, which is why they sit in the
-- pending/declined tail.
--
-- Farmers are ordered by md5(farmer_ref) rather than by ref so the three
-- woredas interleave instead of Jimma soaking up every approval. md5 is
-- deterministic, so this stays reproducible.

INSERT INTO "a2c_consent_request"
  (id, provider_id, farmer_ref, purpose, status, requested_on, decided_on)
WITH farmers AS (
  SELECT farmer_ref, ROW_NUMBER() OVER (ORDER BY md5(farmer_ref)) AS rn
  FROM a2c_farmer
),
requests AS (
  SELECT
    n,
    ((n - 1) % 90) + 1 AS farmer_rn,
    -- Weighted provider cycle: Coop Bank drives most volume as the pilot lender.
    (ARRAY[1,1,1,2,2,3,3,4,5,6,7,8])[((n - 1) % 12) + 1] AS provider_id,
    (ARRAY[
      'Input loan eligibility assessment',
      'Working capital credit scoring',
      'Farm equipment loan appraisal',
      'Livestock loan verification',
      'Irrigation loan feasibility check'
    ])[((n - 1) % 5) + 1] AS purpose,
    CASE
      WHEN n <= 78 THEN 'APPROVED'
      WHEN n <= 98 THEN 'PENDING'
      ELSE 'DECLINED'
    END AS status,
    DATE '2026-01-08' + (((n * 2) % 210) * INTERVAL '1 day') AS requested_on
  FROM generate_series(1, 108) AS n
)
SELECT
  r.n,
  r.provider_id,
  f.farmer_ref,
  r.purpose,
  r.status,
  r.requested_on,
  CASE WHEN r.status = 'PENDING'
       THEN NULL
       ELSE r.requested_on + (((r.n % 6) + 1) * INTERVAL '1 day')
  END
FROM requests r
JOIN farmers f ON f.rn = r.farmer_rn
ORDER BY r.n;
