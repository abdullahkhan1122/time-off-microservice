"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const hcm_client_1 = require("../src/hcm/hcm.client");
describe("HcmClient", () => {
    const createClient = (baseUrl) => {
        const configService = {
            get: jest.fn().mockReturnValue(baseUrl)
        };
        return new hcm_client_1.HcmClient(configService);
    };
    afterEach(() => {
        jest.restoreAllMocks();
    });
    it("throws when HCM_BASE_URL is missing", async () => {
        const client = createClient(undefined);
        await expect(client.validateAndDeduct({
            employeeId: "e1",
            locationId: "l1",
            days: 1,
            requestId: "r1"
        })).rejects.toBeInstanceOf(common_1.BadGatewayException);
    });
    it("maps 400 from validateAndDeduct", async () => {
        const client = createClient("http://hcm.test");
        jest.spyOn(global, "fetch").mockResolvedValue(new Response("{}", { status: 400 }));
        await expect(client.validateAndDeduct({
            employeeId: "e1",
            locationId: "l1",
            days: 1,
            requestId: "r1"
        })).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it("maps 409 from validateAndDeduct", async () => {
        const client = createClient("http://hcm.test");
        jest.spyOn(global, "fetch").mockResolvedValue(new Response("{}", { status: 409 }));
        await expect(client.validateAndDeduct({
            employeeId: "e1",
            locationId: "l1",
            days: 1,
            requestId: "r1"
        })).rejects.toBeInstanceOf(common_1.ConflictException);
    });
    it("maps non-400/409 failures from validateAndDeduct", async () => {
        const client = createClient("http://hcm.test");
        jest.spyOn(global, "fetch").mockResolvedValue(new Response("{}", { status: 502 }));
        await expect(client.validateAndDeduct({
            employeeId: "e1",
            locationId: "l1",
            days: 1,
            requestId: "r1"
        })).rejects.toBeInstanceOf(common_1.BadGatewayException);
    });
    it("throws conflict when HCM accepts=false", async () => {
        const client = createClient("http://hcm.test");
        jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ accepted: false, reason: "blocked" }), {
            status: 200
        }));
        await expect(client.validateAndDeduct({
            employeeId: "e1",
            locationId: "l1",
            days: 1,
            requestId: "r1"
        })).rejects.toThrow("blocked");
    });
    it("returns null reference id when HCM response has no reference", async () => {
        const client = createClient("http://hcm.test");
        jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ accepted: true }), { status: 200 }));
        const result = await client.validateAndDeduct({
            employeeId: "e1",
            locationId: "l1",
            days: 1,
            requestId: "r1"
        });
        expect(result.referenceId).toBeNull();
    });
    it("throws when release fails", async () => {
        const client = createClient("http://hcm.test");
        jest.spyOn(global, "fetch").mockResolvedValue(new Response("{}", { status: 500 }));
        await expect(client.release("e1", "l1", 1, "r1")).rejects.toBeInstanceOf(common_1.BadGatewayException);
    });
    it("throws when realtime balance read fails", async () => {
        const client = createClient("http://hcm.test");
        jest.spyOn(global, "fetch").mockResolvedValue(new Response("{}", { status: 500 }));
        await expect(client.getBalance("e1", "l1")).rejects.toBeInstanceOf(common_1.BadGatewayException);
    });
    it("returns realtime balance payload", async () => {
        const client = createClient("http://hcm.test");
        jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ employeeId: "e1", locationId: "l1", availableDays: 4 }), { status: 200 }));
        const result = await client.getBalance("e1", "l1");
        expect(result.availableDays).toBe(4);
    });
    it("maps fetch timeout/network errors to 503", async () => {
        const client = createClient("http://hcm.test");
        jest.spyOn(global, "fetch").mockRejectedValue(new Error("timeout"));
        await expect(client.validateAndDeduct({
            employeeId: "e1",
            locationId: "l1",
            days: 1,
            requestId: "r1"
        })).rejects.toBeInstanceOf(common_1.ServiceUnavailableException);
    });
});
