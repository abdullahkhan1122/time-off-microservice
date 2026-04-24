"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("typeorm");
const app_module_1 = require("../src/app.module");
const time_off_balance_entity_1 = require("../src/balances/time-off-balance.entity");
const balances_service_1 = require("../src/balances/balances.service");
const hcm_sync_service_1 = require("../src/hcm-sync/hcm-sync.service");
const time_off_requests_service_1 = require("../src/time-off-requests/time-off-requests.service");
const mock_hcm_api_1 = require("./mock-hcm-api");
jest.setTimeout(30000);
describe("Time-Off Microservice (integration)", () => {
    let app;
    let dataSource;
    let balancesService;
    let requestsService;
    let hcmSyncService;
    let mockHcm;
    beforeAll(async () => {
        mockHcm = new mock_hcm_api_1.MockHcmApi();
        mockHcm.install();
        process.env.HCM_BASE_URL = "http://hcm.test";
        process.env.DB_PATH = ":memory:";
        const moduleFixture = await testing_1.Test.createTestingModule({
            imports: [app_module_1.AppModule]
        }).compile();
        app = moduleFixture.createNestApplication();
        await app.init();
        dataSource = app.get(typeorm_1.DataSource);
        balancesService = app.get(balances_service_1.BalancesService);
        requestsService = app.get(time_off_requests_service_1.TimeOffRequestsService);
        hcmSyncService = app.get(hcm_sync_service_1.HcmSyncService);
    });
    afterAll(async () => {
        await app.close();
        mockHcm.uninstall();
    });
    beforeEach(async () => {
        await dataSource.synchronize(true);
        mockHcm.reset();
        mockHcm.setBalance("emp-1", "loc-1", 10);
    });
    it("creates a request, deducts balance, and allows approval", async () => {
        await balancesService.upsertOne({
            employeeId: "emp-1",
            locationId: "loc-1",
            availableDays: 10
        });
        const created = await requestsService.create({
            employeeId: "emp-1",
            locationId: "loc-1",
            requestedDays: 2,
            startDate: "2026-05-01",
            endDate: "2026-05-02",
            idempotencyKey: "key-1"
        });
        expect(created.status).toBe("REQUESTED");
        const balance = await balancesService.findOne("emp-1", "loc-1");
        expect(balance.availableDays).toBe(8);
        const approved = await requestsService.approve(created.id);
        expect(approved.status).toBe("APPROVED");
    });
    it("allows request exactly equal to remaining balance", async () => {
        await balancesService.upsertOne({
            employeeId: "emp-1",
            locationId: "loc-1",
            availableDays: 3
        });
        mockHcm.setBalance("emp-1", "loc-1", 3);
        const created = await requestsService.create({
            employeeId: "emp-1",
            locationId: "loc-1",
            requestedDays: 3,
            startDate: "2026-05-10",
            endDate: "2026-05-10"
        });
        expect(created.status).toBe("REQUESTED");
        const balance = await balancesService.findOne("emp-1", "loc-1");
        expect(balance.availableDays).toBe(0);
    });
    it("allows only one of two concurrent requests when combined days exceed balance", async () => {
        await balancesService.upsertOne({
            employeeId: "emp-1",
            locationId: "loc-1",
            availableDays: 10
        });
        const payload = {
            employeeId: "emp-1",
            locationId: "loc-1",
            requestedDays: 6,
            startDate: "2026-05-15",
            endDate: "2026-05-16"
        };
        const results = await Promise.allSettled([
            requestsService.create(payload),
            requestsService.create(payload)
        ]);
        const fulfilled = results.filter((x) => x.status === "fulfilled");
        const rejected = results.filter((x) => x.status === "rejected");
        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);
    });
    it("supports idempotent request creation", async () => {
        await balancesService.upsertOne({
            employeeId: "emp-1",
            locationId: "loc-1",
            availableDays: 10
        });
        const payload = {
            employeeId: "emp-1",
            locationId: "loc-1",
            requestedDays: 1,
            startDate: "2026-06-10",
            endDate: "2026-06-10",
            idempotencyKey: "same-key"
        };
        const first = await requestsService.create(payload);
        const second = await requestsService.create(payload);
        expect(first.id).toBe(second.id);
    });
    it("defensively blocks insufficient local balance", async () => {
        await balancesService.upsertOne({
            employeeId: "emp-1",
            locationId: "loc-1",
            availableDays: 1
        });
        await expect(requestsService.create({
            employeeId: "emp-1",
            locationId: "loc-1",
            requestedDays: 2,
            startDate: "2026-07-01",
            endDate: "2026-07-02"
        })).rejects.toBeInstanceOf(common_1.ConflictException);
    });
    it("rejects requests and refunds local balance", async () => {
        await balancesService.upsertOne({
            employeeId: "emp-1",
            locationId: "loc-1",
            availableDays: 10
        });
        const created = await requestsService.create({
            employeeId: "emp-1",
            locationId: "loc-1",
            requestedDays: 4,
            startDate: "2026-08-01",
            endDate: "2026-08-04"
        });
        const rejected = await requestsService.reject(created.id);
        expect(rejected.status).toBe("REJECTED");
        const balance = await balancesService.findOne("emp-1", "loc-1");
        expect(balance.availableDays).toBe(10);
    });
    it("syncs balances via batch endpoint service", async () => {
        await hcmSyncService.batchReconcile([
            { employeeId: "emp-2", locationId: "loc-2", availableDays: 12 },
            { employeeId: "emp-3", locationId: "loc-3", availableDays: 7.5 }
        ]);
        const emp2 = await balancesService.findOne("emp-2", "loc-2");
        expect(emp2.availableDays).toBe(12);
    });
    it("throws when reading a missing balance", async () => {
        await expect(balancesService.findOne("missing-emp", "missing-loc")).rejects.toThrow("Balance not found for employee/location.");
    });
    it("handles empty batch payload", async () => {
        const result = await hcmSyncService.batchReconcile([]);
        expect(result).toEqual([]);
    });
    it("applies last value for duplicate entries in batch", async () => {
        await hcmSyncService.batchReconcile([
            { employeeId: "emp-dup", locationId: "loc-dup", availableDays: 5 },
            { employeeId: "emp-dup", locationId: "loc-dup", availableDays: 9 }
        ]);
        const balance = await balancesService.findOne("emp-dup", "loc-dup");
        expect(balance.availableDays).toBe(9);
    });
    it("supports batch reconciliation while a request is pending", async () => {
        await balancesService.upsertOne({
            employeeId: "emp-1",
            locationId: "loc-1",
            availableDays: 10
        });
        const created = await requestsService.create({
            employeeId: "emp-1",
            locationId: "loc-1",
            requestedDays: 2,
            startDate: "2026-08-10",
            endDate: "2026-08-11"
        });
        await hcmSyncService.batchReconcile([
            { employeeId: "emp-1", locationId: "loc-1", availableDays: 6 }
        ]);
        const refreshed = await requestsService.getById(created.id);
        const balance = await balancesService.findOne("emp-1", "loc-1");
        expect(refreshed.status).toBe("REQUESTED");
        expect(balance.availableDays).toBe(6);
    });
    it("allows batch reconciliation to reduce balance below already approved state", async () => {
        await balancesService.upsertOne({
            employeeId: "emp-1",
            locationId: "loc-1",
            availableDays: 10
        });
        const created = await requestsService.create({
            employeeId: "emp-1",
            locationId: "loc-1",
            requestedDays: 2,
            startDate: "2026-08-20",
            endDate: "2026-08-21"
        });
        await requestsService.approve(created.id);
        await hcmSyncService.batchReconcile([
            { employeeId: "emp-1", locationId: "loc-1", availableDays: 1 }
        ]);
        const approved = await requestsService.getById(created.id);
        const balance = await balancesService.findOne("emp-1", "loc-1");
        expect(approved.status).toBe("APPROVED");
        expect(balance.availableDays).toBe(1);
    });
    it("reconciles realtime balance from HCM", async () => {
        mockHcm.setBalance("emp-9", "loc-9", 15);
        await hcmSyncService.realtimeReconcile("emp-9", "loc-9");
        const balance = await balancesService.findOne("emp-9", "loc-9");
        expect(balance.availableDays).toBe(15);
    });
    it("propagates invalid-dimension errors from HCM", async () => {
        await balancesService.upsertOne({
            employeeId: "unknown",
            locationId: "unknown",
            availableDays: 5
        });
        await expect(requestsService.create({
            employeeId: "unknown",
            locationId: "unknown",
            requestedDays: 1,
            startDate: "2026-09-01",
            endDate: "2026-09-01"
        })).rejects.toThrow("HCM rejected invalid employee/location.");
    });
    it("rejects invalid date range", async () => {
        await balancesService.upsertOne({
            employeeId: "emp-1",
            locationId: "loc-1",
            availableDays: 10
        });
        await expect(requestsService.create({
            employeeId: "emp-1",
            locationId: "loc-1",
            requestedDays: 1,
            startDate: "2026-09-10",
            endDate: "2026-09-01"
        })).rejects.toThrow("endDate must be >= startDate.");
    });
    it("rejects zero-day request defensively", async () => {
        await balancesService.upsertOne({
            employeeId: "emp-1",
            locationId: "loc-1",
            availableDays: 10
        });
        await expect(requestsService.create({
            employeeId: "emp-1",
            locationId: "loc-1",
            requestedDays: 0,
            startDate: "2026-09-10",
            endDate: "2026-09-10"
        })).rejects.toThrow("requestedDays must be greater than 0.");
    });
    it("rejects invalid location id defensively", async () => {
        await expect(requestsService.create({
            employeeId: "emp-1",
            locationId: " ",
            requestedDays: 1,
            startDate: "2026-09-10",
            endDate: "2026-09-10"
        })).rejects.toThrow("employeeId and locationId are required.");
    });
    it("blocks when local state is missing even if HCM could have balance", async () => {
        mockHcm.setBalance("emp-no-local", "loc-no-local", 15);
        await expect(requestsService.create({
            employeeId: "emp-no-local",
            locationId: "loc-no-local",
            requestedDays: 1,
            startDate: "2026-09-10",
            endDate: "2026-09-10"
        })).rejects.toThrow("Insufficient local balance.");
    });
    it("blocks idempotency key reuse with different payload", async () => {
        await balancesService.upsertOne({
            employeeId: "emp-1",
            locationId: "loc-1",
            availableDays: 10
        });
        await requestsService.create({
            employeeId: "emp-1",
            locationId: "loc-1",
            requestedDays: 1,
            startDate: "2026-10-01",
            endDate: "2026-10-01",
            idempotencyKey: "reuse-key"
        });
        await expect(requestsService.create({
            employeeId: "emp-1",
            locationId: "loc-1",
            requestedDays: 2,
            startDate: "2026-10-01",
            endDate: "2026-10-01",
            idempotencyKey: "reuse-key"
        })).rejects.toThrow("Idempotency key reused with different payload.");
    });
    it("rejects approving a non-requested request", async () => {
        await balancesService.upsertOne({
            employeeId: "emp-1",
            locationId: "loc-1",
            availableDays: 10
        });
        const created = await requestsService.create({
            employeeId: "emp-1",
            locationId: "loc-1",
            requestedDays: 2,
            startDate: "2026-11-01",
            endDate: "2026-11-02"
        });
        await requestsService.approve(created.id);
        await expect(requestsService.approve(created.id)).rejects.toThrow("Only REQUESTED requests can be approved.");
    });
    it("rejects rejecting a non-requested request", async () => {
        await balancesService.upsertOne({
            employeeId: "emp-1",
            locationId: "loc-1",
            availableDays: 10
        });
        const created = await requestsService.create({
            employeeId: "emp-1",
            locationId: "loc-1",
            requestedDays: 2,
            startDate: "2026-12-01",
            endDate: "2026-12-02"
        });
        await requestsService.reject(created.id);
        await expect(requestsService.reject(created.id)).rejects.toThrow("Only REQUESTED requests can be rejected.");
    });
    it("cancels approved request and restores local balance", async () => {
        await balancesService.upsertOne({
            employeeId: "emp-1",
            locationId: "loc-1",
            availableDays: 10
        });
        const created = await requestsService.create({
            employeeId: "emp-1",
            locationId: "loc-1",
            requestedDays: 3,
            startDate: "2026-12-10",
            endDate: "2026-12-11"
        });
        await requestsService.approve(created.id);
        const canceled = await requestsService.cancel(created.id);
        expect(canceled.status).toBe("CANCELED");
        const balance = await balancesService.findOne("emp-1", "loc-1");
        expect(balance.availableDays).toBe(10);
    });
    it("rejects approving an already canceled request", async () => {
        await balancesService.upsertOne({
            employeeId: "emp-1",
            locationId: "loc-1",
            availableDays: 10
        });
        const created = await requestsService.create({
            employeeId: "emp-1",
            locationId: "loc-1",
            requestedDays: 1,
            startDate: "2026-12-20",
            endDate: "2026-12-20"
        });
        await requestsService.approve(created.id);
        await requestsService.cancel(created.id);
        await expect(requestsService.approve(created.id)).rejects.toThrow("Only REQUESTED requests can be approved.");
    });
    it("rejects second approval of same request", async () => {
        await balancesService.upsertOne({
            employeeId: "emp-1",
            locationId: "loc-1",
            availableDays: 10
        });
        const created = await requestsService.create({
            employeeId: "emp-1",
            locationId: "loc-1",
            requestedDays: 1,
            startDate: "2026-12-25",
            endDate: "2026-12-25"
        });
        await requestsService.approve(created.id);
        await expect(requestsService.approve(created.id)).rejects.toThrow("Only REQUESTED requests can be approved.");
    });
    it("throws NotFoundException when getting a non-existent request by id", async () => {
        await expect(requestsService.getById("00000000-0000-0000-0000-000000000000")).rejects.toThrow("Time off request not found.");
    });
    it("releases HCM hold and rethrows when transaction fails mid-create", async () => {
        await balancesService.upsertOne({
            employeeId: "emp-1",
            locationId: "loc-1",
            availableDays: 10
        });
        mockHcm.setBalance("emp-1", "loc-1", 10);
        const txSpy = jest
            .spyOn(dataSource, "transaction")
            .mockImplementationOnce(async (...args) => {
            const fakeManager = {
                findOne: async () => ({
                    employeeId: "emp-1",
                    locationId: "loc-1",
                    availableDays: 1
                }),
                save: async (item) => item
            };
            const work = args[args.length - 1];
            if (typeof work !== "function") {
                throw new Error("Expected transaction callback function.");
            }
            return work(fakeManager);
        });
        await expect(requestsService.create({
            employeeId: "emp-1",
            locationId: "loc-1",
            requestedDays: 2,
            startDate: "2026-06-10",
            endDate: "2026-06-11",
            idempotencyKey: "catch-block-key"
        })).rejects.toBeInstanceOf(common_1.ConflictException);
        txSpy.mockRestore();
        await hcmSyncService.realtimeReconcile("emp-1", "loc-1");
        const reconciledBalance = await balancesService.findOne("emp-1", "loc-1");
        expect(reconciledBalance.availableDays).toBe(10);
    });
    it("throws ConflictException when canceling a non-APPROVED request", async () => {
        await balancesService.upsertOne({
            employeeId: "emp-1",
            locationId: "loc-1",
            availableDays: 10
        });
        const created = await requestsService.create({
            employeeId: "emp-1",
            locationId: "loc-1",
            requestedDays: 1,
            startDate: "2026-07-01",
            endDate: "2026-07-01"
        });
        await expect(requestsService.cancel(created.id)).rejects.toThrow("Only APPROVED requests can be canceled.");
    });
    it("throws when rejecting but the balance row is missing", async () => {
        await balancesService.upsertOne({
            employeeId: "emp-1",
            locationId: "loc-1",
            availableDays: 10
        });
        const created = await requestsService.create({
            employeeId: "emp-1",
            locationId: "loc-1",
            requestedDays: 1,
            startDate: "2026-07-10",
            endDate: "2026-07-10"
        });
        await dataSource.getRepository(time_off_balance_entity_1.TimeOffBalance).delete({
            employeeId: "emp-1",
            locationId: "loc-1"
        });
        await expect(requestsService.reject(created.id)).rejects.toThrow("Balance missing during rejection.");
    });
    it("throws when canceling but the balance row is missing", async () => {
        await balancesService.upsertOne({
            employeeId: "emp-1",
            locationId: "loc-1",
            availableDays: 10
        });
        const created = await requestsService.create({
            employeeId: "emp-1",
            locationId: "loc-1",
            requestedDays: 1,
            startDate: "2026-07-20",
            endDate: "2026-07-20"
        });
        await requestsService.approve(created.id);
        await dataSource.getRepository(time_off_balance_entity_1.TimeOffBalance).delete({
            employeeId: "emp-1",
            locationId: "loc-1"
        });
        await expect(requestsService.cancel(created.id)).rejects.toThrow("Balance missing during cancellation.");
    });
});
