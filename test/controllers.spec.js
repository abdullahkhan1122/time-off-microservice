"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const balances_controller_1 = require("../src/balances/balances.controller");
const hcm_sync_controller_1 = require("../src/hcm-sync/hcm-sync.controller");
const time_off_requests_controller_1 = require("../src/time-off-requests/time-off-requests.controller");
describe("Controllers", () => {
    it("balances controller delegates to service", async () => {
        const service = {
            findOne: jest.fn().mockResolvedValue({}),
            upsertOne: jest.fn().mockResolvedValue({})
        };
        const controller = new balances_controller_1.BalancesController(service);
        await controller.getOne("e1", "l1");
        await controller.upsertOne({ employeeId: "e1", locationId: "l1", availableDays: 2 });
        expect(service.findOne).toHaveBeenCalledWith("e1", "l1");
        expect(service.upsertOne).toHaveBeenCalledWith({
            employeeId: "e1",
            locationId: "l1",
            availableDays: 2
        });
    });
    it("time-off requests controller delegates to service", async () => {
        const service = {
            getById: jest.fn().mockResolvedValue({}),
            create: jest.fn().mockResolvedValue({}),
            approve: jest.fn().mockResolvedValue({}),
            reject: jest.fn().mockResolvedValue({}),
            cancel: jest.fn().mockResolvedValue({})
        };
        const controller = new time_off_requests_controller_1.TimeOffRequestsController(service);
        await controller.getOne("r1");
        await controller.create({
            employeeId: "e1",
            locationId: "l1",
            requestedDays: 1,
            startDate: "2026-01-01",
            endDate: "2026-01-01"
        });
        await controller.approve("r1");
        await controller.reject("r1");
        await controller.cancel("r1");
        expect(service.getById).toHaveBeenCalledWith("r1");
        expect(service.create).toHaveBeenCalledTimes(1);
        expect(service.approve).toHaveBeenCalledWith("r1");
        expect(service.reject).toHaveBeenCalledWith("r1");
        expect(service.cancel).toHaveBeenCalledWith("r1");
    });
    it("hcm sync controller delegates to service", async () => {
        const service = {
            batchReconcile: jest.fn().mockResolvedValue([]),
            realtimeReconcile: jest.fn().mockResolvedValue({})
        };
        const controller = new hcm_sync_controller_1.HcmSyncController(service);
        await controller.batch({
            items: [{ employeeId: "e1", locationId: "l1", availableDays: 3 }]
        });
        await controller.realtime({ employeeId: "e1", locationId: "l1" });
        expect(service.batchReconcile).toHaveBeenCalledWith([
            { employeeId: "e1", locationId: "l1", availableDays: 3 }
        ]);
        expect(service.realtimeReconcile).toHaveBeenCalledWith("e1", "l1");
    });
});
