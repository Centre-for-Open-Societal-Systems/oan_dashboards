-- Load the A2C (Access to Credit) schema and sample data (requires psql)
-- Usage: psql -d your_database -f run_all.sql

\i 01_create_a2c.sql
\i 02_insert_a2c_credit_provider.sql
\i 03_insert_a2c_farmer.sql
\i 04_insert_a2c_consent_request.sql
\i 05_insert_a2c_loan_application.sql
\i 06_insert_a2c_registry_data_share.sql
