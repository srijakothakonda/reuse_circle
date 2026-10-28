# Database schema

## Models

- **User**: `name`, normalized unique `email`, `passwordHash` (select:false), `role` (`user`/`moderator`), timestamps.
- **Listing**: `ownerId` reference, title, category, condition, description, approximate pickup area, private exact pickup address and availability times, optional image URL, status (`available`/`reserved`/`collected`), timestamps.
- **ItemRequest**: listing and requester references, message, status (`pending`/`accepted`/`declined`), timestamps.
- **ContentReport**: listing and reporter references, reason, status (`pending`/`reviewed`/`dismissed`), timestamps.

Listing indexes cover owner and browse facets/status/newest order; a text index covers title and description. Requests index listing, requester, and status. Reports have a unique `(listingId, reporterId)` index to enforce one report per reporter and listing.

Public listing responses omit the exact pickup address and time. The owner can see them, and the accepted requester can see them after acceptance. Reports and public browse results omit private pickup details. Public listing responses do not populate user references. Request owner views populate only the requester's name; reports populate reporter name only. Password hashes are excluded by default and selected explicitly only for password verification.

## Request state flow

`pending -> accepted` reserves an available listing and declines its other pending requests. On a replica set or sharded MongoDB deployment, the listing update, selected request update, and competing request declines run in a transaction. A decline changes only that request and leaves the listing available. A reserved listing may transition to `collected` only through the owner-only collection endpoint. Collected listings cannot be edited or receive new requests.

Standalone MongoDB does not support multi-document transactions. On standalone servers, acceptance uses a conditional atomic write on listing availability so only one concurrent request can win, then applies request updates with compensating rollback if the selected request has already changed. This fallback is suitable for local demonstrations, but production should use Atlas or another replica set so all acceptance changes commit or roll back together.
