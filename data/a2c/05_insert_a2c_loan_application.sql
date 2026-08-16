-- Loan applications raised against approved consents (sample data).
--
-- One application per approved consent = 78 applications:
--   34 APPROVED, 22 IN_PROGRESS, 12 PENDING, 10 DECLINED.
--
-- Approved consents are ordered by md5(id) so the outcome mix spreads across
-- providers and woredas instead of tracking consent id order.
--
-- Amount bands are per product and in ETB.

INSERT INTO "a2c_loan_application"
  (id, provider_id, consent_id, farmer_ref, product, status,
   amount_requested, amount_approved, currency, interest_rate, term_months,
   applied_on, decided_on, decline_reason)
WITH approved_consents AS (
  SELECT
    id,
    provider_id,
    farmer_ref,
    decided_on,
    ROW_NUMBER() OVER (ORDER BY md5(id::text)) AS rn
  FROM a2c_consent_request
  WHERE status = 'APPROVED'
),
shaped AS (
  SELECT
    c.*,
    ((c.rn - 1) % 5) + 1 AS product_idx,
    CASE
      WHEN c.rn <= 34 THEN 'APPROVED'
      WHEN c.rn <= 56 THEN 'IN_PROGRESS'
      WHEN c.rn <= 68 THEN 'PENDING'
      ELSE 'DECLINED'
    END AS status,
    c.decided_on + (((c.rn % 10) + 1) * INTERVAL '1 day') AS applied_on
  FROM approved_consents c
),
priced AS (
  SELECT
    s.*,
    (ARRAY['Input Loan','Working Capital','Farm Equipment','Livestock Loan','Irrigation Loan'])[s.product_idx] AS product,
    (ARRAY[18000, 40000, 150000, 30000, 80000])[s.product_idx]
      + ((s.rn * 3) % 10) * (ARRAY[3000, 10000, 30000, 7500, 17000])[s.product_idx] AS amount_requested
  FROM shaped s
)
SELECT
  ROW_NUMBER() OVER (ORDER BY p.applied_on, p.rn) AS id,
  p.provider_id,
  p.id AS consent_id,
  p.farmer_ref,
  p.product,
  p.status,
  p.amount_requested,
  -- Approved lines are written down to 80-100% of the request.
  CASE WHEN p.status = 'APPROVED'
       THEN ROUND((p.amount_requested * (0.80 + ((p.rn % 5) * 0.05)))::numeric, -2)
  END AS amount_approved,
  'ETB',
  11.5 + ((p.rn % 7) * 0.5) AS interest_rate,
  (ARRAY[6, 9, 12, 18, 24])[p.product_idx] AS term_months,
  p.applied_on,
  CASE WHEN p.status IN ('APPROVED','DECLINED')
       THEN p.applied_on + (((p.rn % 16) + 5) * INTERVAL '1 day')
  END AS decided_on,
  CASE WHEN p.status = 'DECLINED' THEN (ARRAY[
    'Land holding below product minimum',
    'Existing arrears with another lender',
    'Registry profile incomplete',
    'Requested amount above unsecured ceiling',
    'Yield history insufficient for term'
  ])[((p.rn - 1) % 5) + 1] END AS decline_reason
FROM priced p
ORDER BY p.applied_on, p.rn;
