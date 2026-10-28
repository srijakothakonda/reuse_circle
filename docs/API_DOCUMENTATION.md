# API documentation

All routes use the `/api` prefix and return `{ success, message, data }` on success. Errors return `{ success: false, message }`. Protected routes require the `reusecircle_token` HttpOnly cookie. IDs are MongoDB ObjectIds. JSON request bodies are limited to 3 MB so a JPG, PNG, or WebP photo up to 2 MB can be uploaded as a data URL.

## Authentication

| Method and path | Access | Body / query | Result |
|---|---|---|---|
| `POST /auth/register` | Public, rate limited | `name`, `email`, `password`, `confirmPassword` | 201; public user object |
| `POST /auth/login` | Public, rate limited | `email`, `password` | 200; user and HttpOnly JWT cookie |
| `POST /auth/logout` | Public | none | 200; clears cookie |
| `GET /auth/me` | Login required | none | 200; current user |

## Listings and requests

| Method and path | Access | Body / query | Result |
|---|---|---|---|
| `GET /listings` | Public | `search`, `category`, `condition`, `status`, `page`, `limit` | Newest first, paginated `{items,pagination}` |
| `POST /listings` | Login required | title, category, condition, description, pickupArea, pickupAddress, pickupTime, optional imageData | 201; listing |
| `GET /listings/:id` | Public; owner and accepted requester receive private pickup details | none | listing without populated private user data |
| `GET /listings/:id/image` | Public | none | Stored image bytes |
| `PATCH /listings/:id` | Owner | editable listing fields; status is not accepted | Updated available listing |
| `DELETE /listings/:id` | Owner | none | Deletes available listing and dependent records |
| `GET /me/listings` | Login required | none | Current user's listings |
| `POST /listings/:id/requests` | Login required | `message` (5–1000 chars) | 201; pending request |
| `GET /me/requests` | Login required | none | Submitted requests; exact pickup details are included only after acceptance |
| `GET /listings/:id/requests` | Listing owner | none | Requests with requester display name only |
| `PATCH /requests/:id/status` | Listing owner | `status: accepted | declined` | Request result; acceptance reserves listing and declines pending competitors |
| `PATCH /listings/:id/collect` | Listing owner | none | Changes reserved listing to collected |

## Reporting, moderation, dashboard, health

| Method and path | Access | Body / query | Result |
|---|---|---|---|
| `POST /listings/:id/reports` | Login required, not listing owner | `reason` (5–1000 chars) | 201; pending report |
| `GET /moderation/reports` | Moderator | optional status | Reports with listing and reporter display name |
| `PATCH /moderation/reports/:id/status` | Moderator | `status: reviewed | dismissed` | Updated report |
| `GET /dashboard/summary` | Login required | none | Counts for current user's listings and requests |
| `GET /health` | Public | none | API health status (server only starts after DB connection) |

Typical status codes: 200 read/update, 201 create, 400 invalid input, 401 missing/invalid session, 403 ownership/role denied, 404 missing resource, 409 duplicate or invalid state transition, 429 rate limit, 500 unexpected server failure. Detailed stack traces are not returned.

Example error: `{"success":false,"message":"Only the listing owner can manage requests"}`.
