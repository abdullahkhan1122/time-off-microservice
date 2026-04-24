"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hcm_sync_service_1 = require("../src/hcm-sync/hcm-sync.service");
describe("HcmSyncService", () => {
    it("maps realtime HCM payload into local upsert", async () => {
        const balancesService = {
            upsertOne: jest.fn().mockResolvedValue({ ok: true })
        };
        const hcmClient = {
            getBalance: jest.fn().mockResolvedValue({
                employeeId: "e-1",
                locationId: "l-1",
                availableDays: 5
            })
        };
        const service = new hcm_sync_service_1.HcmSyncService(balancesService, hcmClient);
        await service.realtimeReconcile("e-1", "l-1");
        expect(balancesService.upsertOne).toHaveBeenCalledWith({
            employeeId: "e-1",
            locationId: "l-1",
            availableDays: 5
        });
    });
});
