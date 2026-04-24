# Time-Off Microservice (NestJS + SQLite)

Take-home assessment implementation for a time-off lifecycle service that syncs balances with an HCM system.

## Stack
- NestJS (JavaScript)
- SQLite + TypeORM
- Jest + Supertest

The application source and tests are implemented as JavaScript (`.js`) files.

## Features
- Create time-off requests with defensive local checks.
- Validate and deduct against HCM in realtime.
- Approve/reject request lifecycle.
- Refund balances on rejection.
- Reconcile balances from HCM:
  - realtime (`/hcm-sync/realtime`)
  - batch corpus (`/hcm-sync/batch`)
- Idempotent request creation via `idempotencyKey`.
- API key + role guard for sensitive endpoints.

## Setup
Prerequisites:
- Node.js and npm installed.
- No global NestJS CLI installation is required.
- `npm install` installs all project dependencies locally from `package.json`, including NestJS, TypeORM, SQLite, Jest, and Supertest.

Install dependencies after cloning/downloading the project:

```bash
npm install
```

If you move the project to a new PC, run `npm install` again in the project root. Do not copy `node_modules`; it is generated locally.

Set environment variables before starting the API:

```bash
export HCM_BASE_URL=http://localhost:4001
export DB_PATH=timeoff.sqlite
export API_KEY=dev-secret
export HCM_TIMEOUT_MS=3000
```

Run locally after setting the environment variables:

```bash
npm run start:dev
```

Build + run:
```bash
npm run build
npm start
```

The API starts on `http://localhost:3000`.

Recommended local startup order:
1. Terminal 1: start the mock HCM.
2. Terminal 2: start this NestJS service.
3. Terminal 3: run the curl API tests.

## Terminal 1: Start Local Mock HCM
Request creation calls the configured HCM service. For local manual testing, keep this mock HCM running in terminal 1:

```bash
cd "/path/to/time-off-microservice"

node -e '
const http=require("http");
let b={"emp-1::loc-1":10,"emp-2::loc-2":1};
const j=(res,c,o)=>{res.writeHead(c,{"content-type":"application/json"});res.end(JSON.stringify(o));};
http.createServer((req,res)=>{
let d=""; req.on("data",c=>d+=c); req.on("end",()=>{
  if(req.method==="POST"&&req.url==="/validate-and-deduct"){const x=JSON.parse(d||"{}");const k=`${x.employeeId}::${x.locationId}`;if(!(k in b))return j(res,400,{accepted:false});if(b[k]<x.days)return j(res,409,{accepted:false});b[k]-=x.days;return j(res,200,{accepted:true,referenceId:"ref-1"});}
  if(req.method==="POST"&&req.url==="/release"){const x=JSON.parse(d||"{}");const k=`${x.employeeId}::${x.locationId}`;b[k]=(b[k]??0)+x.days;return j(res,200,{released:true});}
  if(req.method==="GET"&&req.url.startsWith("/balances/")){const [_,__,e,l]=req.url.split("/");const k=`${e}::${l}`;if(!(k in b))return j(res,404,{message:"not-found"});return j(res,200,{employeeId:e,locationId:l,availableDays:b[k]});}
  j(res,404,{message:"not-found"});
});}).listen(4001,()=>console.log("Mock HCM on :4001"));
'
```

Expected terminal output:
```text
Mock HCM on :4001
```

Leave this terminal open while testing. It simulates the external HCM APIs used by the service.

## Terminal 2: Start the NestJS API
Open a second terminal and run:

```bash
cd "/path/to/time-off-microservice"

export HCM_BASE_URL=http://localhost:4001
export DB_PATH=timeoff.sqlite
export API_KEY=dev-secret
export HCM_TIMEOUT_MS=3000

npm run start:dev
```

Expected terminal output includes:
```text
Nest application successfully started
```

The API is now running at `http://localhost:3000`. Leave this terminal open while testing.

## Tests
Run tests:
```bash
npm test
```

Run coverage:
```bash
npm run test:cov
```

Expected current result: 45 tests passing across 5 suites, with coverage above 95% statements and lines. The test suite includes an in-process mock HCM to simulate realtime validation, invalid dimensions, insufficient balances, and reconciliation responses.

Do not run `npm test` and `npm run test:cov` at the same time against the same SQLite file. Run them sequentially to avoid SQLite database lock contention.

## Access Control
The service is protected by a global API-key guard and role-based endpoint authorization. Requests without the configured API key are rejected with `401 Unauthorized`; requests with a valid API key but the wrong role are rejected with `403 Forbidden`.

Every request must include the API key:
```bash
-H "x-api-key: dev-secret"
```

Every protected business operation must also include one role:
```bash
-H "x-user-role: EMPLOYEE|MANAGER|SYSTEM"
```

Role model:
- `EMPLOYEE`: read balances/requests and create own time-off requests.
- `MANAGER`: approve, reject, and cancel requests.
- `SYSTEM`: bootstrap balances and run HCM sync endpoints.

