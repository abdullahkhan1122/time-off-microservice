# Time-Off Microservice - Technical Requirements & Design (TRD)

## 1. Problem Statement
ReadyOn is the employee-facing system for requesting time off, but the external HCM system (for example Workday or SAP) remains the source of truth for employment data and leave balances. The difficult part is preserving balance integrity when multiple systems can change the same employee/location balance.

Example risk:
- Employee has 10 days available in HCM.
- Employee requests 2 days in ReadyOn.
- ReadyOn must verify HCM accepts the deduction.
- HCM may later change the balance independently, for example because of an anniversary bonus, yearly refresh, or another integrated system.

The microservice must:
- Manage the time-off request lifecycle.
- Preserve balance integrity under retries and concurrent requests.
- Sync local balances from HCM using realtime and batch workflows.
- Be defensive when HCM rejects requests, times out, or fails to reject invalid data.
- Expose REST endpoints for balance, request lifecycle, and HCM synchronization.
- Provide a rigorous test suite with mocked HCM behavior.

## 2. Scope
In scope:
- Backend microservice using NestJS, JavaScript, and SQLite.
- REST APIs for balance reads, request creation, approvals, rejections, cancellations, and HCM reconciliation.
- Local balance projection keyed by `(employeeId, locationId)`.
- HCM integration client for validate-and-deduct, release, and realtime balance reads.
- Batch HCM sync endpoint for full or partial balance corpus updates.
- API key and role-based endpoint protection.
- Automated tests with mocked HCM behavior and coverage proof.

Out of scope:
- UI/frontend.
- Payroll calculations or working-day calendar logic.
- Multi-tenant isolation.
- Production migrations implementation.
- Distributed lock manager.
- Durable queue/outbox worker.

## 3. Key Assumptions
- Balances are per employee and per location: `(employeeId, locationId)`.
- HCM is the source of truth.
- ReadyOn keeps a local projection for fast reads and defensive validation.
- HCM exposes:
  - Realtime validate-and-deduct API.
  - Realtime balance read API.
  - Batch corpus endpoint that sends balances to ReadyOn.
- Requested time off is represented as decimal days.
- Supported request statuses are `REQUESTED`, `APPROVED`, `REJECTED`, and `CANCELED`.
- Authentication in this implementation is simplified to API key + role headers for take-home clarity.
- `POST /balances/bootstrap` is included as a protected system/bootstrap endpoint for demo and local testing.

## 4. Architecture
### Components
- `TimeOffRequests` module: request creation, lookup, approval, rejection, and cancellation.
- `Balances` module: local balance projection and upsert/read operations.
- `HcmSync` module: realtime and batch reconciliation from HCM.
- `HcmClient` module: outbound HCM calls, timeout handling, and error mapping.
- `Security` module: global API key validation and role-based authorization.

### Persistence
- SQLite via TypeORM.
- `time_off_balances` stores the current local projected balance.
- `time_off_requests` stores request lifecycle state, idempotency key, and HCM reference.
- TypeORM `synchronize` is disabled when `NODE_ENV=production`.

### Consistency Model
- HCM remains authoritative.
- ReadyOn local balance is a projection optimized for reads and defensive checks.
- Writes follow a validate-and-deduct pattern:
  1. Validate local input and idempotency.
  2. Check local projected balance.
  3. Ask HCM to validate and deduct.
  4. Re-check and deduct local balance inside a database transaction.
  5. If local transaction fails after HCM deduction, call HCM release as compensation.

### Why This Model
This approach avoids trusting stale local data alone while still giving employees fast balance reads. It also avoids making every balance read dependent on HCM availability. The tradeoff is that reconciliation is required when HCM changes balances independently.

