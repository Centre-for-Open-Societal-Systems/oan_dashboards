-- Registry datasets transmitted to providers per loan application (sample data).
--
-- Three datasets per application = 234 payloads. The failure/pending sprinkle
-- uses prime moduli so faults spread across providers rather than clustering on
-- the newest applications: 226 DELIVERED, 4 FAILED, 4 PENDING.

INSERT INTO "a2c_registry_data_share"
  (id, application_id, consent_id, dataset, status, record_count, shared_on, fault_reason)
WITH payloads AS (
  SELECT
    a.id AS application_id,
    a.consent_id,
    a.applied_on,
    k,
    ((a.id + k - 1) % 5) + 1 AS dataset_idx,
    ROW_NUMBER() OVER (ORDER BY a.id, k) AS n
  FROM a2c_loan_application a
  CROSS JOIN generate_series(1, 3) AS k
),
typed AS (
  SELECT
    p.*,
    (ARRAY['Farmer Profile','Land Holding','Crop History','Livestock Holding','Input Usage'])[p.dataset_idx] AS dataset,
    (ARRAY[1, 1, 3, 0, 2])[p.dataset_idx]
      + (p.n % (ARRAY[1, 4, 10, 9, 7])[p.dataset_idx]) AS record_count,
    CASE
      WHEN p.n % 47 = 0 THEN 'FAILED'
      WHEN p.n % 53 = 0 THEN 'PENDING'
      ELSE 'DELIVERED'
    END AS status
  FROM payloads p
)
SELECT
  t.n,
  t.application_id,
  t.consent_id,
  t.dataset,
  t.status,
  t.record_count,
  t.applied_on + ((t.k - 1) * INTERVAL '1 day'),
  CASE WHEN t.status = 'FAILED' THEN (ARRAY[
    'Provider endpoint timed out',
    'Schema mismatch on payload version',
    'Consent token expired before delivery',
    'Farmer identifier could not be resolved'
  ])[((t.n / 47 - 1) % 4) + 1] END
FROM typed t
ORDER BY t.n;