Endpoint access matrix:
- `GET /balances/:employeeId/:locationId`: `EMPLOYEE`, `MANAGER`, `SYSTEM`
- `POST /balances/bootstrap`: `SYSTEM`
- `POST /time-off-requests`: `EMPLOYEE`, `MANAGER`
- `GET /time-off-requests/:id`: `EMPLOYEE`, `MANAGER`, `SYSTEM`
- `PATCH /time-off-requests/:id/approve`: `MANAGER`
- `PATCH /time-off-requests/:id/reject`: `MANAGER`
- `PATCH /time-off-requests/:id/cancel`: `MANAGER`
- `POST /hcm-sync/realtime`: `SYSTEM`
- `POST /hcm-sync/batch`: `SYSTEM`

For local runs, `API_KEY=dev-secret` means the request header must be `x-api-key: dev-secret`. In a real deployment, set `API_KEY` to a strong secret value and provide it only to trusted clients or gateway infrastructure.

Example:
```bash
curl -X POST http://localhost:3000/balances/bootstrap \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-secret" \
  -H "x-user-role: SYSTEM" \
  -d '{"employeeId":"emp-1","locationId":"loc-1","availableDays":10}'
```

Production note: TypeORM auto-sync is disabled when `NODE_ENV=production`; use migrations for production database changes.

## Manual API Testing
Run these commands in terminal 3 after terminal 1 and terminal 2 are both running. These commands demonstrate the main product flow and expected security behavior.

Start from the project folder:

```bash
cd "/path/to/time-off-microservice"
```

### 1. Verify Unauthorized Requests Are Blocked
Call any protected endpoint without headers:

```bash
curl -i http://localhost:3000/balances/emp-1/loc-1
```

Expected result:
- HTTP `401 Unauthorized`.
- This proves the global API-key guard is active.

### 2. Seed a Local Balance
This creates or updates the local ReadyOn balance projection. It requires the `SYSTEM` role.

```bash
curl -i -X POST http://localhost:3000/balances/bootstrap \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-secret" \
  -H "x-user-role: SYSTEM" \
  -d '{"employeeId":"emp-1","locationId":"loc-1","availableDays":10}'
```

Expected result:
- HTTP `201 Created`.
- JSON response with `employeeId`, `locationId`, `availableDays: 10`, and `version`.

### 3. Read the Balance as an Employee
```bash
curl -i http://localhost:3000/balances/emp-1/loc-1 \
  -H "x-api-key: dev-secret" \
  -H "x-user-role: EMPLOYEE"
```

Expected result:
- HTTP `200 OK`.
- `availableDays` should be `10`.

### 4. Create a Time-Off Request
This is the core write path:
- local balance pre-check,
- HCM validate-and-deduct,
- local transaction,
- request saved as `REQUESTED`.

```bash
curl -i -X POST http://localhost:3000/time-off-requests \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-secret" \
  -H "x-user-role: EMPLOYEE" \
  -d '{"employeeId":"emp-1","locationId":"loc-1","requestedDays":2,"startDate":"2026-05-01","endDate":"2026-05-02","idempotencyKey":"demo-1"}'
```

Expected result:
- HTTP `201 Created`.
- Response status should be `REQUESTED`.
- Response contains an `id`. Copy that value for the next commands.
- Local balance should now be reduced from `10` to `8`.

Optional helper if `jq` is installed:

```bash
REQUEST_ID=$(curl -s -X POST http://localhost:3000/time-off-requests \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-secret" \
  -H "x-user-role: EMPLOYEE" \
  -d '{"employeeId":"emp-1","locationId":"loc-1","requestedDays":2,"startDate":"2026-05-01","endDate":"2026-05-02","idempotencyKey":"demo-2"}' | jq -r .id)

echo "$REQUEST_ID"
```

### 5. Approve the Request as Manager
Replace `<request-id>` with the real `id` returned above.

```bash
curl -i -X PATCH http://localhost:3000/time-off-requests/<request-id>/approve \
  -H "x-api-key: dev-secret" \
  -H "x-user-role: MANAGER"
```

Expected result:
- HTTP `200 OK`.
- Request status becomes `APPROVED`.

### 6. Read the Request and Balance
```bash
curl -i http://localhost:3000/time-off-requests/<request-id> \
  -H "x-api-key: dev-secret" \
  -H "x-user-role: EMPLOYEE"

curl -i http://localhost:3000/balances/emp-1/loc-1 \
  -H "x-api-key: dev-secret" \
  -H "x-user-role: EMPLOYEE"
```

Expected result:
- Request status is `APPROVED`.
- Balance is reduced by the requested days.

### 7. Reject a Pending Request
Create another request first, then reject it while it is still `REQUESTED`.

```bash
curl -i -X POST http://localhost:3000/time-off-requests \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-secret" \
  -H "x-user-role: EMPLOYEE" \
  -d '{"employeeId":"emp-1","locationId":"loc-1","requestedDays":1,"startDate":"2026-05-10","endDate":"2026-05-10","idempotencyKey":"reject-demo-1"}'
```

Use the returned `id`:

```bash
curl -i -X PATCH http://localhost:3000/time-off-requests/<request-id>/reject \
  -H "x-api-key: dev-secret" \
  -H "x-user-role: MANAGER"
```