## 4b. Request Creation Flow
```text
Client
  |
  v
POST /time-off-requests
  |
  +--> Validate DTO (days > 0, dates valid, ids non-empty)
  |
  +--> Check idempotency key
  |       +--> Same payload: return existing request
  |       +--> Different payload: reject with conflict
  |
  +--> Local pre-check: availableDays >= requestedDays
  |       +--> Fail fast: ConflictException, no HCM call
  |
  +--> HCM validate-and-deduct
  |       +--> Invalid dimensions: map to 400
  |       +--> Insufficient balance: map to 409
  |       +--> Timeout/network failure: map to 503
  |
  +--> DB transaction
  |       +--> Re-check balance to guard race conditions
  |       +--> Deduct local balance
  |       +--> Save request with hcmReference
  |
  +--> On transaction failure after HCM deduction
          +--> Call HCM release as compensation
          +--> Rethrow original error
```

## 5. Data Model
### `time_off_balances`
- `id`: generated numeric primary key.
- `employeeId`: string.
- `locationId`: string.
- `availableDays`: number.
- `version`: TypeORM version column.
- `createdAt`: timestamp.
- `updatedAt`: timestamp.

Constraints:
- Unique index on `(employeeId, locationId)`.

Purpose:
- Represents ReadyOn's local projected view of HCM balance for a specific employee/location.

### `time_off_requests`
- `id`: UUID primary key.
- `employeeId`: string.
- `locationId`: string.
- `requestedDays`: number.
- `startDate`: date string.
- `endDate`: date string.
- `status`: `REQUESTED`, `APPROVED`, `REJECTED`, or `CANCELED`.
- `idempotencyKey`: nullable unique string.
- `hcmReference`: nullable HCM reference returned by validate-and-deduct.
- `createdAt`: timestamp.
- `updatedAt`: timestamp.

Purpose:
- Tracks lifecycle state and provides a stable object for manager approval/rejection/cancellation.

## 6. API Design
All endpoints require `x-api-key`. Role-protected operations also require `x-user-role`.

### Access Roles
- `EMPLOYEE`: read balances/requests and create time-off requests.
- `MANAGER`: approve, reject, and cancel requests.
- `SYSTEM`: bootstrap balances and run HCM sync endpoints.

### Balances
`GET /balances/:employeeId/:locationId`
- Roles: `EMPLOYEE`, `MANAGER`, `SYSTEM`.
- Purpose: read local projected balance.
- Success: `200`.
- Not found: `404`.

`POST /balances/bootstrap`
- Roles: `SYSTEM`.
- Purpose: protected local setup/bootstrap endpoint for demo/testing.
- Body:
```json
{
  "employeeId": "emp-1",
  "locationId": "loc-1",
  "availableDays": 10
}
```
- Success: `201`.

### Requests
`POST /time-off-requests`
- Roles: `EMPLOYEE`, `MANAGER`.
- Purpose: create a time-off request after local and HCM validation.
- Body:
```json
{
  "employeeId": "emp-1",
  "locationId": "loc-1",
  "requestedDays": 2,
  "startDate": "2026-05-01",
  "endDate": "2026-05-02",
  "idempotencyKey": "demo-1"
}
```
- Success: `201`, status `REQUESTED`.
- Invalid date/range/input: `422`.
- Local or HCM insufficient balance: `409`.
- Invalid HCM dimensions: `400`.
- HCM unavailable: `503`.

`GET /time-off-requests/:id`
- Roles: `EMPLOYEE`, `MANAGER`, `SYSTEM`.
- Purpose: read request details.
- Success: `200`.
- Not found: `404`.

`PATCH /time-off-requests/:id/approve`
- Role: `MANAGER`.
- Purpose: approve a `REQUESTED` request.
- Success: `200`, status `APPROVED`.
- Invalid transition: `409`.

`PATCH /time-off-requests/:id/reject`
- Role: `MANAGER`.
- Purpose: reject a `REQUESTED` request and release/refund balance.
- Success: `200`, status `REJECTED`.
- Invalid transition: `409`.

`PATCH /time-off-requests/:id/cancel`
- Role: `MANAGER`.
- Purpose: cancel an `APPROVED` request and release/refund balance.
- Success: `200`, status `CANCELED`.
- Invalid transition: `409`.

