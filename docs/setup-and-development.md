# Local development

Use Node.js 24 and npm. Run `npm ci`, copy `.env.example` to `.env.local`,
and configure the A2C and Grievance service URLs and their server-side keys.
Run `npm run dev` and open http://localhost:3000.

Only services with a configured URL are offered. No PostgreSQL database,
registry API, seed scripts or registry credentials are needed by this product.
The SQL files under `data/` are historical fixtures and are not runtime inputs.

Run `npm test` for the public boundary regression, `npx tsc --noEmit` for
TypeScript, and `npm run lint` for ESLint. The legacy component library still
has existing lint findings; they do not enable additional public routes.

Registry dashboards are separate repositories, built and deployed by their
owning registry CI with configuration held in the registry Helm charts.
