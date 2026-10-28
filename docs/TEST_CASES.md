# Test cases

Actual results below reflect the automated test run on 2026-10-27. Backend tests ran against an isolated single-node MongoDB replica set; frontend tests ran under Vitest/jsdom.

| ID | Scenario | Test data | Expected | Actual |
|---|---|---|---|---|
| AUTH-01 | Registration hashes password | valid user | 201, hash stored | Passed — response and stored hash checked |
| AUTH-02 | Duplicate and invalid registration | duplicate email, malformed fields | 409 / 400 | Passed — duplicate and invalid registration rejected |
| AUTH-03 | Cookie session and logout | valid/invalid credentials | HttpOnly cookie; protected route 401 after logout | Passed — invalid login, cookie attributes, protected access, and logout checked |
| LIST-01 | Browse, search, filter | seeded books | matching items and counts | Passed — combined search/category/condition/status query checked |
| LIST-02 | Listing ownership | owner and another user | owner can edit/delete; other user gets 403 | Passed — unauthorized edit/delete denied; owner update/delete succeeds |
| REQ-01 | Request item rules | own, available, reserved, collected | only valid other-user available item accepts request | Passed — own, duplicate, reserved, and collected request cases checked |
| REQ-02 | Acceptance and competitors | two pending requests | accepted winner, competitors declined, listing reserved | Passed — selected request accepted and competing request declined |
| REQ-03 | Decline then accept alternative | two pending requests | listing stays available after decline | Passed — another pending request can then be accepted |
| MOD-01 | Report and moderation permissions | user, owner, moderator | self report/unauthorized moderation denied; moderator resolves | Passed — self and duplicate report checks, non-moderator denied, moderator resolves |
| UI-01 | Home and listing card | rendered React components | brand action and safe image placeholder render | Passed — Vitest component tests |
| UI-02 | Registration form validation | mismatched passwords | helpful validation shown | Passed — mismatch message asserted |
| UI-03 | Browse interaction and empty state | title search plus category filter | query values sent to API and empty state shown for no matches | Passed — Vitest interaction test |
| UI-04 | Strict Mode request cancellation | cancelled initial listings fetch | cancellation does not show a network error | Passed — Vitest startup cancellation test |
| UI-05 | Password rules | password missing uppercase letter | form names the missing requirement | Passed — Vitest form validation test |
| BUILD-01 | Vite production build | frontend workspace | production assets emitted | Passed — Vite 6.4.5 build |
| AUDIT-01 | Dependency audit | npm dependency tree | no known advisories | Passed — `npm audit --audit-level=moderate` reported zero vulnerabilities |