### HCM Sync
`POST /hcm-sync/realtime`
- Role: `SYSTEM`.
- Purpose: fetch current balance for one employee/location from HCM and update local projection.
- Body:
```json
{
  "employeeId": "emp-1",
  "locationId": "loc-1"
}
```

`POST /hcm-sync/batch`
- Role: `SYSTEM`.
- Purpose: accept HCM balance corpus updates and upsert local projections.
- Body:
```json
{
  "items": [
    { "employeeId": "emp-1", "locationId": "loc-1", "availableDays": 15 }
  ]
}
```

## 7. Critical Scenarios & Handling
1. Independent HCM balance updates:
- Problem: HCM may refresh balances because of work anniversaries, new year resets, or other systems.
- Handling: realtime reconcile for targeted reads and batch reconcile for corpus-level updates.

2. Invalid employee/location combinations:
- Problem: ReadyOn may receive a request for a dimension HCM does not accept.
- Handling: local projected balance must exist before calling HCM; HCM `400` maps to API `400`.

3. Insufficient balance:
- Problem: local balance or HCM balance may be too low.
- Handling: local pre-check blocks obvious failures; HCM validate-and-deduct is authoritative.

4. HCM accepts but local transaction fails:
- Problem: HCM deducted balance but ReadyOn failed to persist the request or local deduction.
- Handling: catch block calls HCM release and rethrows the original error.

5. Duplicate client retries:
- Problem: client/network retry may submit the same request twice.
- Handling: `idempotencyKey` returns the original request for the same payload and rejects key reuse with a different payload.

6. Concurrent requests exhausting the same balance:
- Problem: two requests for the same employee/location may pass the same local pre-check.
- Handling: balance is re-checked inside the database transaction. If balance changed, request fails with `ConflictException("Balance changed during request creation.")` and triggers HCM release.

7. Manager invalid state transitions:
- Problem: approving an already approved/canceled request or canceling a pending request would corrupt workflow semantics.
- Handling: strict status checks reject invalid transitions with `409`.

8. HCM outage or slow response:
- Problem: HCM may timeout or be unavailable.
- Handling: HCM client uses configurable timeout (`HCM_TIMEOUT_MS`) and maps network/timeout failures to `503 Service Unavailable`.

## 8. Alternatives Considered
1. Pure pass-through to HCM:
- Pros: always reads directly from source of truth.
- Cons: poor employee UX, slow balance reads, every user action depends on HCM availability.
- Decision: rejected.

2. Local-only authoritative balance:
- Pros: simplest local architecture.
- Cons: violates source-of-truth requirement and misses external HCM changes.
- Decision: rejected.

3. Event-sourced ledger:
- Pros: best audit trail, strong reconstruction of balance history.
- Cons: higher complexity than needed for the take-home and still requires HCM reconciliation.
- Decision: deferred as a production enhancement.

4. Polling-only HCM sync:
- Pros: straightforward background job.
- Cons: wasteful and introduces stale balance windows.
- Decision: not chosen as primary strategy.

5. Webhook-only HCM sync:
- Pros: low latency when HCM reliably pushes updates.
- Cons: depends on HCM webhook reliability and delivery guarantees.
- Decision: useful future improvement but not enough alone.

6. On-demand realtime fetch for every balance read:
- Pros: accurate reads.
- Cons: makes normal employee UI dependent on HCM uptime.
- Decision: rejected for read path.

Chosen hybrid:
- Local projection for fast reads.
- HCM validate-and-deduct for authoritative writes.
- Batch sync for bulk reconciliation.
- Realtime sync for targeted reconciliation.
- Compensation release for partial failures.

## 9. Security & Reliability Considerations
- DTO validation on inbound payloads using `class-validator`.
- Global whitelist validation rejects unknown request fields.
- Input sanitization rejects blank `employeeId` and `locationId`.
- API key authentication via `x-api-key`.
- Role authorization via `x-user-role`.
- Sensitive endpoints are role-restricted:
  - `SYSTEM` for bootstrap and HCM sync.
  - `MANAGER` for approval/rejection/cancellation.
  - `EMPLOYEE` for request creation and reads.
