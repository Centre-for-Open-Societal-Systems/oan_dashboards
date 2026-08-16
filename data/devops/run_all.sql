-- Load the DevOps monitoring schema and mock data (requires psql)
-- Usage: psql -d your_database -f run_all.sql

\i 01_create_devops.sql
\i 02_insert_devops_platform.sql
\i 03_insert_devops_node.sql
\i 04_insert_devops_app_instance.sql
\i 05_insert_devops_database.sql
\i 06_insert_devops_api_endpoint.sql
\i 07_insert_devops_pipeline.sql
\i 08_insert_devops_traffic_sample.sql
\i 09_insert_devops_incident.sql
