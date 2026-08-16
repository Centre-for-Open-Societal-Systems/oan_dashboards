-- A2C (Access to Credit) schema.
--
-- Models the consent-driven flow that lets an Ethiopian credit provider use
-- farmer registry data to assess a loan:
--
--   credit provider -> consent request -> loan application -> registry data share
--
-- The data shipped alongside this schema is SAMPLE data. There is no live A2C
-- feed yet, so the inserts are deterministic (no random()) and reproducible on
-- any deployment of this repo.
--
-- Locations are keyed by HDX P-code so they line up with the location catalog
-- (eth_regions / eth_zones / eth_woredas) and with the map topojson.

DROP TABLE IF EXISTS "a2c_registry_data_share" CASCADE;
DROP TABLE IF EXISTS "a2c_loan_application" CASCADE;
DROP TABLE IF EXISTS "a2c_consent_request" CASCADE;
DROP TABLE IF EXISTS "a2c_farmer" CASCADE;
DROP TABLE IF EXISTS "a2c_credit_provider" CASCADE;

-- ---------------------------------------------------------------- providers

CREATE TABLE "a2c_credit_provider" (
    id             INTEGER PRIMARY KEY,
    name           TEXT NOT NULL,
    short_name     TEXT NOT NULL,
    provider_type  TEXT NOT NULL,
    onboarded_on   DATE NOT NULL,
    -- ACTIVE providers are live on the exchange; ONBOARDING are still in
    -- integration testing and cannot receive registry data yet.
    status         TEXT NOT NULL,
    integration    TEXT NOT NULL,
    head_office    TEXT
);

COMMENT ON TABLE "a2c_credit_provider" IS 'Credit providers onboarded onto the A2C data exchange (sample data)';
CREATE INDEX "a2c_credit_provider_status_idx" ON "a2c_credit_provider" (status);

-- ------------------------------------------------------------------ farmers

CREATE TABLE "a2c_farmer" (
    farmer_ref    TEXT PRIMARY KEY,
    region_name   TEXT NOT NULL,
    region_pcode  TEXT NOT NULL,
    zone_name     TEXT NOT NULL,
    zone_pcode    TEXT NOT NULL,
    woreda_name   TEXT NOT NULL,
    woreda_pcode  TEXT NOT NULL,
    enrolled_on   DATE NOT NULL
);

COMMENT ON TABLE "a2c_farmer" IS 'Farmers enrolled for A2C, located by HDX P-code (sample data)';
CREATE INDEX "a2c_farmer_region_idx" ON "a2c_farmer" (region_pcode);
CREATE INDEX "a2c_farmer_zone_idx" ON "a2c_farmer" (zone_pcode);
CREATE INDEX "a2c_farmer_woreda_idx" ON "a2c_farmer" (woreda_pcode);

-- ---------------------------------------------------------- consent requests

CREATE TABLE "a2c_consent_request" (
    id          INTEGER PRIMARY KEY,
    provider_id INTEGER NOT NULL REFERENCES a2c_credit_provider(id),
    farmer_ref  TEXT NOT NULL REFERENCES a2c_farmer(farmer_ref),
    purpose     TEXT NOT NULL,
    -- APPROVED consents are the only ones that may proceed to an application.
    status      TEXT NOT NULL,
    requested_on DATE NOT NULL,
    decided_on   DATE
);

COMMENT ON TABLE "a2c_consent_request" IS 'Farmer consent requests raised by credit providers (sample data)';
CREATE INDEX "a2c_consent_request_status_idx" ON "a2c_consent_request" (status);
CREATE INDEX "a2c_consent_request_provider_idx" ON "a2c_consent_request" (provider_id);
CREATE INDEX "a2c_consent_request_farmer_idx" ON "a2c_consent_request" (farmer_ref);

-- --------------------------------------------------------- loan applications

CREATE TABLE "a2c_loan_application" (
    id               INTEGER PRIMARY KEY,
    provider_id      INTEGER NOT NULL REFERENCES a2c_credit_provider(id),
    consent_id       INTEGER NOT NULL REFERENCES a2c_consent_request(id),
    farmer_ref       TEXT NOT NULL REFERENCES a2c_farmer(farmer_ref),
    product          TEXT NOT NULL,
    -- IN_PROGRESS = under assessment, PENDING = awaiting farmer/provider input,
    -- APPROVED = credit granted, DECLINED = refused.
    status           TEXT NOT NULL,
    amount_requested NUMERIC(14,2) NOT NULL,
    amount_approved  NUMERIC(14,2),
    currency         TEXT NOT NULL DEFAULT 'ETB',
    interest_rate    NUMERIC(5,2),
    term_months      INTEGER,
    applied_on       DATE NOT NULL,
    decided_on       DATE,
    decline_reason   TEXT
);

COMMENT ON TABLE "a2c_loan_application" IS 'Loan applications assessed using shared registry data (sample data)';
CREATE INDEX "a2c_loan_application_status_idx" ON "a2c_loan_application" (status);
CREATE INDEX "a2c_loan_application_provider_idx" ON "a2c_loan_application" (provider_id);
CREATE INDEX "a2c_loan_application_farmer_idx" ON "a2c_loan_application" (farmer_ref);
CREATE INDEX "a2c_loan_application_applied_idx" ON "a2c_loan_application" (applied_on);

-- ----------------------------------------------------- registry data shares

CREATE TABLE "a2c_registry_data_share" (
    id             INTEGER PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES a2c_loan_application(id),
    consent_id     INTEGER NOT NULL REFERENCES a2c_consent_request(id),
    dataset        TEXT NOT NULL,
    -- DELIVERED payloads reached the provider; FAILED ones are integration faults.
    status         TEXT NOT NULL,
    record_count   INTEGER NOT NULL,
    shared_on      DATE NOT NULL,
    fault_reason   TEXT
);

COMMENT ON TABLE "a2c_registry_data_share" IS 'Registry datasets transmitted to providers per loan application (sample data)';
CREATE INDEX "a2c_registry_data_share_status_idx" ON "a2c_registry_data_share" (status);
CREATE INDEX "a2c_registry_data_share_application_idx" ON "a2c_registry_data_share" (application_id);
CREATE INDEX "a2c_registry_data_share_dataset_idx" ON "a2c_registry_data_share" (dataset);