- Express `x-powered-by` header is disabled.
- HCM network/timeout failures are mapped to `503`.
- HCM business errors are mapped to explicit `400`/`409`.
- Idempotency key protects against duplicate client retries.
- HCM release compensation reduces cross-system divergence after partial failure.
- TypeORM schema synchronization is disabled in production mode.
- Secrets are environment-configured (`API_KEY`, `HCM_BASE_URL`).
- Rate limiting is expected at the gateway layer for production.

Known dependency note:
- `npm audit` flags transitive issues through the TypeORM + `sqlite3@5.1.7` dependency chain. `sqlite3@6` was tested but is not compatible with the current TypeORM SQLite driver in this project. The compatible version is retained so the project remains runnable.

## 10. Test Strategy
The test suite is intentionally broad because the assessment values robustness and regression protection.

Test layers:
- Unit tests for HCM client error mapping and security guard behavior.
- Controller tests for delegation and route-level behavior.
- Integration tests for request lifecycle, balance updates, HCM sync, idempotency, concurrency, and failure handling.
- In-process mock HCM for validate-and-deduct, release, and realtime balance reads.

Key cases covered:
- Successful request creation and approval.
- Request exactly equal to balance.
- Concurrent requests exhausting the same balance.
- Insufficient local balance.
- Rejection refund.
- Cancellation refund.
- Invalid transition rejection.
- Idempotent request creation.
- Idempotency key conflict.
- Invalid date range.
- Zero-day request rejection.
- Invalid/blank location rejection.
- Missing local balance despite HCM balance.
- Batch sync with empty and duplicate entries.
- Batch sync during pending/approved requests.
- Realtime HCM reconciliation.
- HCM invalid dimensions.
- HCM timeout/network error.
- Unauthorized and forbidden role checks.
- Production-sensitive endpoint role restrictions.

Verification commands:
```bash
npm test
npm run test:cov
npm run build
```

Current expected result:
- 54 tests passing across 5 suites.
- Coverage is approximately 98% statements/lines, 100% functions, and 84%+ branches across executable business logic.

Manual run requirements:
- `API_KEY` must be set.
- `HCM_BASE_URL` must point to a real or mock HCM.
- Requests must include `x-api-key`.
- Role-protected requests must include `x-user-role` as `EMPLOYEE`, `MANAGER`, or `SYSTEM`.

Example local environment:
```bash
export HCM_BASE_URL=http://localhost:4001
export DB_PATH=timeoff.sqlite
export API_KEY=dev-secret
export HCM_TIMEOUT_MS=3000
npm run start:dev
```

Operational verification:
- README includes a full curl-based walkthrough for the main request lifecycle:
  - seed local balance,
  - read balance,
  - create request,
  - approve request,
  - reject pending request,
  - cancel approved request,
  - run batch HCM sync,
  - run realtime HCM sync.
- README also includes manual negative tests:
  - missing API key returns `401`,
  - wrong role returns `403`,
  - insufficient balance returns `409`,
  - invalid date range returns `422`,
  - idempotent retries return the same request,
  - idempotency key reuse with a different payload returns `409`.
- These manual checks complement the automated Jest suite and demonstrate the security and lifecycle behavior without requiring a frontend.

## 11. Limitations & Next Steps
Known limitations for production:
- SQLite is appropriate for the exercise but not ideal for multi-instance production scale.
- No distributed lock manager.
- No durable outbox/Saga queue for guaranteed HCM release retry.
- API key + role headers are simplified for the assessment; production should use JWT/OIDC/mTLS or gateway-managed identity.
- No full audit/event log table yet.
- No pagination/list endpoints for manager dashboards.

Recommended next iterations:
- Add migrations and migration runner.
- Add outbox table and retry worker for HCM release/compensation.
- Add audit log for request lifecycle changes.
- Replace header-based roles with signed identity claims.
- Add OpenAPI/Swagger documentation.
- Add contract tests against real HCM OpenAPI.
- Add rate limiting and request tracing at the gateway/service boundary.
