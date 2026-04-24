"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockHcmApi = void 0;
class MockHcmApi {
    balances = new Map();
    originalFetch = null;
    install() {
        this.originalFetch = global.fetch;
        global.fetch = jest.fn(this.handleFetch.bind(this));
    }
    uninstall() {
        if (this.originalFetch) {
            global.fetch = this.originalFetch;
            this.originalFetch = null;
        }
    }
    reset() {
        this.balances.clear();
    }
    setBalance(employeeId, locationId, days) {
        this.balances.set(this.makeKey(employeeId, locationId), days);
    }
    makeKey(employeeId, locationId) {
        return `${employeeId}::${locationId}`;
    }
    async handleFetch(input, init) {
        const url = typeof input === "string" ? new URL(input) : new URL(input.toString());
        const method = init?.method || "GET";
        const pathname = url.pathname;
        if (method === "POST" && pathname === "/validate-and-deduct") {
            const body = JSON.parse(String(init?.body || "{}"));
            const key = this.makeKey(body.employeeId, body.locationId);
            const available = this.balances.get(key);
            if (available === undefined) {
                return this.response(400, { accepted: false, reason: "invalid-dimension" });
            }
            if (available < body.days) {
                return this.response(409, { accepted: false, reason: "insufficient-balance" });
            }
            this.balances.set(key, available - body.days);
            return this.response(200, { accepted: true, referenceId: `hcm-${body.requestId}` });
        }
        if (method === "POST" && pathname === "/release") {
            const body = JSON.parse(String(init?.body || "{}"));
            const key = this.makeKey(body.employeeId, body.locationId);
            const available = this.balances.get(key);
            if (available === undefined) {
                return this.response(400, { message: "invalid-dimension" });
            }
            this.balances.set(key, available + body.days);
            return this.response(200, { released: true });
        }
        if (method === "GET" && pathname.startsWith("/balances/")) {
            const [employeeId, locationId] = pathname.replace("/balances/", "").split("/");
            const key = this.makeKey(employeeId, locationId);
            const available = this.balances.get(key);
            if (available === undefined) {
                return this.response(404, { message: "not-found" });
            }
            return this.response(200, { employeeId, locationId, availableDays: available });
        }
        return this.response(404, { message: "not-found" });
    }
    response(status, payload) {
        return new Response(JSON.stringify(payload), {
            status,
            headers: { "content-type": "application/json" }
        });
    }
}
exports.MockHcmApi = MockHcmApi;
