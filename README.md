# ReUseCircle — Give Away & Reuse Board

ReUseCircle helps neighbors give useful items a second life. Members can publish giveaway listings, browse and request items, coordinate through request messages, and report listings for moderator review.

## Features

- Registration and login with bcrypt password hashes and JWTs in HttpOnly cookies.
- Listing create, browse, search, category/condition/status filters, pagination, edit, and delete.
- Owner-controlled request acceptance and decline, automatic decline of competing requests, and collection status.
- Personal dashboard with listing/request totals and incoming request actions.
- Reports and moderator-only review/dismissal actions.
- Responsive React UI, accessible labels/focus styles, error/loading/empty states, and image fallbacks.
- Express security headers, CORS credentials, auth rate limiting, server validation, and MongoDB-backed data.

## Technology and structure

React 18, Vite, React Router, Axios, plain CSS, React Icons; Node.js, Express, Mongoose, MongoDB, bcryptjs, JWT, express-validator, Helmet, and Supertest.

```text
Resue/
  backend/   config, middleware, models, routes, scripts, tests
  frontend/  src/api, components, context, pages, styles
  docs/      API, schema, test cases
  screenshots/
```

## Prerequisites

- Node.js 20 or newer and npm.
- MongoDB 7+ locally, or a MongoDB Atlas database URI.

## Install and configure

From this project directory:

```powershell
npm install
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Set `backend/.env` values:

```dotenv
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/reusecircle
JWT_SECRET=replace_with_a_random_secret_at_least_32_characters
CLIENT_URL=http://localhost:5173
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
TRUST_PROXY=0
```

Set `frontend/.env` to `VITE_API_BASE_URL=http://localhost:5000/api`. Never put database credentials or JWT secrets in frontend variables. Production must use HTTPS, `COOKIE_SECURE=true`, and the frontend's exact origin in `CLIENT_URL`. For separate-site frontend/backend hosts set `COOKIE_SAME_SITE=none` together with `COOKIE_SECURE=true`; test browser third-party-cookie behavior for the chosen hosts.

## MongoDB

### Local

Install MongoDB Community Server, start its service, and use `mongodb://127.0.0.1:27017/reusecircle`. The application creates collections and indexes as models are first used. It exits with a clear error if MongoDB cannot be reached.

### Atlas

Create a cluster and a database user with least-privilege access, allow only the needed application IPs, copy the driver connection string into `MONGODB_URI`, and URL-encode special characters in the password. Store this secret only in the backend hosting environment.

## Run locally

Start both services from the project root:

```powershell
npm run dev
```

Or run separately in two terminals:

```powershell
npm run dev:backend
npm run dev:frontend
```

The UI is at `http://localhost:5173`; the API is at `http://localhost:5000/api`. Health check: `GET http://localhost:5000/api/health`.

## Tests and build

```powershell
npm test
npm run test:backend
npm run test:frontend
npm run build
```

Backend tests use an isolated single-node MongoDB replica set (`mongodb-memory-server`) and Supertest; this exercises the transaction path. Frontend tests use Vitest and React Testing Library. The memory server may need to download a MongoDB binary the first time it runs. Test case descriptions and result status are in [docs/TEST_CASES.md](docs/TEST_CASES.md).

## Create the first moderator

Set these backend-only values temporarily in `backend/.env` (or the hosting environment): `MODERATOR_NAME`, `MODERATOR_EMAIL`, and a strong `MODERATOR_PASSWORD`. Then run:

```powershell
npm run create-moderator
```

The command upserts that email as a moderator and hashes the password. Remove the temporary password from the environment after the command completes. Registration never accepts a role value.

## API and data model

See [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) for endpoint access, payloads, and status codes, and [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) for model fields, indexes, privacy, and request state flow.

## Security notes

Identity and roles come from the verified cookie JWT and current user record. Cookies are HttpOnly, password hashes are not selected in regular queries, public listings do not populate users, request views expose the requester's display name only, and moderator endpoints require the moderator role. Configure exact production origins and HTTPS cookie values. The acceptance workflow uses transactions when MongoDB runs as a replica set (including Atlas); local standalone MongoDB uses its conditional-write fallback.

## Deployment

### Backend

Deploy the `backend` workspace to a Node.js host such as Render, Railway, or Fly.io. Set `NODE_ENV=production`, `MONGODB_URI`, a random `JWT_SECRET` of at least 32 characters, `CLIENT_URL` to the deployed frontend origin, `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none` for a cross-site frontend host, and the host-provided `PORT`. Build is not required; start command is `npm start` from `backend/` or `npm --workspace backend start` from root. Ensure the host's proxy setting is configured with `TRUST_PROXY=1` when applicable.

### Frontend

Import the repository into Vercel, set the project root to `frontend`, set `VITE_API_BASE_URL` to `https://<your-api-host>/api`, and deploy. `frontend/vercel.json` supplies React Router fallback behavior. Rebuild after setting the environment variable.

### Database

Use MongoDB Atlas with network access restricted to the API host where supported. Store credentials only in the backend environment. Then run the moderator setup command once against the production database using temporary protected environment variables.

No live application or repository URL is claimed here. Replace these placeholders after your deployment: **Live application:** `https://your-frontend.example`; **Repository:** `https://github.com/your-account/your-repository`.

## Troubleshooting

- **Mongo connection error:** check that MongoDB is running, the URI is correct, and Atlas network access permits the API host.
- **401 after login:** check that the frontend uses `withCredentials`, the API allows the exact `CLIENT_URL`, and production cookies use HTTPS plus compatible SameSite settings.
- **Browser CORS error:** `CLIENT_URL` must exactly match the frontend origin including scheme and port.
- **Port already in use:** set another backend `PORT` and update the frontend API base URL.
- **Test Mongo binary unavailable:** allow the test runner to download the MongoDB binary or provide a local MongoDB test URI and adjust the isolated test setup.

## Screenshots and future work

Add only real captures of the running app to `screenshots/`; see [screenshots/README.md](screenshots/README.md). Possible follow-ups include image uploads, email notifications, saved searches, and transactional request handling on a replica set.
