# Workspace guidance

This is the public A2C and Grievance aggregate dashboard (Next.js with an Elysia
BFF). Read README.md and docs before editing.

- Only A2C and Grievance belong in the navigation and DASHBOARD_SERVICES catalog.
- Do not add registry service URLs, database clients/credentials, SQL fallbacks,
  registry chart/data/export routes, or registry background refreshes.
- Keep the service cache on globalThis, scoped to the A2C/Grievance catalog.
- Keep chart response keys compatible with the consuming components.
- Configuration and credentials are server-side environment values supplied by
  Helm/Secret references. Never put URLs or keys in NEXT_PUBLIC_ variables.
- Use npm, retain package-lock.json, and introduce no new lint/type errors.
- Run npm test and npx tsc --noEmit; lint changed files and report inherited debt
  separately. Data checks need unfiltered and region-filtered chart responses
  with summary.failed=0.
- The standalone server runs as non-root on a read-only root filesystem. Write
  only to .next/cache or /tmp.
- Keep the existing Jenkins/Helm release in Commons. Use HELM_DRIVER=configmap;
  the deploy role has no Secret reads or pods/exec. New resource types need the
  existing deploy RBAC to cover them. Do not bypass deployment guards or apply
  cluster objects by hand. No deployments are implied by a source change.