Expected result:
- HTTP `200 OK`.
- Request status becomes `REJECTED`.
- Balance is refunded by the rejected request days.

### 8. Cancel an Approved Request
Cancel is only valid for an already `APPROVED` request.

```bash
curl -i -X PATCH http://localhost:3000/time-off-requests/<request-id>/cancel \
  -H "x-api-key: dev-secret" \
  -H "x-user-role: MANAGER"
```

Expected result:
- HTTP `200 OK`.
- Request status becomes `CANCELED`.
- Balance is refunded.

### 9. Batch Sync from HCM
This simulates HCM sending a corpus refresh, such as a yearly reset or anniversary bonus.

```bash
curl -i -X POST http://localhost:3000/hcm-sync/batch \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-secret" \
  -H "x-user-role: SYSTEM" \
  -d '{"items":[{"employeeId":"emp-1","locationId":"loc-1","availableDays":15}]}'
```

Expected result:
- HTTP `201 Created`.
- Local balance for `emp-1/loc-1` becomes `15`.

### 10. Realtime Sync from HCM
This asks HCM for one employee/location balance and updates the local projection.

```bash
curl -i -X POST http://localhost:3000/hcm-sync/realtime \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-secret" \
  -H "x-user-role: SYSTEM" \
  -d '{"employeeId":"emp-1","locationId":"loc-1"}'
```

Expected result:
- HTTP `201 Created`.
- Response contains the reconciled local balance.

## Manual Negative Test Cases
These commands prove the service fails safely.

### Insufficient Local Balance
Seed only 1 day:

```bash
curl -i -X POST http://localhost:3000/balances/bootstrap \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-secret" \
  -H "x-user-role: SYSTEM" \
  -d '{"employeeId":"emp-2","locationId":"loc-2","availableDays":1}'
```

Request 5 days:

```bash
curl -i -X POST http://localhost:3000/time-off-requests \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-secret" \
  -H "x-user-role: EMPLOYEE" \
  -d '{"employeeId":"emp-2","locationId":"loc-2","requestedDays":5,"startDate":"2026-06-01","endDate":"2026-06-05"}'
```

Expected result:
- HTTP `409 Conflict`.
- HCM should not be called because the local defensive pre-check fails first.

### Idempotency
Run the same command twice:

```bash
curl -i -X POST http://localhost:3000/time-off-requests \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-secret" \
  -H "x-user-role: EMPLOYEE" \
  -d '{"employeeId":"emp-1","locationId":"loc-1","requestedDays":1,"startDate":"2026-07-01","endDate":"2026-07-01","idempotencyKey":"idem-demo-1"}'
```

Expected result:
- Both responses return the same request `id`.
- Balance is deducted only once.

Reuse the same key with a different payload:

```bash
curl -i -X POST http://localhost:3000/time-off-requests \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-secret" \
  -H "x-user-role: EMPLOYEE" \
  -d '{"employeeId":"emp-1","locationId":"loc-1","requestedDays":2,"startDate":"2026-07-02","endDate":"2026-07-03","idempotencyKey":"idem-demo-1"}'
```

Expected result:
- HTTP `409 Conflict`.
- This prevents accidental duplicate or mutated retries.

### Invalid Date Range
```bash
curl -i -X POST http://localhost:3000/time-off-requests \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-secret" \
  -H "x-user-role: EMPLOYEE" \
  -d '{"employeeId":"emp-1","locationId":"loc-1","requestedDays":2,"startDate":"2026-09-10","endDate":"2026-09-01"}'
```

Expected result:
- HTTP `422 Unprocessable Entity`.

### Invalid Role
```bash
curl -i -X POST http://localhost:3000/balances/bootstrap \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-secret" \
  -H "x-user-role: EMPLOYEE" \
  -d '{"employeeId":"emp-2","locationId":"loc-2","availableDays":5}'
```

Expected result:
- HTTP `403 Forbidden`.
- This endpoint requires `SYSTEM`.

### Missing API Key
```bash
curl -i http://localhost:3000/balances/emp-1/loc-1
```

Expected result:
- HTTP `401 Unauthorized`.

## Submission Packaging
Create the final zip from the project root. Do not include `node_modules`, generated coverage, build output, local SQLite databases, or git metadata.

```bash
zip -r submission.zip . \
  -x "submission.zip" "node_modules/*" "coverage/*" "dist/*" ".git/*" ".codex" "*.sqlite" "*.sqlite-journal" "*.db"
```

Verify the file is under 50 MB:

```bash
ls -lh submission.zip
```

## Project Structure
- `docs/TRD.md` - technical requirements/design document.
- `src/` - application code.
- `test/` - unit + integration tests and mock HCM server.

## API Summary
- `GET /balances/:employeeId/:locationId`
- `POST /balances/bootstrap`
- `POST /time-off-requests`
- `GET /time-off-requests/:id`
- `PATCH /time-off-requests/:id/approve`
- `PATCH /time-off-requests/:id/reject`
- `PATCH /time-off-requests/:id/cancel`
- `POST /hcm-sync/realtime`
- `POST /hcm-sync/batch`
