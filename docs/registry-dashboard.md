# Registry dashboards moved

Registry dashboards require registry IAM login and viewer roles. Each registry
owns its UI/API deployment and configuration. This public application serves
only Access to Credit and Grievance aggregates. Registry charts, database
credentials, SQL/data/export endpoints and background refreshes are removed.
Unknown and former registry chart IDs return 404 before upstream/cache access.
